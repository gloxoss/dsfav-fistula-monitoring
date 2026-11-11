import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PatientDetail } from "./patient-detail";
import { DISCLAIMER } from "@/libs/clinical/disclaimer";
import type { PatientDetailView, SessionView } from "../model/types";

afterEach(cleanup);

const aiOpinion = {
  level: "50",
  evidence: {
    features: [{ name: "rms", value: 0.14 }],
    baselineValues: [{ name: "rms", value: 0.12 }],
    topContributors: ["rms"],
  },
  modelVersion: "synthetic-v1",
  dataLabel: "Données synthétiques, non cliniques",
};

function session(index: number, overrides: Partial<SessionView> = {}): SessionView {
  return {
    measurementId: `m-${index}`,
    recordedAt: `2026-11-0${index + 1}T08:00:00.000Z`,
    status: "NORMAL",
    rejectReason: null,
    rmsG: 0.14,
    peakFreqHz: 68,
    stenosisRatio: 0.3,
    deviationScore: 0.2,
    cleanDurationSec: 24,
    artifactRatioPct: 4,
    avgPressureKpa: 4.6,
    explanation: "Signal stable.",
    isUnusualEvolution: false,
    ...overrides,
  } as SessionView;
}

function patient(sessions: SessionView[], baselineLocked = true): PatientDetailView {
  return {
    idPseudo: "PT-CAS-8841",
    fistulaType: "RADIO_CEPHALIC",
    armSide: "LEFT",
    baselineLocked,
    baselineStep: baselineLocked ? 3 : 1,
    baselineFeatures: baselineLocked ? { rmsG: 0.145, peakFreqHz: 68, stenosisRatio: 0.3 } : null,
    latestStatus: sessions.at(-1)?.status ?? null,
    sessions,
  } as PatientDetailView;
}

describe("PatientDetail AI second opinion [UC7] [UC8] [DISCLAIMER]", () => {
  it("[UC8] shows the Avis complémentaire card for the latest session when it carries an opinion", () => {
    render(<PatientDetail patient={patient([session(0), session(1, { aiOpinion })])} thresholdSigma={3.4} />);
    expect(screen.getByRole("heading", { name: "Avis complémentaire" })).toBeInTheDocument();
  }, 15000);

  it("hides the card when the latest session has no opinion", () => {
    render(<PatientDetail patient={patient([session(0, { aiOpinion }), session(1)])} thresholdSigma={3.4} />);
    expect(screen.queryByRole("heading", { name: "Avis complémentaire" })).toBeNull();
  });

  it("[UC7] hides the card while the latest session is BASELINE_BUILDING", () => {
    render(
      <PatientDetail
        patient={patient([session(0, { status: "BASELINE_BUILDING", aiOpinion })], false)}
        thresholdSigma={3.4}
      />,
    );
    expect(screen.queryByRole("heading", { name: "Avis complémentaire" })).toBeNull();
  });

  it("[DISCLAIMER] keeps exactly one verbatim disclaimer with the AI card shown", () => {
    render(<PatientDetail patient={patient([session(0), session(1, { aiOpinion })])} thresholdSigma={3.4} />);
    expect(screen.getAllByText(DISCLAIMER)).toHaveLength(1);
  });
});
