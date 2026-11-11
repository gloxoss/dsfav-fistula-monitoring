import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CaptureClient } from "./capture-client";
import { ProtocolCard } from "./protocol-card";
import { DeviceCard } from "./device-card";

afterEach(cleanup);

describe("Capture page polish [UC1] [UC2]", () => {
  it("[UC2] the start/stop bar stays reachable: sticky at the bottom of the viewport", () => {
    render(<CaptureClient initialPressure={4.8} />);
    const bar = screen.getByTestId("capture-actions");
    expect(bar.className).toMatch(/\bsticky\b/);
    expect(bar.className).toMatch(/bottom-/);
    expect(within(bar).getByRole("button", { name: /démarrer l’acquisition/i })).toBeInTheDocument();
  });

  it("[UC1] measurement progress is a real progressbar with a text value", () => {
    render(<CaptureClient initialPressure={4.8} />);
    const bar = screen.getByRole("progressbar", { name: /progression de la mesure/i });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "25");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuetext", "0,0 s sur 25,0 s");
  });

  it("[UC1] the pre-measurement checklist is calm chrome: a neutral surface, no yellow card", () => {
    const { container } = render(<ProtocolCard />);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/accent-tint|warning-tint/);
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-surface/);
  });

  it("[UC1] an offline registered device keeps its facts next to the explanation, no empty void", () => {
    render(
      <DeviceCard
        device={{
          id: "d1", name: "DSFAV-UNIT-01", batteryPct: 95, connected: false, syncState: "SYNCED",
          macTail: "01", firmwareVersion: "", estimatedMeasuresLeft: 0, lastSeenAt: "2026-11-10T08:00:00Z",
        }}
      />,
    );
    const card = screen.getByText("Dernier contact").closest("div[class*='min-h']") ?? screen.getByText("Dernier contact").closest("div");
    expect(card).not.toBeNull();
    expect((card as HTMLElement).className).not.toMatch(/justify-between/);
  });
});
