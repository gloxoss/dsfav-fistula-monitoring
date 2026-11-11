import {
  CANONICAL_BATTERY_BLOCK_PCT,
  CANONICAL_BATTERY_WARN_PCT,
  CaptureConfig,
  evaluateStart,
  pressureZone,
  qualityVerdict,
} from './capture-gate.js';

const config: CaptureConfig = {
  pressureMinKpa: 2.5,
  pressureLowKpa: 3.0,
  pressureHighKpa: 8.5,
  pressureMaxKpa: 9.0,
  motionThresholdG: 0.08,
  cleanTimeMinSec: 12,
  batteryWarnPct: CANONICAL_BATTERY_WARN_PCT,
  batteryBlockPct: CANONICAL_BATTERY_BLOCK_PCT,
};

describe('capture gate (server side)', () => {
  it('[UC2] maps the canonical pressure boundaries to zones', () => {
    expect(pressureZone(2.49, config)).toBe('BLOCKED_LOW');
    expect(pressureZone(2.5, config)).toBe('AMBER_LOW');
    expect(pressureZone(2.99, config)).toBe('AMBER_LOW');
    expect(pressureZone(3.0, config)).toBe('GREEN');
    expect(pressureZone(8.5, config)).toBe('GREEN');
    expect(pressureZone(8.51, config)).toBe('AMBER_HIGH');
    expect(pressureZone(9.0, config)).toBe('AMBER_HIGH');
    expect(pressureZone(9.01, config)).toBe('BLOCKED_HIGH');
  });

  it('[UC2] refuses a low pressure with a message that names the lack of support', () => {
    const decision = evaluateStart({ zone: 'BLOCKED_LOW', stableSec: 2, batteryPct: 95, telemetrySeen: true, attempts: 1 }, config);
    expect(decision.ok).toBe(false);
    if (decision.ok) throw new Error('unreachable');
    expect(decision.code).toBe('PRESSURE_LOW');
    expect(decision.message_fr).toContain('insuffisant');
  });

  it('[UC2] refuses a high pressure with a compression message distinct from the low one', () => {
    const decision = evaluateStart({ zone: 'BLOCKED_HIGH', stableSec: 2, batteryPct: 95, telemetrySeen: true, attempts: 1 }, config);
    expect(decision.ok).toBe(false);
    if (decision.ok) throw new Error('unreachable');
    expect(decision.code).toBe('PRESSURE_HIGH');
    expect(decision.message_fr).toContain('compression');
    expect(decision.message_fr).not.toContain('insuffisant');
  });

  it('[UC2] refuses a start without a full second of stable valid pressure', () => {
    const decision = evaluateStart({ zone: 'GREEN', stableSec: 0.9, batteryPct: 95, telemetrySeen: true, attempts: 1 }, config);
    expect(decision.ok).toBe(false);
    if (decision.ok) throw new Error('unreachable');
    expect(decision.code).toBe('PRESSURE_UNSTABLE');
  });

  it('[UC2] accepts a green pressure held for 1.0 s', () => {
    expect(evaluateStart({ zone: 'GREEN', stableSec: 1.0, batteryPct: 95, telemetrySeen: true, attempts: 1 }, config)).toEqual({ ok: true });
  });

  it('[UC13] refuses a critical battery with the exact « Batterie à 12 % » message', () => {
    const decision = evaluateStart({ zone: 'GREEN', stableSec: 2, batteryPct: 12, telemetrySeen: true, attempts: 1 }, config);
    expect(decision.ok).toBe(false);
    if (decision.ok) throw new Error('unreachable');
    expect(decision.code).toBe('BATTERY_CRITICAL');
    expect(decision.message_fr).toBe('Batterie à 12 %');
  });

  it('[UC13] lets a low battery start with a warning only', () => {
    const decision = evaluateStart({ zone: 'GREEN', stableSec: 2, batteryPct: 17, telemetrySeen: true, attempts: 1 }, config);
    expect(decision.ok).toBe(true);
    if (!decision.ok) throw new Error('unreachable');
    expect(decision.warning?.code).toBe('BATTERY_LOW');
    expect(decision.warning?.message_fr).toBe('Batterie à 17 %');
  });

  it('[UC4] accepts a short motion burst and masks only the artifact epochs', () => {
    const verdict = qualityVerdict(
      { elapsedSec: 25, artifactEpochs: [10, 11], pressureInvalidEpochs: [] },
      config,
    );
    expect(verdict.status).toBe('ACCEPTED');
    expect(verdict.rejectReason).toBeNull();
    expect(verdict.artifactEpochs).toEqual([10, 11]);
    expect(verdict.cleanDurationSec).toBe(23);
  });

  it('[UC4] rejects a heavy motion capture under the clean-time floor with ARTIFACT', () => {
    const artifactEpochs = Array.from({ length: 15 }, (_, index) => index + 5);
    const verdict = qualityVerdict({ elapsedSec: 25, artifactEpochs, pressureInvalidEpochs: [] }, config);
    expect(verdict.status).toBe('REJECTED_QUALITY');
    expect(verdict.rejectReason).toBe('ARTIFACT');
    expect(verdict.cleanDurationSec).toBe(10);
  });

  it('[UC4] names PRESSURE when an out-of-window pressure costs more clean time than motion', () => {
    const pressureInvalidEpochs = Array.from({ length: 12 }, (_, index) => index);
    const verdict = qualityVerdict(
      { elapsedSec: 25, artifactEpochs: [15, 16, 17], pressureInvalidEpochs },
      config,
    );
    expect(verdict.status).toBe('REJECTED_QUALITY');
    expect(verdict.rejectReason).toBe('PRESSURE');
  });
});
