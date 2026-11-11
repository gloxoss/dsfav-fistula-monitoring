import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResultCard } from "./result-card";
import { DISCLAIMER } from "@/libs/clinical/disclaimer";
import type { CaptureResult } from "../model/types";

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

const base: CaptureResult = {
  status: "NORMAL",
  idPseudo: "PT-CAS-8841",
  cleanDurationSec: 22.9,
  artifactPct: 8.2,
  meanPressureKpa: 4.6,
  rmsG: 0.142,
  peakFreqHz: 68,
  deviationScore: 0.2,
  attemptsCount: 1,
};

describe("ResultCard AI second opinion [UC7] [UC9] [DISCLAIMER]", () => {
  it("[UC9] shows the Avis complémentaire card with its evidence when an opinion is present", () => {
    render(<ResultCard result={{ ...base, aiOpinion }} />);
    expect(screen.getByRole("heading", { name: "Avis complémentaire" })).toBeInTheDocument();
    expect(screen.getByText("Caractéristiques mesurées")).toBeInTheDocument();
    expect(screen.getByText("Données synthétiques, non cliniques")).toBeInTheDocument();
  });

  it("hides the card when no opinion is present", () => {
    render(<ResultCard result={base} />);
    expect(screen.queryByRole("heading", { name: "Avis complémentaire" })).toBeNull();
  });

  it("[UC7] hides the card while the baseline is building, even if an opinion is present", () => {
    render(<ResultCard result={{ ...base, status: "BASELINE_BUILDING", baselineStep: 1, totalBaselineSteps: 3, aiOpinion }} />);
    expect(screen.queryByRole("heading", { name: "Avis complémentaire" })).toBeNull();
  });

  it("[DISCLAIMER] keeps exactly one verbatim disclaimer on the result card with the AI card shown", () => {
    render(<ResultCard result={{ ...base, aiOpinion }} />);
    expect(screen.getAllByText(DISCLAIMER)).toHaveLength(1);
  });
});
