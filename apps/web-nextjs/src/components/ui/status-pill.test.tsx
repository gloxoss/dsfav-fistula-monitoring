import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill, type ClinicalStatus } from "./status-pill";

describe("StatusPill component", () => {
  const statuses: { status: ClinicalStatus; expectedWord: string }[] = [
    { status: "NORMAL", expectedWord: "Normal" },
    { status: "TO_CONFIRM", expectedWord: "À confirmer" },
    { status: "UNUSUAL_EVOLUTION", expectedWord: "Évolution inhabituelle" },
    { status: "REJECTED_QUALITY", expectedWord: "Qualité rejetée" },
    { status: "BASELINE_BUILDING", expectedWord: "Baseline en cours" },
  ];

  it("[UC9] StatusPill renders icon + French word for each of the 5 statuses (never color only)", () => {
    for (const { status, expectedWord } of statuses) {
      const { unmount } = render(<StatusPill status={status} />);
      const textElement = screen.getByText(expectedWord);
      expect(textElement).toBeInTheDocument();

      // Ensure an icon is present alongside text (never color only)
      const pill = textElement.closest("[role='status']");
      expect(pill).not.toBeNull();
      const icon = pill?.querySelector("svg");
      expect(icon).not.toBeNull();

      unmount();
    }
  });

  it("[UC7] asserts that BASELINE_BUILDING produces no alert or warning styling", () => {
    const { container } = render(<StatusPill status="BASELINE_BUILDING" />);
    const pill = container.querySelector("[role='status']");
    expect(pill).toBeInTheDocument();
    // Clinical rule: No alert while BASELINE_BUILDING (README rule 5)
    expect(pill).not.toHaveClass("bg-warning-tint");
    expect(pill).not.toHaveClass("bg-critical-tint");
    expect(pill).not.toHaveClass("text-warning-text");
    expect(pill).not.toHaveClass("text-critical-text");
    expect(pill).toHaveClass("bg-well");
    expect(pill).toHaveClass("text-text-secondary");
  });
});
