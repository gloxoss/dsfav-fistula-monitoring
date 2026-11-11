import { CLINICAL_DISCLAIMER } from '../../common/constants.js';

export interface HistoryMeasurementRow {
  id: string;
  recordedAt: Date;
  captureDurationSec: number;
  cleanDurationSec: number;
  avgPressureKpa: number;
  artifactRatioPct: number;
  status: string;
  rejectReason: string;
  rmsValue: number | null;
  peakAmplitude: number | null;
  dominantFreqHz: number | null;
  highLowEnergyRatio: number | null;
  baselineDeviationScore: number | null;
  spectrogramJson?: unknown;
}

function alertLabel(status: string): string {
  switch (status) {
    case 'TO_CONFIRM': return 'À confirmer à la prochaine séance';
    case 'UNUSUAL_EVOLUTION': return 'Évolution inhabituelle';
    case 'REJECTED_QUALITY': return 'Mesure non exploitable';
    case 'BASELINE_BUILDING': return 'Référence en cours de constitution';
    default: return 'Mesure correcte';
  }
}

export function serializeHistory(rows: HistoryMeasurementRow[]) {
  return [...rows]
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
    .map((row) => {
      const passed = row.status !== 'REJECTED_QUALITY';
      return {
        measurementId: row.id,
        recordedAt: row.recordedAt.toISOString(),
        status: row.status,
        rejectReason: row.rejectReason,
        quality_gate: {
          passed,
          clean_duration_sec: row.cleanDurationSec,
          artifact_ratio_pct: row.artifactRatioPct,
          avg_pressure_kpa: row.avgPressureKpa,
          reject_reason: row.rejectReason,
          message: passed ? 'Qualité conforme' : 'Qualité insuffisante',
        },
        features: {
          rms: row.rmsValue ?? 0,
          peak_to_peak: row.peakAmplitude ?? 0,
          dominant_freq_hz: row.dominantFreqHz ?? 0,
          stenosis_ratio: row.highLowEnergyRatio ?? 0,
        },
        stft_preview: Array.isArray(row.spectrogramJson) ? row.spectrogramJson : [],
        baseline_comparison: {
          deviation_score: row.baselineDeviationScore ?? 0,
          is_unusual_evolution: row.status === 'UNUSUAL_EVOLUTION',
          status: row.status,
          alert_label: alertLabel(row.status),
          clinical_explanation: row.baselineDeviationScore === null
            ? 'Référence en cours de constitution, aucune alerte.'
            : `Écart calculé : ${row.baselineDeviationScore.toFixed(2).replace('.', ',')}.`,
          disclaimer: CLINICAL_DISCLAIMER,
        },
        disclaimer: CLINICAL_DISCLAIMER,
      };
    });
}
