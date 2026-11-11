export type PressureZone = 'BLOCKED_LOW' | 'AMBER_LOW' | 'GREEN' | 'AMBER_HIGH' | 'BLOCKED_HIGH';

export interface CaptureConfig {
  pressureMinKpa: number;
  pressureLowKpa: number;
  pressureHighKpa: number;
  pressureMaxKpa: number;
  motionThresholdG: number;
  cleanTimeMinSec: number;
  batteryWarnPct: number;
  batteryBlockPct: number;
}

// Canonical defaults (canonical specification, "à calibrer au banc").
// The published ConfigVersion overrides them when it carries the battery keys.
export const CANONICAL_BATTERY_WARN_PCT = 20;
export const CANONICAL_BATTERY_BLOCK_PCT = 15;
export const CANONICAL_STABLE_PRESSURE_SEC = 1.0;
export const MAX_REPOSITION_ATTEMPTS = 3;

export const CANONICAL_CAPTURE_CONFIG: CaptureConfig = {
  pressureMinKpa: 2.5,
  pressureLowKpa: 3.0,
  pressureHighKpa: 8.5,
  pressureMaxKpa: 9.0,
  motionThresholdG: 0.08,
  cleanTimeMinSec: 12,
  batteryWarnPct: CANONICAL_BATTERY_WARN_PCT,
  batteryBlockPct: CANONICAL_BATTERY_BLOCK_PCT,
};

export function pressureZone(kpa: number, config: CaptureConfig): PressureZone {
  if (!Number.isFinite(kpa)) return 'BLOCKED_LOW';
  if (kpa < config.pressureMinKpa) return 'BLOCKED_LOW';
  if (kpa < config.pressureLowKpa) return 'AMBER_LOW';
  if (kpa <= config.pressureHighKpa) return 'GREEN';
  if (kpa <= config.pressureMaxKpa) return 'AMBER_HIGH';
  return 'BLOCKED_HIGH';
}

export function pressureInValidWindow(kpa: number, config: CaptureConfig): boolean {
  return Number.isFinite(kpa) && kpa >= config.pressureMinKpa && kpa <= config.pressureMaxKpa;
}

export type StartRefusalCode =
  | 'BATTERY_CRITICAL'
  | 'DEVICE_NO_TELEMETRY'
  | 'PRESSURE_LOW'
  | 'PRESSURE_HIGH'
  | 'PRESSURE_AMBER'
  | 'PRESSURE_UNSTABLE'
  | 'NOT_EXPLOITABLE';

export interface StartGateInput {
  zone: PressureZone;
  stableSec: number;
  batteryPct: number;
  telemetrySeen: boolean;
  attempts: number;
}

export interface StartWarning {
  code: 'BATTERY_LOW';
  message_fr: string;
}

export type StartDecision =
  | { ok: true; warning?: StartWarning }
  | { ok: false; code: StartRefusalCode; message_fr: string; retryable: boolean };

// The battery block and the 1.0 s stable-pressure rule come from the project rules (README, rules 3 and 4).
// A start also requires the optimal (green) pressure zone, per section 08-01.
export function evaluateStart(input: StartGateInput, config: CaptureConfig): StartDecision {
  if (input.batteryPct < config.batteryBlockPct) {
    return {
      ok: false,
      code: 'BATTERY_CRITICAL',
      message_fr: `Batterie à ${Math.max(0, Math.round(input.batteryPct))} %`,
      retryable: true,
    };
  }
  if (input.attempts >= MAX_REPOSITION_ATTEMPTS) {
    return {
      ok: false,
      code: 'NOT_EXPLOITABLE',
      message_fr: 'Mesure non exploitable après 3 repositionnements.',
      retryable: false,
    };
  }
  if (!input.telemetrySeen) {
    return {
      ok: false,
      code: 'DEVICE_NO_TELEMETRY',
      message_fr: "Aucune télémétrie reçue de l'appareil : vérifiez la connexion.",
      retryable: true,
    };
  }
  if (input.zone === 'BLOCKED_LOW') {
    return {
      ok: false,
      code: 'PRESSURE_LOW',
      message_fr: 'Appui insuffisant : augmentez la pression sur la FAV.',
      retryable: true,
    };
  }
  if (input.zone === 'BLOCKED_HIGH') {
    return {
      ok: false,
      code: 'PRESSURE_HIGH',
      message_fr: 'Pression trop forte : risque de compression de la FAV.',
      retryable: true,
    };
  }
  if (input.stableSec < CANONICAL_STABLE_PRESSURE_SEC) {
    return {
      ok: false,
      code: 'PRESSURE_UNSTABLE',
      message_fr: 'Maintenez un appui stable pendant 1 seconde avant de démarrer.',
      retryable: true,
    };
  }
  if (input.zone !== 'GREEN') {
    return {
      ok: false,
      code: 'PRESSURE_AMBER',
      message_fr: 'Appui hors zone optimale : ajustez la pression sur la FAV.',
      retryable: true,
    };
  }
  if (input.batteryPct < config.batteryWarnPct) {
    return {
      ok: true,
      warning: { code: 'BATTERY_LOW', message_fr: `Batterie à ${Math.max(0, Math.round(input.batteryPct))} %` },
    };
  }
  return { ok: true };
}

export interface QualityInput {
  elapsedSec: number;
  artifactEpochs: number[];
  pressureInvalidEpochs: number[];
}

export interface QualityVerdict {
  status: 'ACCEPTED' | 'REJECTED_QUALITY';
  rejectReason: 'ARTIFACT' | 'PRESSURE' | null;
  cleanDurationSec: number;
  artifactEpochs: number[];
}

export function qualityVerdict(input: QualityInput, config: CaptureConfig): QualityVerdict {
  const artifactEpochs = [...new Set(input.artifactEpochs)].sort((a, b) => a - b);
  const invalidEpochs = new Set<number>([...artifactEpochs, ...input.pressureInvalidEpochs]);
  const cleanDurationSec = Math.max(0, round1(input.elapsedSec - invalidEpochs.size));
  const rejected = cleanDurationSec < config.cleanTimeMinSec;
  const pressureCount = new Set(input.pressureInvalidEpochs).size;
  return {
    status: rejected ? 'REJECTED_QUALITY' : 'ACCEPTED',
    rejectReason: rejected ? (pressureCount > artifactEpochs.length ? 'PRESSURE' : 'ARTIFACT') : null,
    cleanDurationSec,
    artifactEpochs,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
