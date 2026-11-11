import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QueueBoard } from "./queue-board";
import type { ApiQueueItem } from "../model/types";

afterEach(cleanup);

function item(index: number, status: ApiQueueItem["status"], idPseudo: string): ApiQueueItem {
  return {
    measurementId: `m-${index}`,
    idPseudo,
    deviceId: "dev-01-001",
    operatorId: "u-nurse-001",
    status,
    recordedAt: `2026-11-10T0${index}:00:00.000Z`,
    disclaimer: "x",
  } as ApiQueueItem;
}

const queue = [
  item(1, "NORMAL", "PT-A"),
  item(2, "UNUSUAL_EVOLUTION", "PT-B"),
  item(3, "UNUSUAL_EVOLUTION", "PT-C"),
  item(4, "REJECTED_QUALITY", "PT-D"),
];

describe("QueueBoard summary tiles [UC8] [UC9]", () => {
  it("shows the count of today's queue per status", () => {
    render(<QueueBoard queue={queue} />);
    const summary = screen.getByRole("region", { name: "Résumé de la file du jour" });
    expect(within(summary).getByRole("button", { name: /Évolution inhabituelle/ })).toHaveTextContent("2");
    expect(within(summary).getByRole("button", { name: /Mesure à refaire/ })).toHaveTextContent("1");
    expect(within(summary).getByRole("button", { name: /À confirmer/ })).toHaveTextContent("0");
    expect(within(summary).getByRole("button", { name: /Référence en cours/ })).toHaveTextContent("0");
  });

  it("filters the table when a tile is pressed and clears the filter when pressed again", () => {
    render(<QueueBoard queue={queue} />);
    const tile = screen.getByRole("button", { name: /Évolution inhabituelle/ });
    fireEvent.click(tile);
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("PT-B")).toBeInTheDocument();
    expect(screen.getByText("PT-C")).toBeInTheDocument();
    expect(screen.queryByText("PT-A")).toBeNull();
    fireEvent.click(tile);
    expect(tile).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("PT-A")).toBeInTheDocument();
  });
});
