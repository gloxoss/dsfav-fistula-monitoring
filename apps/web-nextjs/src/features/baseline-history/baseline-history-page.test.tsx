import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BaselineHistoryPage } from "./baseline-history-page";

afterEach(cleanup);

const patients = [
  { idPseudo: "PT-CAS-8841", fistula: "FAV radio-céphalique", side: "gauche" },
  { idPseudo: "PT-CAS-4471", fistula: "FAV brachio-céphalique", side: "droite" },
];

describe("Baseline history page [UC7] [UC12]", () => {
  it("[UC12] lists the patients as links and marks the current one", () => {
    render(<BaselineHistoryPage patients={patients} selectedPatient="PT-CAS-8841" rows={[]} />);
    const nav = screen.getByRole("navigation", { name: /patients/i });
    expect(within(nav).getByRole("link", { name: /PT-CAS-8841/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /PT-CAS-4471/ })).toHaveAttribute("href", "/baseline-history?idPseudo=PT-CAS-4471");
  });

  it("[UC12] shows each version with its state in words, reason and readable dates", () => {
    render(
      <BaselineHistoryPage
        patients={patients}
        selectedPatient="PT-CAS-8841"
        rows={[
          { idPseudo: "PT-CAS-8841", lockedAt: "2026-11-10T11:01:25.025Z", reason: "Revue clinique post-angioplastie", active: true, archivedAt: null },
          { idPseudo: "PT-CAS-8841", lockedAt: "2026-10-01T09:00:00.000Z", reason: "Baseline de référence", active: false, archivedAt: "2026-11-10T11:01:25.025Z" },
        ]}
      />,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Archivée")).toBeInTheDocument();
    expect(screen.getByText("Revue clinique post-angioplastie")).toBeInTheDocument();
    expect(screen.queryByText(/2026-11-10T/)).toBeNull();
    expect(screen.getAllByText(/\d{2}\/\d{2}\/2026/).length).toBeGreaterThanOrEqual(2);
  });

  it("[UC12] empty state explains what a version is", () => {
    render(<BaselineHistoryPage patients={patients} selectedPatient="PT-CAS-4471" rows={[]} />);
    expect(screen.getByText(/aucune version pour ce patient/i)).toBeInTheDocument();
    expect(screen.getByText(/3 premières mesures conformes/i)).toBeInTheDocument();
  });
});
