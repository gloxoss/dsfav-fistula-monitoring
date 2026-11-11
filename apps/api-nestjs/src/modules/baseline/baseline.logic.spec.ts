import { AlertStatus } from '@prisma/client';
import { applyPersistenceRule, baselineProgress } from './baseline.logic.js';

describe('baseline lifecycle', () => {
  it('[UC7] accepted sessions build and lock the baseline after three', () => {
    expect(baselineProgress(0, false, AlertStatus.NORMAL)).toEqual({
      status: AlertStatus.BASELINE_BUILDING,
      acceptedCount: 1,
      shouldLock: false,
    });
    expect(baselineProgress(1, false, AlertStatus.NORMAL).acceptedCount).toBe(2);
    expect(baselineProgress(2, false, AlertStatus.NORMAL)).toEqual({
      status: AlertStatus.BASELINE_BUILDING,
      acceptedCount: 3,
      shouldLock: true,
    });
  });

  it('[UC7] rejected attempts do not count and locked baselines stay locked', () => {
    expect(baselineProgress(1, false, AlertStatus.REJECTED_QUALITY)).toEqual({
      status: AlertStatus.REJECTED_QUALITY,
      acceptedCount: 1,
      shouldLock: false,
    });
    expect(baselineProgress(3, true, AlertStatus.NORMAL)).toEqual({
      status: AlertStatus.NORMAL,
      acceptedCount: 3,
      shouldLock: false,
    });
  });

  it('[UC9] two consecutive above-threshold sessions escalate, a normal one resets', () => {
    expect(applyPersistenceRule(AlertStatus.TO_CONFIRM, 0)).toBe(AlertStatus.TO_CONFIRM);
    expect(applyPersistenceRule(AlertStatus.TO_CONFIRM, 1)).toBe(
      AlertStatus.UNUSUAL_EVOLUTION,
    );
    expect(applyPersistenceRule(AlertStatus.TO_CONFIRM, 2)).toBe(
      AlertStatus.UNUSUAL_EVOLUTION,
    );
    expect(applyPersistenceRule(AlertStatus.TO_CONFIRM, 1, 3)).toBe(AlertStatus.TO_CONFIRM);
    expect(applyPersistenceRule(AlertStatus.NORMAL, 1)).toBe(AlertStatus.NORMAL);
  });
});
