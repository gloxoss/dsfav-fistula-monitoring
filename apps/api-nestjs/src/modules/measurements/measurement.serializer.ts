import { AlertStatus, MeasurementState, Prisma, RejectReason } from '@prisma/client';
import { CLINICAL_DISCLAIMER } from '../../common/constants.js';
import { DspResult } from './dsp.client.js';

export function serializeMeasurementResult(row: {
  id: string;
  state?: MeasurementState;
  status: AlertStatus | null;
  rejectReason: RejectReason;
  cleanDurationSec: number;
  artifactRatioPct: number;
  avgPressureKpa: number;
  rmsValue: number | null;
  peakAmplitude: number | null;
  dominantFreqHz: number | null;
  highLowEnergyRatio: number | null;
  baselineDeviationScore: number | null;
  spectrogramJson?: Prisma.JsonValue;
  aiOpinion?: Prisma.JsonValue | null;
}, dsp?: DspResult) {
  const rejected = row.status === AlertStatus.REJECTED_QUALITY;
  const labels: Record<AlertStatus, string> = {
    NORMAL: 'Mesure correcte',
    TO_CONFIRM: 'À confirmer à la prochaine séance',
    UNUSUAL_EVOLUTION: 'Évolution inhabituelle',
    REJECTED_QUALITY: 'Mesure non exploitable',
    BASELINE_BUILDING: 'Référence en cours de constitution',
  };
  const deviation = row.baselineDeviationScore;
  return {
    measurementId: row.id,
    state: row.state ?? (row.status ? MeasurementState.ANALYSED : MeasurementState.INIT),
    status: row.status,
    rejectReason: row.rejectReason,
    quality_gate: {
      passed: (row.state ?? (row.status ? MeasurementState.ANALYSED : MeasurementState.INIT)) === MeasurementState.ANALYSED && !rejected,
      clean_duration_sec: row.cleanDurationSec,
      artifact_ratio_pct: row.artifactRatioPct,
      avg_pressure_kpa: row.avgPressureKpa,
      reject_reason: row.rejectReason,
      message: rejected ? 'Qualité insuffisante' : 'Qualité conforme',
    },
    features: {
      rms: row.rmsValue ?? 0,
      peak_to_peak: row.peakAmplitude ?? 0,
      dominant_freq_hz: row.dominantFreqHz ?? 0,
      stenosis_ratio: row.highLowEnergyRatio ?? 0,
    },
    stft_preview: dsp?.stft ?? (Array.isArray(row.spectrogramJson) ? row.spectrogramJson : []),
    baseline_comparison: {
      deviation_score: deviation ?? 0,
      is_unusual_evolution: row.status === AlertStatus.UNUSUAL_EVOLUTION,
      status: row.status,
      alert_label: row.status ? labels[row.status] : null,
      clinical_explanation: dsp?.explanation ?? (row.status ? 'Référence en cours de constitution, aucune alerte.' : 'Analyse non réalisée.'),
      disclaimer: CLINICAL_DISCLAIMER,
    },
    ...(dsp?.aiOpinion ? { aiOpinion: dsp.aiOpinion } : row.aiOpinion ? { aiOpinion: row.aiOpinion } : {}),
    disclaimer: CLINICAL_DISCLAIMER,
  };
}
