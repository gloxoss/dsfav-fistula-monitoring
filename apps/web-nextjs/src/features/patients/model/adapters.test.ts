import { describe, expect, it } from "vitest";
import type { ApiPatientHistory } from "./types";
import { countConsecutiveAbove, toPatientDetailView } from "./adapters";

function buildRawHistory(): ApiPatientHistory {
  return {
    idPseudo: "PT-CAS-8841",
    fistulaType: "RADIO_CEPHALIC",
    armSide: "LEFT",
    baselineLocked: true,
    baselineVector: null,
    measurements: [
      {
        id: "m-3",
        recordedAt: "2026-11-03T07:52:00.000Z",
        captureDurationSec: 25,
        cleanDurationSec: 22.9,
        avgPressureKpa: 4.6,
        status: "UNUSUAL_EVOLUTION",
        rejectReason: "NONE",
        rmsValue: 0.102,
        peakAmplitude: 0.4,
        dominantFreqHz: 184,
        highLowEnergyRatio: 1.44,
        baselineDeviationScore: 3.8,
      },
      {
        id: "m-2",
        recordedAt: "2026-11-02T07:52:00.000Z",
        captureDurationSec: 25,
        cleanDurationSec: 21.5,
        avgPressureKpa: 4.4,
        status: "TO_CONFIRM",
        rejectReason: "NONE",
        rmsValue: 0.121,
        peakAmplitude: 0.42,
        dominantFreqHz: 96,
        highLowEnergyRatio: 0.72,
        baselineDeviationScore: 3.6,
      },
      {
        id: "m-1",
        recordedAt: "2026-11-01T07:52:00.000Z",
        captureDurationSec: 25,
        cleanDurationSec: 23.4,
        avgPressureKpa: 4.2,
        status: "NORMAL",
        rejectReason: "NONE",
        rmsValue: 0.145,
        peakAmplitude: 0.45,
        dominantFreqHz: 68,
        highLowEnergyRatio: 0.32,
        baselineDeviationScore: 1.1,
      },
    ],
  } as unknown as ApiPatientHistory;
}

describe("toPatientDetailView", () => {
  it("[UC8] maps the flat history rows served by the API into session views", () => {
    const view = toPatientDetailView(buildRawHistory());

    expect(view.sessions).toHaveLength(3);
    const latest = view.sessions[2]!;
    expect(latest.measurementId).toBe("m-3");
    expect(latest.recordedAt).toBe("2026-11-03T07:52:00.000Z");
    expect(latest.status).toBe("UNUSUAL_EVOLUTION");
    expect(latest.rmsG).toBeCloseTo(0.102);
    expect(latest.peakFreqHz).toBeCloseTo(184);
    expect(latest.stenosisRatio).toBeCloseTo(1.44);
    expect(latest.deviationScore).toBeCloseTo(3.8);
    expect(latest.cleanDurationSec).toBeCloseTo(22.9);
    expect(latest.avgPressureKpa).toBeCloseTo(4.6);
    expect(latest.isUnusualEvolution).toBe(true);
    expect(view.latestStatus).toBe("UNUSUAL_EVOLUTION");
    expect(view.baselineFeatures?.rmsG).toBeCloseTo(0.122666, 4);
    expect(countConsecutiveAbove(view.sessions, 3.4)).toBe(2);
  });

  it("[UC8] still maps the nested contract shape", () => {
    const history = {
      idPseudo: "PT-CAS-8841",
      fistulaType: "RADIO_CEPHALIC",
      armSide: "LEFT",
      baselineLocked: false,
      baselineVector: null,
      measurements: [
        {
          measurementId: "m-9",
          recordedAt: "2026-11-04T07:52:00.000Z",
          status: "NORMAL",
          rejectReason: null,
          features: { rms: 0.148, dominant_freq_hz: 70, stenosis_ratio: 0.3 },
          quality_gate: {
            clean_duration_sec: 22.1,
            artifact_ratio_pct: 8.2,
            avg_pressure_kpa: 4.5,
          },
          baseline_comparison: {
            deviation_score: 1.2,
            is_unusual_evolution: false,
            clinical_explanation: "Signal stable.",
          },
        },
      ],
    } as unknown as ApiPatientHistory;

    const view = toPatientDetailView(history);
    const session = view.sessions[0]!;

    expect(session.measurementId).toBe("m-9");
    expect(session.rmsG).toBeCloseTo(0.148);
    expect(session.peakFreqHz).toBeCloseTo(70);
    expect(session.stenosisRatio).toBeCloseTo(0.3);
    expect(session.deviationScore).toBeCloseTo(1.2);
    expect(session.cleanDurationSec).toBeCloseTo(22.1);
    expect(session.artifactPct).toBeCloseTo(8.2);
    expect(session.avgPressureKpa).toBeCloseTo(4.5);
    expect(session.explanation).toBe("Signal stable.");
  });
});
