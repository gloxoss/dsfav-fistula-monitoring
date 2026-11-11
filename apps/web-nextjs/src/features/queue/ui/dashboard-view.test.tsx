import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardView } from "./dashboard-view";
import type { ApiQueueItem } from "../model/types";

afterEach(cleanup);

const DISCLAIMER =
  "Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.";

function queueItem(overrides: Partial<ApiQueueItem> = {}): ApiQueueItem {
  return {
    measurementId: "m-1",
    idPseudo: "PT-CAS-8841",
    deviceId: "9f2a0d7e-16f4-4a4a-9a1b-1a0f2c3d4e5f",
    operatorId: "usr-nurse-01",
    status: "UNUSUAL_EVOLUTION",
    recordedAt: "2026-11-03T07:52:00",
    disclaimer: DISCLAIMER,
    ...overrides,
  };
}

describe("DashboardView", () => {
  it("[DISCLAIMER] dashboard shows the verbatim clinical disclaimer", () => {
    render(<DashboardView queue={[]} />);

    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Aucune mesure aujourd’hui. Les patients apparaissent ici dès qu’une mesure est enregistrée.",
      ),
    ).toBeInTheDocument();
  });

  it("[UC9] queue rows keep UNUSUAL_EVOLUTION on the amber pill only", () => {
    render(
      <DashboardView
        queue={[
          queueItem(),
          queueItem({
            measurementId: "m-2",
            idPseudo: "PT-CAS-5530",
            status: "TO_CONFIRM",
            recordedAt: "2026-11-03T07:40:00",
          }),
        ]}
      />,
    );

    const table = within(screen.getByRole("table"));
    const unusual = table.getByText("Évolution inhabituelle").closest("[role='status']");
    expect(unusual).toHaveClass("bg-warning-tint");

    const toConfirm = table.getByText("À confirmer").closest("[role='status']");
    expect(toConfirm).not.toHaveClass("bg-warning-tint");
    expect(toConfirm).toHaveClass("bg-well");
  });

  it("[UC8] status filter shows only matching queue rows", () => {
    render(
      <DashboardView
        queue={[
          queueItem(),
          queueItem({ measurementId: "m-2", idPseudo: "PT-CAS-5530", status: "NORMAL" }),
          queueItem({ measurementId: "m-3", idPseudo: "PT-CAS-6603", status: "REJECTED_QUALITY" }),
        ]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: /filtrer par statut/i }), {
      target: { value: "REJECTED_QUALITY" },
    });

    expect(screen.getByText("PT-CAS-6603")).toBeInTheDocument();
    expect(screen.queryByText("PT-CAS-8841")).not.toBeInTheDocument();
    expect(screen.queryByText("PT-CAS-5530")).not.toBeInTheDocument();
  });

});
