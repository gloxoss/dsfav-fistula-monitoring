import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DISCLAIMER } from "@/libs/clinical/disclaimer";
import { DevicesView } from "./devices-view";
import type { ApiDeviceSummary, DeviceThresholds } from "../model/types";

afterEach(cleanup);

const THRESHOLDS: DeviceThresholds = {
  batteryWarnPct: 20,
  batteryBlockPct: 15,
  gainTolerancePct: 3,
};

function device(overrides: Partial<ApiDeviceSummary> = {}): ApiDeviceSummary {
  return {
    id: "9f2a0d7e-16f4-4a4a-9a1b-1a0f2c3d4e5f",
    serialNumber: "DSFAV-UNIT-04",
    macAddress: "AA:BB:CC:DD:EE:04",
    calibrationGain: 1.039,
    lastBatteryPct: 12,
    lastSeenAt: "2026-11-03T07:52:00",
    lastSyncAt: "2026-11-03T07:50:00",
    failedCount: 0,
    continuity: {
      uniquePatients: 1,
      crossDevicePatients: 0,
    },
    ...overrides,
  };
}

describe("DevicesView", () => {
  it("[UC13] shows the blocked battery and out-of-tolerance gain against the configured thresholds", () => {
    render(<DevicesView devices={[device()]} role="ADMIN" thresholds={THRESHOLDS} />);

    expect(screen.getByText("12 % · bloquée sous 15 %")).toBeInTheDocument();
    expect(screen.getByText("+3,9 % hors tolérance 3 %")).toBeInTheDocument();
  });

  it("[UC13] renders battery and gain statuses from the threshold props, not literals", () => {
    render(
      <DevicesView
        devices={[device()]}
        role="ADMIN"
        thresholds={{ batteryWarnPct: 25, batteryBlockPct: 10, gainTolerancePct: 8 }}
      />,
    );

    expect(screen.getByText("12 % · faible sous 25 %")).toBeInTheDocument();
    expect(screen.getByText("+3,9 % dans la tolérance 8 %")).toBeInTheDocument();
  });

  it("[AUTHZ-MATRIX] only admin sees calibration controls", () => {
    const { rerender } = render(
      <DevicesView devices={[device()]} role="NURSE" thresholds={THRESHOLDS} />,
    );
    expect(screen.queryByRole("button", { name: "Lancer la calibration" })).not.toBeInTheDocument();
    expect(screen.getByText("Réservé à l’administration")).toBeInTheDocument();

    rerender(<DevicesView devices={[device()]} role="NEPHROLOGIST" thresholds={THRESHOLDS} />);
    expect(screen.queryByRole("button", { name: "Lancer la calibration" })).not.toBeInTheDocument();
    expect(screen.getByText("Réservé à l’administration")).toBeInTheDocument();

    rerender(
      <DevicesView
        devices={[device()]}
        role="ADMIN"
        thresholds={THRESHOLDS}
        onCalibrate={async () => ({ error: null, ok: false })}
      />,
    );
    expect(screen.getByRole("button", { name: "Lancer la calibration" })).toBeInTheDocument();
    expect(screen.queryByText("Réservé à l’administration")).not.toBeInTheDocument();
  });

  it("[AUTHZ-MATRIX] admin sees the calibration action on the flagged device", () => {
    render(
      <DevicesView
        devices={[device()]}
        role="ADMIN"
        thresholds={THRESHOLDS}
        onCalibrate={async () => ({ error: null, ok: false })}
      />,
    );

    expect(screen.getByRole("button", { name: "Lancer la calibration" })).toBeInTheDocument();
    expect(screen.queryByText("Réservé à l’administration")).not.toBeInTheDocument();
  });

  it("[UC12] shows failed sync items in amber", () => {
    render(
      <DevicesView
        devices={[device({ id: "dev-03", serialNumber: "DSFAV-UNIT-03", failedCount: 3 })]}
        role="NURSE"
        thresholds={THRESHOLDS}
      />,
    );

    expect(screen.getByText("Éléments en échec")).toBeInTheDocument();
    expect(
      screen.getAllByText("3").some((element) => element.classList.contains("text-warning-text")),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Réessayer" })).not.toBeInTheDocument();
  });

  it("[UC13] shows configuration unavailable and applies no thresholds without an active config", () => {
    render(<DevicesView devices={[device()]} role="NURSE" thresholds={null} />);

    expect(screen.getByText("Configuration indisponible")).toBeInTheDocument();
    expect(screen.queryByText(/· bloquée sous/)).not.toBeInTheDocument();
    expect(screen.queryByText(/· faible sous/)).not.toBeInTheDocument();
    expect(screen.queryByText(/hors tolérance \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/dans la tolérance/)).not.toBeInTheDocument();
    expect(screen.getByText("12 %")).toBeInTheDocument();
    expect(screen.getByText("+3,9 %")).toBeInTheDocument();
  });

  it("[UC12] shows continuity counts from the device summary", () => {
    render(<DevicesView devices={[device()]} role="NEPHROLOGIST" thresholds={THRESHOLDS} />);

    expect(screen.getByText("1 patient · 0 inter-appareils")).toBeInTheDocument();
  });

  it("empty fleet shows a French empty state", () => {
    render(<DevicesView devices={[]} role="ADMIN" thresholds={THRESHOLDS} />);

    expect(screen.getByText("Aucun appareil enregistré.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Un appareil apparaît ici après son premier appairage au serveur de la clinique.",
      ),
    ).toBeInTheDocument();
  });

  it("shows audit-backed calibration history per device with reason and operator role", () => {
    render(
      <DevicesView
        devices={[device()]}
        role="ADMIN"
        thresholds={THRESHOLDS}
        calibrationHistory={[
          {
            id: "cal-audit-1",
            entityId: "9f2a0d7e-16f4-4a4a-9a1b-1a0f2c3d4e5f",
            actorRole: "ADMIN",
            after: {
              calibrationGain: 1.039,
              reason: "Étalonnage annuel banc 400 mL/min",
            },
            at: "2026-11-03T10:00:00Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Historique d’étalonnage")).toBeInTheDocument();
    expect(screen.getAllByText("DSFAV-UNIT-04").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Étalonnage annuel banc 400 mL/min")).toBeInTheDocument();
    expect(screen.getByText(/ADMIN/)).toBeInTheDocument();
  });

  it("[UC13] with 120 events only 10 render for the selected device and Voir tout expands the list", () => {
    const dev = device();
    const fake120Events = Array.from({ length: 120 }, (_, index) => ({
      id: `cal-audit-${index + 1}`,
      entityId: dev.id,
      actorRole: "ADMIN" as const,
      after: {
        calibrationGain: 1.0 + index * 0.001,
        reason: `Étalonnage test ${index + 1}`,
      },
      at: new Date(Date.UTC(2026, 10, 8, 12, 0, 120 - index)).toISOString(),
    }));

    render(
      <DevicesView
        devices={[dev]}
        role="ADMIN"
        thresholds={THRESHOLDS}
        calibrationHistory={fake120Events}
      />,
    );

    const historySection = screen.getByText("Historique d’étalonnage").closest(".space-y-4")!;
    const table = historySection.querySelector("table")!;
    const tbody = table.querySelector("tbody")!;
    const rows = tbody.querySelectorAll("tr");
    expect(rows).toHaveLength(10);

    const seeAllBtn = screen.getByRole("button", { name: /voir tout/i });
    expect(seeAllBtn).toBeInTheDocument();
  });

  it("[DISCLAIMER] devices screen shows the verbatim clinical disclaimer", () => {
    render(<DevicesView devices={[]} role="NURSE" thresholds={THRESHOLDS} />);

    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });
});
