import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AiOpinionCard } from "./ai-opinion-card";
import type { AiOpinion } from "../types";

afterEach(cleanup);

const opinion: AiOpinion = {
  level: "50",
  evidence: {
    features: [{ name: "rms", value: 0.14 }],
    baselineValues: [{ name: "rms", value: 0.12 }],
    topContributors: ["rms"],
  },
  modelVersion: "dsfav-logreg-v1",
  dataLabel: "Données synthétiques, non cliniques",
};

describe("AiOpinionCard", () => {
  it("[UC7] renders nothing when the opinion is absent or baseline is building", () => {
    const { container, rerender } = render(<AiOpinionCard aiOpinion={null} baselineBuilding={false} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AiOpinionCard aiOpinion={opinion} baselineBuilding />);
    expect(container).toBeEmptyDOMElement();
  });

  it("[UC7] [DISCLAIMER] shows evidence before level and the exact disclaimer", () => {
    render(<AiOpinionCard aiOpinion={opinion} baselineBuilding={false} />);
    expect(screen.getByRole("heading", { name: "Avis complémentaire" })).toBeInTheDocument();
    expect(screen.getByText("rms : 0,14")).toBeInTheDocument();
    expect(screen.getByText("Niveau estimé : 50")).toBeInTheDocument();
    expect(screen.getByText("Données synthétiques, non cliniques")).toBeInTheDocument();
    expect(screen.getByText("rms : 0,14").compareDocumentPosition(screen.getByText("Niveau estimé : 50")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("note")).toHaveTextContent("Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.");
  });
});
