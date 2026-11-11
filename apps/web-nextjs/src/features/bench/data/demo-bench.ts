import type {
  BenchObjectiveData,
  BenchSessionResult,
  BenchSessionSummary,
  BenchSetup,
} from "../model/types";

export const DEMO_BENCH_SETUP: BenchSetup = {
  pumpFlowMlMin: 450,
  clampStenosisPct: 50,
};

export const DEMO_BENCH_SESSION: BenchSessionSummary = {
  id: "22222222-2222-4222-8222-222222222222",
  internId: "33333333-3333-4333-8333-333333333333",
  measurementId: "44444444-4444-4444-8444-444444444444",
  pumpFlowMlMin: 450,
  clampStenosisPct: 50,
  perceivedThrill: "SYSTOLIC_ROUGH",
  perceivedIntensity: 4,
  concordanceScore: 92,
  createdAt: "2026-11-03T09:12:00.000Z",
};

export const DEMO_BENCH_NOTES =
  "Frémissement perçu modéré avec renforcement systolique en fin de diastole.";

export const DEMO_BENCH_OBJECTIVE: BenchObjectiveData = {
  rmsG: 0.094,
  peakFreqHz: 178,
  ratioHighLow: 1.42,
};

export const DEMO_BENCH_RESULT: BenchSessionResult = {
  sessionId: DEMO_BENCH_SESSION.id,
  internId: DEMO_BENCH_SESSION.internId,
  measurementId: DEMO_BENCH_SESSION.measurementId ?? "",
  pumpFlowMlMin: 450,
  clampStenosisPct: 50,
  perceivedThrill: "SYSTOLIC_ROUGH",
  perceivedIntensity: 4,
  concordanceScore: 92,
  expectedProfile: "SYSTOLIC_ROUGH",
  concordanceBreakdown: {
    sensationScorePct: 55,
    intensityScorePct: 22,
    notesScorePct: 15,
  },
  internNotes: DEMO_BENCH_NOTES,
  disclaimer: "Simulation sur banc, pas de donnée patient",
};
