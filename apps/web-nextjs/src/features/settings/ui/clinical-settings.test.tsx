import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClinicalSettings } from "./clinical-settings";

afterEach(cleanup);

const EMPTY_PROPS = {
  userId: "usr-nephro-2",
  activeVersion: 3,
  activeDate: "2026-11-01T10:00:00.000Z",
  thresholds: { deviationScore: 3.4, pressureMinKpa: 2.5 },
  onPropose: vi.fn().mockResolvedValue({ id: "proposal-2" }),
  onApprove: vi.fn().mockResolvedValue(undefined),
};

describe("ClinicalSettings", () => {
  it("[AUTHZ-MATRIX] shows the to-calibrate label for every active threshold", () => {
    render(<ClinicalSettings role="NEPHROLOGIST" {...EMPTY_PROPS} />);

    expect(screen.getByText(/Version 3/)).toBeInTheDocument();
    expect(screen.getAllByText("À calibrer au banc")).toHaveLength(2);
    expect(screen.getByText("Seuil de déviation")).toBeInTheDocument();
    expect(screen.getByText("Pression minimale")).toBeInTheDocument();
  });

  it("[AUTHZ-MATRIX] groups thresholds by theme, pressure in ascending order, with readable date", () => {
    render(
      <ClinicalSettings
        role="NEPHROLOGIST"
        {...EMPTY_PROPS}
        thresholds={{ pressureMaxKpa: 9, pressureMinKpa: 2.5, pressureLowKpa: 3, pressureHighKpa: 8.5, thresholdSigma: 3.4, motionThresholdG: 0.08 }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Pression de contact" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Qualité du signal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Détection et référence" })).toBeInTheDocument();
    const pressure = screen.getByRole("heading", { name: "Pression de contact" }).closest("section")!;
    const labels = Array.from(pressure.querySelectorAll("dt")).map((node) => node.textContent);
    expect(labels).toEqual([
      "Pression minimale",
      "Pression minimale recommandée",
      "Pression maximale recommandée",
      "Pression maximale",
    ]);
    expect(screen.getByText(/Version 3 · 01\/11\/2026/)).toBeInTheDocument();
  });

  it.each(["NURSE", "INTERN"] as const)("[AUTHZ-MATRIX] refuses %s access", (role) => {
    render(<ClinicalSettings role={role} {...EMPTY_PROPS} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Accès réservé au néphrologue et à l’administrateur.");
    expect(screen.queryByText("À calibrer au banc")).not.toBeInTheDocument();
  });

  it("[AUTHZ-MATRIX] shows the active config as read-only to admins", () => {
    render(<ClinicalSettings role="ADMIN" {...EMPTY_PROPS} />);
    expect(screen.getByText("Brouillons : à venir")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer le brouillon" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Valider la configuration" })).not.toBeInTheDocument();
  });

  it("[AUTHZ-MATRIX] requires a different nephrologist to approve the author’s proposal", async () => {
    const onPropose = vi.fn().mockResolvedValue({ id: "proposal-2" });
    render(<ClinicalSettings role="NEPHROLOGIST" {...EMPTY_PROPS} userId="usr-author" onPropose={onPropose} />);
    fireEvent.change(screen.getByLabelText("Nouveau seuil de déviation (écarts-types)"), { target: { value: "3.6" } });
    fireEvent.change(screen.getByLabelText("Note de confiance et motif"), { target: { value: "Revue au banc" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    await waitFor(() => expect(onPropose).toHaveBeenCalledWith({ threshold: 3.6, confidenceNote: "Revue au banc" }));
    expect(await screen.findByText("Un autre néphrologue doit valider ce brouillon.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approuver" })).toBeDisabled();
  });

  it("[AUTHZ-MATRIX] lets a different reviewer submit a proposal for approval", async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const existingProposal = {
      id: "proposal-1-uuid",
      authorId: "usr-author-other",
      authorRole: "Néphrologue",
      createdAt: "2026-11-08T10:00:00Z",
      threshold: 3.8,
    };
    render(
      <ClinicalSettings
        role="NEPHROLOGIST"
        {...EMPTY_PROPS}
        initialProposals={[existingProposal]}
        userId="usr-reviewer"
        onApprove={onApprove}
      />,
    );
    expect(screen.getByText("3,8 σ")).toBeInTheDocument();
    const approveBtn = screen.getByRole("button", { name: "Approuver" });
    expect(approveBtn).toBeEnabled();
    fireEvent.click(approveBtn);

    await waitFor(() => expect(onApprove).toHaveBeenCalledWith("proposal-1-uuid"));
  });

  it("[AUTHZ-MATRIX] shows French empty state when no proposals exist", () => {
    render(<ClinicalSettings role="NEPHROLOGIST" {...EMPTY_PROPS} initialProposals={[]} />);
    expect(screen.getByText("Aucune proposition en attente de validation.")).toBeInTheDocument();
  });
});
