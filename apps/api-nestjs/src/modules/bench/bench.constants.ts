import { PerceivedThrill } from '@prisma/client';

export const BENCH_NOTICE = 'Simulation sur banc, pas de donnée patient';
export const EXPECTED_PROFILE_LABEL = 'profil attendu : à calibrer';

export const PERCEIVED_THRILL_SCALE: PerceivedThrill[] = [
  PerceivedThrill.ABSENT,
  PerceivedThrill.WEAK_DAMPENED,
  PerceivedThrill.CONTINUOUS_SOFT,
  PerceivedThrill.SYSTOLIC_ROUGH,
  PerceivedThrill.HYPERPULSATILE,
];

export const BENCH_CLAMP_STENOSIS_VALUES = [0, 30, 50, 75] as const;

export const CONCORDANCE_WEIGHTS = {
  sensationPct: 60,
  intensityPct: 25,
  notesPct: 15,
} as const;

// Placeholder table: the canonical spec leaves these values "à calibrer au banc".
export const PLACEHOLDER_EXPECTED_PROFILES: Record<number, PerceivedThrill> = {
  0: PerceivedThrill.CONTINUOUS_SOFT,
  30: PerceivedThrill.CONTINUOUS_SOFT,
  50: PerceivedThrill.SYSTOLIC_ROUGH,
  75: PerceivedThrill.HYPERPULSATILE,
};

// Placeholder calibration values: replace with real bench measurements before clinical use.
export const PLACEHOLDER_ZERO_STENOSIS_RMS_AT_450_ML_MIN = 0.1;
export const PLACEHOLDER_INTENSITY_RATIO_BOUNDS = [1.15, 1.35, 1.6, 1.9] as const;
