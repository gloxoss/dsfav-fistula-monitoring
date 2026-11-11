import { AlertStatus } from '@prisma/client';

const BASELINE_SIZE = 3;

export interface BaselineProgress {
  status: AlertStatus;
  acceptedCount: number;
  shouldLock: boolean;
}

export function baselineProgress(
  acceptedCount: number,
  locked: boolean,
  incomingStatus: AlertStatus,
): BaselineProgress {
  if (locked) {
    return { status: incomingStatus, acceptedCount, shouldLock: false };
  }

  if (incomingStatus === AlertStatus.REJECTED_QUALITY) {
    return { status: incomingStatus, acceptedCount, shouldLock: false };
  }

  const nextCount = acceptedCount + 1;
  return {
    status: AlertStatus.BASELINE_BUILDING,
    acceptedCount: nextCount,
    shouldLock: nextCount >= BASELINE_SIZE,
  };
}

export function applyPersistenceRule(
  status: AlertStatus,
  previousConsecutiveAbove: number,
  consecutiveRequired = 2,
): AlertStatus {
  if (status === AlertStatus.TO_CONFIRM && previousConsecutiveAbove >= consecutiveRequired - 1) {
    return AlertStatus.UNUSUAL_EVOLUTION;
  }
  return status;
}
