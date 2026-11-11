import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PatientDetail } from "./patient-detail";
import type { ClinicalStatus, PatientDetailView, SessionView } from "../model/types";

afterEach(cleanup);

const BASELINE = { rmsG: 0.145, peakFreqHz: 68, stenosisRatio: 0.32 };
const RMS_HISTORY = [0.148, 0.142, 0.15, 0.139, 0.143, 0.121, 0.102, 0.089];

const EXPLANATION =
  "Par rapport à la référence : RMS −38 %, fréquence dominante de 68 Hz à 184 Hz, rapport haute/basse fréquence ×4,5. Deux séances de suite au-dessus du seuil.";

function buildSessions(status: ClinicalStatus = "NORMAL"): SessionView[] {
  return RMS_HISTORY.map((rms, index) => {
    const isLast = index === RMS_HISTORY.length - 1;
    const isSecondToLast = index === RMS_HISTORY.length - 2;
    const isBuilding = status === "BASELINE_BUILDING";
    const deviationScore =
      status === "UNUSUAL_EVOLUTION"
        ? isLast
          ? 3.8
          : isSecondToLast
            ? 3.6
            : 1.1
        : status === "TO_CONFIRM"
          ? isLast
            ? 3.8
            : 1.1
          : isBuilding
            ? null
            : 1.1;

    return {
      measurementId: `m-${index}`,
      recordedAt:
        isLast && !isBuilding
          ? "2026-11-03T07:52:00"
          : `2026-11-${String(21 + index).padStart(2, "0")}T07:52:00`,
      status: isLast ? status : isBuilding ? "BASELINE_BUILDING" : "NORMAL",
      rejectReason: null,
      rmsG: rms,
      peakFreqHz: isLast ? 184 : 68,
      stenosisRatio: isLast ? 1.44 : 0.32,
      deviationScore,
      isUnusualEvolution: status === "UNUSUAL_EVOLUTION" && (isLast || isSecondToLast),
      explanation: status === "UNUSUAL_EVOLUTION" && isLast ? EXPLANATION : "Signal stable.",
      cleanDurationSec: 22.9,
      artifactPct: 8.2,
      avgPressureKpa: 4.6,
    };
  });
}

function buildPatient(overrides: Partial<PatientDetailView> = {}): PatientDetailView {
  return {
    idPseudo: "PT-CAS-8841",
    fistulaType: "RADIO_CEPHALIC",
    armSide: "LEFT",
    baselineLocked: true,
    baselineStep: 3,
    baselineFeatures: BASELINE,
    latestStatus: "NORMAL",
    sessions: buildSessions(),
    ...overrides,
  };
}

describe("PatientDetail", () => {
  it("[UC8] lists sessions and comparison bars for a locked baseline", () => {
    const { container } = render(<PatientDetail patient={buildPatient()} thresholdSigma={3.4} />);

    expect(screen.getAllByText("03/11 07:52").length).toBeGreaterThan(0);
    expect(screen.getByText("Baseline 0,145 g")).toBeInTheDocument();
    expect(screen.getAllByText("Mesure stable").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "RMS par séance" })).toBeInTheDocument();
    expect(container.querySelectorAll("svg rect").length).toBeGreaterThan(0);
    expect(screen.getByRole("table", { name: "Valeurs RMS par séance" })).toBeInTheDocument();
  }, 20000);

  it("[UC8] shows an empty history message when the patient has no session", () => {
    render(
      <PatientDetail
        patient={buildPatient({
          baselineLocked: false,
          baselineStep: 0,
          baselineFeatures: null,
          latestStatus: null,
          sessions: [],
        })}
      />,
    );

    expect(screen.getByText("Aucun historique")).toBeInTheDocument();
    expect(
      screen.getByText(/réalisez une première mesure pour démarrer la référence/i),
    ).toBeInTheDocument();
  });

  it("[UC9] UNUSUAL_EVOLUTION shows the amber pill, deviation vs threshold, and the explanation sentence with numbers", () => {
    render(
      <PatientDetail
        patient={buildPatient({
          latestStatus: "UNUSUAL_EVOLUTION",
          sessions: buildSessions("UNUSUAL_EVOLUTION"),
        })}
        thresholdSigma={3.4}
      />,
    );

    const pills = screen.getAllByText("Évolution inhabituelle");
    expect(
      pills.some((node) => node.closest("[role='status']")?.className.includes("bg-warning-tint")),
    ).toBe(true);

    expect(screen.getByText("3,8")).toBeInTheDocument();
    expect(screen.getByText("Seuil 3,4")).toBeInTheDocument();
    expect(screen.getByText("2 séances de suite au-dessus")).toBeInTheDocument();
    expect(screen.getByText(EXPLANATION)).toBeInTheDocument();
  });

  it("[UC9] TO_CONFIRM stays neutral and never uses the alert pill", () => {
    render(
      <PatientDetail
        patient={buildPatient({
          latestStatus: "TO_CONFIRM",
          sessions: buildSessions("TO_CONFIRM"),
        })}
        thresholdSigma={3.4}
      />,
    );

    expect(screen.getByText("À confirmer à la prochaine séance")).toBeInTheDocument();
    expect(screen.queryByText("Évolution inhabituelle")).not.toBeInTheDocument();

    const pills = screen.getAllByText("À confirmer");
    for (const pillText of pills) {
      const pill = pillText.closest("[role='status']");
      expect(pill).toHaveClass("bg-well");
      expect(pill).not.toHaveClass("bg-warning-tint");
    }
  });

  it("[UC7] BASELINE_BUILDING shows Référence n/3 with no comparison and no alert", () => {
    render(
      <PatientDetail
        patient={buildPatient({
          baselineLocked: false,
          baselineStep: 2,
          baselineFeatures: null,
          latestStatus: "BASELINE_BUILDING",
          sessions: buildSessions("BASELINE_BUILDING"),
        })}
      />,
    );

    expect(screen.getAllByText("Référence 2/3").length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Baseline /)).not.toBeInTheDocument();
    expect(screen.queryByText("Évolution inhabituelle")).not.toBeInTheDocument();
    expect(screen.queryByText("À confirmer")).not.toBeInTheDocument();
  });

  it("re-baseline requires a reason and confirms the audit entry", async () => {
    const onRebaseline = vi.fn().mockResolvedValue(undefined);
    render(<PatientDetail patient={buildPatient()} isNephrologist onRebaseline={onRebaseline} />);

    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser la référence" }));
    const confirm = screen.getByRole("button", { name: "Confirmer" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motif (obligatoire)"), { target: { value: "Réévaluation clinique" } });
    fireEvent.click(confirm);

    await waitFor(() => expect(onRebaseline).toHaveBeenCalledWith({
      idPseudo: "PT-CAS-8841",
      reason: "Réévaluation clinique",
    }));
    expect(await screen.findByText(
      "Événement d’audit enregistré · Réévaluation clinique · l’ancienne référence est archivée.",
    )).toBeInTheDocument();
  }, 20000);

  it("[UC8] renders the notes loaded from the API and records a new note", async () => {
    const onAddNote = vi.fn().mockResolvedValue(undefined);

    render(
      <PatientDetail
        patient={buildPatient()}
        isNephrologist
        onAddNote={onAddNote}
        notes={[
          {
            id: "note-1",
            text: "Thrill stable au tiers moyen.",
            createdAt: "2026-11-02T08:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Thrill stable au tiers moyen.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Ajouter une note"), {
      target: { value: "Surveiller l’anastomose au prochain contrôle." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la note" }));

    await waitFor(() => {
      expect(onAddNote).toHaveBeenCalledWith({
        idPseudo: "PT-CAS-8841",
        text: "Surveiller l’anastomose au prochain contrôle.",
      });
    });
  });

  it("[DISCLAIMER] renders the exact disclaimer on the patient detail", () => {
    render(<PatientDetail patient={buildPatient()} />);

    expect(
      screen.getByText(
        "Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.",
      ),
    ).toBeInTheDocument();
  });

  it("[UC8] history chart: renders N points with axis labels, dates in French, baseline line, accessible table with the same values", () => {
    const patient = buildPatient();
    render(<PatientDetail patient={patient} thresholdSigma={3.4} />);

    // N points
    const points = screen.getAllByTestId("rms-chart-point");
    expect(points.length).toBe(patient.sessions.length);

    // Axis labels in g
    expect(screen.getAllByText(/0,200 g|0,150 g|0,100 g|g\b/).length).toBeGreaterThan(0);

    // Dates in French (dd/MM)
    expect(screen.getAllByText("03/11").length).toBeGreaterThan(0);

    // Baseline line chip
    expect(screen.getByText("Baseline 0,145 g")).toBeInTheDocument();

    // Accessible table
    const table = screen.getByRole("table", { name: "Valeurs RMS par séance" });
    expect(table).toBeInTheDocument();
    expect(table).toHaveTextContent("0,145 g");
    expect(table).toHaveTextContent("0,089 g");
  });

  it("formats calculated deviation with French decimal comma on the deviation card", () => {
    const patient = buildPatient({
      latestStatus: "UNUSUAL_EVOLUTION",
      sessions: buildSessions("UNUSUAL_EVOLUTION"),
    });
    // Set deviation score with decimals like 21.73
    patient.sessions[patient.sessions.length - 1]!.deviationScore = 21.73;

    render(<PatientDetail patient={patient} thresholdSigma={3.4} />);

    // Must be formatted with comma "21,73"
    expect(screen.getByText("21,73")).toBeInTheDocument();
    expect(screen.queryByText("21.73")).not.toBeInTheDocument();
  });

  it("[UC8] metric tile change badges and status pills use whitespace-nowrap and single-line formatting", () => {
    const patient = buildPatient({
      latestStatus: "UNUSUAL_EVOLUTION",
      sessions: buildSessions("UNUSUAL_EVOLUTION"),
    });

    const { container } = render(<PatientDetail patient={patient} thresholdSigma={3.4} />);

    // Metric tile change badges must have whitespace-nowrap
    const deltaBadges = screen.getAllByText(/vs réf\./i);
    expect(deltaBadges.length).toBeGreaterThan(0);
    deltaBadges.forEach((badge) => {
      expect(badge).toHaveClass("whitespace-nowrap");
    });

    // All status pills in the session card should have whitespace-nowrap
    const sessionCardPills = container.querySelectorAll("ol [role='status']");
    expect(sessionCardPills.length).toBeGreaterThan(0);
    sessionCardPills.forEach((pill) => {
      expect(pill).toHaveClass("whitespace-nowrap");
    });
  }, 20000);
});

describe("PatientDetail layout [UC8] [UC9]", () => {
  it("[UC9] shows the interactive fistula map with the latest valid values", () => {
    render(<PatientDetail patient={buildPatient()} thresholdSigma={3.4} />);
    expect(screen.getByRole("radiogroup", { name: /zone de la fistule/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /détail de la zone/i })).toHaveTextContent("184 Hz");
  });

  it("[UC8] groups trend, spectrogram, sessions and notes in tabs so the page stays short", () => {
    render(<PatientDetail patient={buildPatient()} thresholdSigma={3.4} notes={[{ id: "n1", text: "Thrill stable.", createdAt: "2026-11-08T10:00:00Z" }]} />);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Tendance", "Spectrogramme", "Séances (8)", "Notes (1)"]);
    expect(screen.getByRole("tab", { name: "Tendance" })).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(screen.getByRole("tab", { name: /notes/i }), { button: 0 });
    expect(screen.getByRole("tab", { name: /notes/i })).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Thrill stable.")).toBeInTheDocument();
  });
});
