import type { components } from "@dsfav/shared-types";

export type BenchSessionSummary = components["schemas"]["BenchSessionSummary"];
export type BenchSessionResult = components["schemas"]["BenchSessionResult"];
export type PerceivedThrill = components["schemas"]["PerceivedThrill"];

export type ClampStenosisPct = 0 | 30 | 50 | 75;

export type BenchStep = 1 | 2 | 3;

export interface BenchSetup {
  pumpFlowMlMin: number;
  clampStenosisPct: ClampStenosisPct;
}

export interface PalpationInput {
  perceivedThrill: PerceivedThrill;
  perceivedIntensity: number;
  internNotes: string | null;
}

export interface BenchObjectiveData {
  rmsG: number | null;
  peakFreqHz: number | null;
  ratioHighLow: number | null;
}

export interface BenchCaptureResult {
  status: string;
  rmsG?: number;
  peakFreqHz?: number;
  ratioHighLow?: number;
  rejectionReason?: string;
}

export interface BenchCaptureRejection {
  message: string;
}
