import type { ClinicalStatus } from "@/components/ui/status-pill";
import type { AiOpinion } from "@/features/ai/types";

export type { ClinicalStatus };

export type FistulaType = "radio-céphalique" | "brachio-céphalique" | "brachio-basilique";
export type FistulaSide = "gauche" | "droite";

export interface PatientSummary {
  idPseudo: string;
  fistulaType: FistulaType;
  side: FistulaSide;
  sessionsCount: number;
  baselineStatus: "ACTIVE" | "BUILDING" | "NONE";
  baselineStep?: number;
  lastMeasurementDate?: string;
  lastStatus?: ClinicalStatus;
}

export interface DeviceInfo {
  id: string;
  name: string;
  batteryPct: number;
  connected: boolean;
  syncState: "SYNCED" | "SYNCING" | "QUEUED_OFFLINE" | "FAILED";
  macTail: string;
  firmwareVersion: string;
  estimatedMeasuresLeft: number;
  /** ISO time of the last contact; absent for demo devices */
  lastSeenAt?: string;
}

export interface CaptureFrame {
  timestampSec: number;
  thrillValue: number;
  motionValue: number;
  pressureKpa: number;
  isArtifact: boolean;
}

export interface QualityMetrics {
  cleanDurationSec: number;
  targetDurationSec: number;
  rmsG: number | null;
  peakFreqHz: number | null;
  artifactPct: number;
  meanPressureKpa: number;
}

export interface CaptureResult {
  status: ClinicalStatus;
  /** optional explainable second opinion; never changes the status */
  aiOpinion?: AiOpinion | null;
  idPseudo: string;
  cleanDurationSec: number;
  artifactPct: number;
  meanPressureKpa: number;
  rmsG: number;
  peakFreqHz: number;
  stenosisRatio?: number;
  deviationScore?: number;
  threshold?: number;
  deltaRmsPct?: number;
  baselineStep?: number;
  totalBaselineSteps?: number;
  attemptsCount: number;
  maxAttempts?: number;
  rejectionReason?: "mouvement du bras" | "pression insuffisante" | "risque de compression" | string;
  explanation?: string;
  historyRmsBaseline?: number;
  baselinePeakFreqHz?: number;
  baselineStenosisRatio?: number;
  stftPreview?: number[][] | null;
  demo?: boolean;
}

export type CaptureStreamStatus =
  | "idle"
  | "ready"
  | "capturing"
  | "paused_pressure_lost"
  | "analyzing"
  | "completed"
  | "rejected"
  | "offline_queued"
  | "error";
