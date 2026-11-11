import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PressureGauge } from "./pressure-gauge";

describe("PressureGauge component", () => {
  it("[UC2] PressureGauge places the knob in the right zone for 1.8, 2.7, 4.8, 8.7, 10.2 kPa", () => {
    const testCases = [
      { kpa: 1.8, expectedZone: "Insuffisant", expectedStatus: "critical" },
      { kpa: 2.7, expectedZone: "Toléré (faible)", expectedStatus: "warning" },
      { kpa: 4.8, expectedZone: "Recommandé", expectedStatus: "normal" },
      { kpa: 8.7, expectedZone: "Toléré (élevé)", expectedStatus: "warning" },
      { kpa: 10.2, expectedZone: "Risque de compression", expectedStatus: "critical" },
    ];

    for (const { kpa, expectedZone, expectedStatus } of testCases) {
      const { unmount } = render(<PressureGauge value={kpa} />);

      const knob = screen.getByTestId("pressure-gauge-knob");
      expect(knob).toBeInTheDocument();
      expect(knob).toHaveAttribute("data-zone", expectedZone);
      expect(knob).toHaveAttribute("data-status", expectedStatus);
      expect(knob).toHaveAttribute("role", "slider");
      expect(knob).toHaveAttribute("aria-label", "Pression de contact mesurée");
      expect(knob).toHaveAttribute("aria-valuenow", String(kpa));
      expect(knob).toHaveAttribute(
        "aria-valuetext",
        `${kpa.toFixed(1).replace(".", ",")} kPa - Zone ${expectedZone}`,
      );

      // Label under or next to the knob
      expect(screen.getByTestId("pressure-gauge-zone-label")).toHaveTextContent(expectedZone);

      unmount();
    }
  });

  it("[UC2] PressureGauge reads pressure zones from props (config), not constants", () => {
    // Custom clinical configuration passed through props
    const customConfig = {
      min: 0,
      max: 15,
      zones: [
        { id: "custom_low", label: "Trop bas", min: 0, max: 4.0, status: "critical" as const },
        { id: "custom_ok", label: "Parfait", min: 4.0, max: 10.0, status: "normal" as const },
        { id: "custom_high", label: "Trop fort", min: 10.0, max: 15.0, status: "critical" as const },
      ],
    };

    const { unmount } = render(<PressureGauge value={5.5} config={customConfig} />);
    const knob = screen.getByTestId("pressure-gauge-knob");
    expect(knob).toHaveAttribute("data-zone", "Parfait");
    expect(knob).toHaveAttribute("data-status", "normal");
    expect(screen.getByTestId("pressure-gauge-zone-label")).toHaveTextContent("Parfait");
    unmount();
  });

  it("[UC2] stacks active zone label and recommended range on two separate lines", () => {
    render(<PressureGauge value={4.8} />);
    const label = screen.getByTestId("pressure-gauge-zone-label");
    const parent = label.parentElement;
    expect(parent).not.toBeNull();
    // Parent container must have flex-col to stack the active zone and recommended range
    expect(parent).toHaveClass("flex-col");
    expect(screen.getByText(/Plage recommandée : 3,0 à 8,5 kPa/)).toBeInTheDocument();
  });
});
