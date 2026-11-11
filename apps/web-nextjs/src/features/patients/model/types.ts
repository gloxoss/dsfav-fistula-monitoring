import type { components } from "@dsfav/shared-types";
import type { AiOpinion } from "@/features/ai/types";

export type ClinicalStatus = components["schemas"]["Status"];
export type ApiConfig = components["schemas"]["ConfigVersionResponse"];
export type ApiPatientSummary = components["schemas"]["PatientSummary"];
export type ApiClinicalNote = components["schemas"]["ClinicalNote"];

type PatientHistoryBase = components["schemas"]["PatientHistoryResponse"];
export type ApiMeasurement = components["schemas"]["MeasurementResultDto"];

export interface ApiMeasurementFeatures {
  rms?: number | null;
  dominant_freq_hz?: number | null;
  stenosis_ratio?: number | null;
}

export interface ApiMeasurementQualityGate {
  clean_duration_sec?: number | null;
  artifact_ratio_pct?: number | null;
  avg_pressure_kpa?: number | null;
}

export interface ApiMeasurementComparison {
  deviation_score?: number | null;
  is_unusual_evolution?: boolean;
  clinical_explanation?: string | null;
}

/**
 * History rows as served at runtime. The API currently returns flat database
 * fields (id, rmsValue, dominantFreqHz, highLowEnergyRatio, baselineDeviationScore)
 * while the frozen contract nests them under features/quality_gate/baseline_comparison.
 * The view adapter accepts both until T-s07 aligns the service with the contract.
 */
export type ApiMeasurementRecord = Partial<ApiMeasurement> & {
  id?: string;
  recordedAt?: string | null;
  stft_preview?: number[][];
  captureDurationSec?: number | null;
  cleanDurationSec?: number | null;
  avgPressureKpa?: number | null;
  rmsValue?: number | null;
  peakAmplitude?: number | null;
  dominantFreqHz?: number | null;
  highLowEnergyRatio?: number | null;
  baselineDeviationScore?: number | null;
  artifactRatioPct?: number | null;
};

export type ApiPatientHistory = Omit<PatientHistoryBase, "measurements"> & {
  measurements?: ApiMeasurementRecord[];
};

export interface BaselineFeatures {
  rmsG: number;
  peakFreqHz: number;
  stenosisRatio: number | null;
}

export interface PatientNote {
  id: string;
  text: string;
  createdAt: string;
  authorLabel?: string;
}

export interface SessionView {
  measurementId: string;
  /** optional explainable second opinion; never changes the status */
  aiOpinion?: AiOpinion | null;
  recordedAt: string | null;
  stftPreview?: number[][] | null;
  status: ClinicalStatus;
  rejectReason: string | null;
  rmsG: number | null;
  peakFreqHz: number | null;
  stenosisRatio: number | null;
  deviationScore: number | null;
  isUnusualEvolution: boolean;
  explanation: string | null;
  cleanDurationSec: number | null;
  artifactPct: number | null;
  avgPressureKpa: number | null;
}

export interface PatientDetailView {
  idPseudo: string;
  fistulaType: string;
  armSide: string;
  baselineLocked: boolean;
  baselineStep: number;
  baselineFeatures: BaselineFeatures | null;
  latestStatus: ClinicalStatus | null;
  sessions: SessionView[];
}

export interface FollowUpInput {
  idPseudo: string;
  measurementId: string;
  reason?: string | null;
}

export interface AddNoteInput {
  idPseudo: string;
  text: string;
  measurementId?: string | null;
}

export interface RebaselineInput {
  idPseudo: string;
  reason: string;
}

export type FollowUpAction = (input: FollowUpInput) => Promise<void>;
export type AddNoteAction = (input: AddNoteInput) => Promise<void>;
export type RebaselineAction = (input: RebaselineInput) => Promise<void>;
