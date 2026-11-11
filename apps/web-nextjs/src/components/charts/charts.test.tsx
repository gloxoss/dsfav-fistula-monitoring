import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SessionTrendChart } from "./session-trend-chart";
import { Sparkline } from "./sparkline";
import { ReferenceBarChart } from "./reference-bar-chart";
import { SpectrogramChart } from "./spectrogram-chart";
import { PressureStrip } from "./pressure-strip";

describe("Medical Chart Components [UC8] [UC2]", () => {
  afterEach(() => {
    cleanup();
  });

  describe("SessionTrendChart [UC8]", () => {
    const mockSessions = [
      {
        measurementId: "m-01",
        recordedAt: "2026-11-01T10:00:00Z",
        rmsG: 0.125,
        status: "NORMAL" as const,
      },
      {
        measurementId: "m-02",
        recordedAt: "2026-11-03T10:00:00Z",
        rmsG: 0.138,
        status: "NORMAL" as const,
      },
      {
        measurementId: "m-03",
        recordedAt: "2026-11-05T10:00:00Z",
        rmsG: 0.192,
        status: "UNUSUAL_EVOLUTION" as const,
      },
    ];

    it("[UC8] renders trend chart with French title, baseline line, and points count", () => {
      render(
        <SessionTrendChart
          sessions={mockSessions}
          baseline={{ rmsG: 0.130, peakFreqHz: 75, stenosisRatio: 0.35 }}
          thresholdRms={0.180}
        />,
      );

      expect(screen.getByText("RMS par séance")).toBeInTheDocument();
      expect(screen.getAllByText("Baseline").length).toBeGreaterThan(0);
      expect(screen.getByText("Seuil d'alerte")).toBeInTheDocument();
      // Accessible data table should contain the values
      const table = screen.getByRole("table", { name: /valeurs rms par séance/i });
      expect(table).toBeInTheDocument();
      expect(screen.getByText("0,125 g")).toBeInTheDocument();
      expect(screen.getByText("0,192 g")).toBeInTheDocument();
    }, 20000);

    it("[UC8] handles multiple sessions on the same date with distinct times or one label per day, at most 6 labels", () => {
      const sameDaySessions = [
        { measurementId: "s-1", recordedAt: "2026-11-08T08:00:00Z", rmsG: 0.12, status: "NORMAL" as const },
        { measurementId: "s-2", recordedAt: "2026-11-08T11:30:00Z", rmsG: 0.13, status: "NORMAL" as const },
        { measurementId: "s-3", recordedAt: "2026-11-08T14:15:00Z", rmsG: 0.14, status: "NORMAL" as const },
        { measurementId: "s-4", recordedAt: "2026-11-09T09:00:00Z", rmsG: 0.15, status: "NORMAL" as const },
        { measurementId: "s-5", recordedAt: "2026-11-09T13:00:00Z", rmsG: 0.16, status: "NORMAL" as const },
        { measurementId: "s-6", recordedAt: "2026-11-10T10:00:00Z", rmsG: 0.17, status: "NORMAL" as const },
        { measurementId: "s-7", recordedAt: "2026-11-11T10:00:00Z", rmsG: 0.18, status: "NORMAL" as const },
      ];

      render(<SessionTrendChart sessions={sameDaySessions} />);
      // Axis labels should show time when same day or be unique per day, never repeating identical strings blindly
      const points = screen.getAllByTestId("rms-chart-point");
      expect(points.length).toBe(7);
      // Verify sr-only or axis formats times or avoids raw repeating "08/11" with no distinction
      expect(screen.getAllByText(/08\/11 08:00|08\/11 08h|08:00/).length).toBeGreaterThan(0);
    }, 20000);
  });

  describe("Sparkline [UC8]", () => {
    it("[UC8] renders accessible sparkline with formatted values", () => {
      render(<Sparkline values={[0.12, 0.14, 0.18]} label="Évolution RMS" unit="g" />);
      const el = screen.getByRole("img", { name: /Évolution RMS/i });
      expect(el).toBeInTheDocument();
      expect(el.getAttribute("aria-label")).toContain("0,12");
      expect(el.getAttribute("aria-label")).toContain("0,18");
    });

    it("[UC8] sparkline uses sensible y-domain starting at 0 for energy/pressure and renders baseline line with lighter stroke", () => {
      const { container } = render(
        <Sparkline
          values={[0.145, 0.190]}
          baseline={0.140}
          unit="g"
          startAtZero
          label="Évolution RMS"
        />,
      );
      // Faint reference line for baseline
      const refLine = container.querySelector("line[data-testid='sparkline-baseline']");
      expect(refLine).toBeInTheDocument();
      expect(refLine).toHaveAttribute("stroke-dasharray");

      // Main trace uses lighter stroke (<= 1.75px instead of 2.5px)
      const path = container.querySelector("path");
      expect(path).toBeInTheDocument();
      const strokeWidth = parseFloat(path?.getAttribute("stroke-width") ?? "0");
      expect(strokeWidth).toBeLessThanOrEqual(1.75);
    });
  });

  describe("ReferenceBarChart [UC8]", () => {
    it("[UC8] renders value vs baseline comparison with units and French format", () => {
      render(
        <ReferenceBarChart
          label="Énergie RMS"
          currentValue={0.165}
          baselineValue={0.130}
          unit="g"
        />,
      );
      expect(screen.getByText("Énergie RMS")).toBeInTheDocument();
      expect(screen.getByText(/0,165 g \/ 0,130 g/)).toBeInTheDocument();
    });
  });

  describe("SpectrogramChart [UC8]", () => {
    it("[UC8] renders spectrogram with energy legend and frequency axis", () => {
      const fixtureMatrix = [
        [0.1, 0.2, 0.5],
        [0.3, 0.8, 0.4],
      ];
      render(
        <SpectrogramChart
          matrix={fixtureMatrix}
          durationSec={25}
          maxFreqHz={400}
          dominantFreqHz={120}
        />,
      );
      expect(screen.getByText("Spectrogramme (temps / fréquence)")).toBeInTheDocument();
      expect(screen.getByText("Énergie :")).toBeInTheDocument();
      expect(screen.getByText("Faible")).toBeInTheDocument();
      expect(screen.getByText("Élevée")).toBeInTheDocument();
      expect(screen.getByText("Pic 120 Hz")).toBeInTheDocument();
    }, 20000);
  });

  describe("PressureStrip [UC2]", () => {
    it("[UC2] renders optimal zone status in French", () => {
      render(<PressureStrip pressureKpa={5.2} status="capturing" />);
      expect(screen.getByText(/Plage cible : 3,0 à 8,5 kPa/i)).toBeInTheDocument();
      expect(screen.getByText("Actif")).toBeInTheDocument();
    });

    it("[UC2] displays blocked message below 2.5 kPa", () => {
      render(<PressureStrip pressureKpa={1.8} status="idle" />);
      const blocked = screen.getByTestId("pressure-strip-blocked");
      expect(blocked).toHaveTextContent(/Appui insuffisant \(< 2,5 kPa\) · acquisition bloquée/i);
    });

    it("[UC2] displays compression risk message above 9.0 kPa", () => {
      render(<PressureStrip pressureKpa={10.4} status="idle" />);
      const blocked = screen.getByTestId("pressure-strip-blocked");
      expect(blocked).toHaveTextContent(/Risque de compression \(> 9,0 kPa\) · acquisition bloquée/i);
    });
  });
});
