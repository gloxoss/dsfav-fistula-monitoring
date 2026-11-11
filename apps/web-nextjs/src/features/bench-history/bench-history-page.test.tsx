import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BenchHistoryPage } from "./bench-history-page";

afterEach(cleanup);

const rows = [
  { sessionId: "bs-1", createdAt: "2026-11-10T09:00:00Z", revealed: true, concordance: "Concordant" },
  { sessionId: "bs-2", createdAt: "2026-11-09T09:00:00Z", revealed: false, concordance: null },
  { sessionId: "bs-3", createdAt: "2026-11-08T09:00:00Z", revealed: true, concordance: null },
];

describe("Bench history page [UC10] [UC11]", () => {
  it("[UC11] summarises sessions: total, revealed, waiting", () => {
    render(<BenchHistoryPage rows={rows} />);
    expect(screen.getByText("Séances").closest("div")).toHaveTextContent("3");
    expect(screen.getByText("Révélées").closest("div")).toHaveTextContent("2");
    // the tile comes first in the page; the same word is also the badge of a waiting session
    expect(screen.getAllByText("En attente")[0]!.closest("div")).toHaveTextContent("1");
  });

  it("[UC11] never shows concordance before the reveal and reads dates humanly", () => {
    render(<BenchHistoryPage rows={rows} />);
    expect(screen.getByText("Concordant")).toBeInTheDocument();
    expect(screen.getByText("Non révélée")).toBeInTheDocument();
    expect(screen.getByText("Indisponible")).toBeInTheDocument();
    expect(screen.queryByText(/2026-11-10T/)).toBeNull();
  });

  it("[UC11] empty state says how a session starts", () => {
    render(<BenchHistoryPage rows={[]} />);
    expect(screen.getByText(/aucune séance/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /banc d’entraînement/i })).toHaveAttribute("href", "/training-bench");
  });
});
