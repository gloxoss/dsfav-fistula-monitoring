import { PerceivedThrill } from '@prisma/client';
import {
  CONCORDANCE_WEIGHTS,
  PERCEIVED_THRILL_SCALE,
  PLACEHOLDER_EXPECTED_PROFILES,
  PLACEHOLDER_INTENSITY_RATIO_BOUNDS,
  PLACEHOLDER_ZERO_STENOSIS_RMS_AT_450_ML_MIN,
} from './bench.constants.js';

export interface ConcordanceInput {
  perceivedThrill: PerceivedThrill;
  perceivedIntensity: number;
  internNotes?: string | null;
  expectedProfile: PerceivedThrill;
  measuredIntensityLevel: number;
}

export interface ConcordanceBreakdown {
  sensationScorePct: number;
  intensityScorePct: number;
  notesScorePct: number;
}

export interface ConcordanceResult {
  total: number;
  breakdown: ConcordanceBreakdown;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function expectedProfileFor(clampStenosisPct: number): PerceivedThrill {
  return PLACEHOLDER_EXPECTED_PROFILES[clampStenosisPct] ?? PerceivedThrill.CONTINUOUS_SOFT;
}

export function placeholderIntensityLevel(rmsValue: number, pumpFlowMlMin: number): number {
  const flow = pumpFlowMlMin > 0 ? pumpFlowMlMin : 450;
  const reference = PLACEHOLDER_ZERO_STENOSIS_RMS_AT_450_ML_MIN * (flow / 450);
  if (reference <= 0) return 1;
  const ratio = rmsValue / reference;
  let level = 1;
  for (const bound of PLACEHOLDER_INTENSITY_RATIO_BOUNDS) {
    if (ratio >= bound) level += 1;
  }
  return Math.min(5, level);
}

export function computeConcordance(input: ConcordanceInput): ConcordanceResult {
  const expectedIndex = PERCEIVED_THRILL_SCALE.indexOf(input.expectedProfile);
  const perceivedIndex = PERCEIVED_THRILL_SCALE.indexOf(input.perceivedThrill);
  const categoryDistance =
    expectedIndex === -1 || perceivedIndex === -1 ? Number.POSITIVE_INFINITY : Math.abs(expectedIndex - perceivedIndex);
  const sensationFactor = categoryDistance === 0 ? 1 : categoryDistance === 1 ? 0.5 : 0;

  const intensityDistance = Math.min(4, Math.abs(input.perceivedIntensity - input.measuredIntensityLevel));
  const intensityFactor = Math.max(0, 1 - intensityDistance / 4);

  const notesFactor = input.internNotes && input.internNotes.trim().length > 0 ? 1 : 0;

  const breakdown: ConcordanceBreakdown = {
    sensationScorePct: round2(sensationFactor * CONCORDANCE_WEIGHTS.sensationPct),
    intensityScorePct: round2(intensityFactor * CONCORDANCE_WEIGHTS.intensityPct),
    notesScorePct: round2(notesFactor * CONCORDANCE_WEIGHTS.notesPct),
  };
  const total = round2(
    breakdown.sensationScorePct + breakdown.intensityScorePct + breakdown.notesScorePct,
  );
  return { total, breakdown };
}
