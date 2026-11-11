import type {
  ApiMeasurementRecord,
  ApiPatientHistory,
  BaselineFeatures,
  PatientDetailView,
  SessionView,
} from "./types";

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toSessionView(measurement: ApiMeasurementRecord): SessionView {
  const features = measurement.features ?? null;
  const gate = measurement.quality_gate ?? null;
  const comparison = measurement.baseline_comparison ?? null;

  return {
    measurementId: measurement.measurementId ?? measurement.id ?? "",
    recordedAt: measurement.recordedAt ?? null,
    stftPreview:
      measurement.stft_preview ??
      (Array.isArray((measurement as Record<string, unknown>).spectrogramJson)
        ? ((measurement as Record<string, unknown>).spectrogramJson as number[][])
        : null),
    status: measurement.status,
    rejectReason: measurement.rejectReason ?? null,
    rmsG: numberOrNull(features?.rms) ?? numberOrNull(measurement.rmsValue),
    peakFreqHz:
      numberOrNull(features?.dominant_freq_hz) ?? numberOrNull(measurement.dominantFreqHz),
    stenosisRatio:
      numberOrNull(features?.stenosis_ratio) ?? numberOrNull(measurement.highLowEnergyRatio),
    deviationScore:
      numberOrNull(comparison?.deviation_score) ?? numberOrNull(measurement.baselineDeviationScore),
    isUnusualEvolution:
      comparison?.is_unusual_evolution ?? measurement.status === "UNUSUAL_EVOLUTION",
    explanation: comparison?.clinical_explanation ?? null,
    cleanDurationSec:
      numberOrNull(gate?.clean_duration_sec) ?? numberOrNull(measurement.cleanDurationSec),
    artifactPct:
      numberOrNull(gate?.artifact_ratio_pct) ?? numberOrNull(measurement.artifactRatioPct),
    avgPressureKpa: numberOrNull(gate?.avg_pressure_kpa) ?? numberOrNull(measurement.avgPressureKpa),
  };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deriveBaseline(sessions: SessionView[]): BaselineFeatures | null {
  const valid = sessions
    .filter((session) => session.status !== "REJECTED_QUALITY" && session.rmsG !== null)
    .slice(0, 3);

  if (valid.length < 3) return null;

  const rmsG = mean(valid.map((session) => session.rmsG as number));
  const peakFreqHz = mean(
    valid
      .map((session) => session.peakFreqHz)
      .filter((value): value is number => value !== null),
  );
  const stenosisRatio = mean(
    valid
      .map((session) => session.stenosisRatio)
      .filter((value): value is number => value !== null),
  );

  if (rmsG === null || peakFreqHz === null) return null;

  return { rmsG, peakFreqHz, stenosisRatio };
}

export function toPatientDetailView(history: ApiPatientHistory): PatientDetailView {
  const sessions = (history.measurements ?? []).map(toSessionView);

  const allDated = sessions.length > 0 && sessions.every((session) => session.recordedAt !== null);
  if (allDated) {
    sessions.sort(
      (left, right) =>
        new Date(left.recordedAt as string).getTime() - new Date(right.recordedAt as string).getTime(),
    );
  } else {
    // The API serves history newest first; the view keeps sessions oldest first for the chart.
    sessions.reverse();
  }

  const validCount = sessions.filter(
    (session) => session.status !== "REJECTED_QUALITY" && session.rmsG !== null,
  ).length;

  return {
    idPseudo: history.idPseudo,
    fistulaType: history.fistulaType,
    armSide: history.armSide,
    baselineLocked: history.baselineLocked,
    baselineStep: Math.min(validCount, 3),
    baselineFeatures: history.baselineLocked ? deriveBaseline(sessions) : null,
    latestStatus: sessions.length > 0 ? sessions[sessions.length - 1]!.status : null,
    sessions,
  };
}

export function countConsecutiveAbove(sessions: SessionView[], threshold: number): number {
  let count = 0;
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const score = sessions[index]!.deviationScore;
    if (score === null || score <= threshold) break;
    count += 1;
  }
  return count;
}

export function latestValidSession(sessions: SessionView[]): SessionView | null {
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const session = sessions[index]!;
    if (session.status !== "REJECTED_QUALITY") return session;
  }
  return null;
}
