import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { ResultCard } from "./result-card";
import { CaptureClient } from "./capture-client";
import { UnknownPatientModal } from "./unknown-patient-modal";
import { LiveSignal } from "./live-signal";
import { DISCLAIMER } from "@/libs/clinical/disclaimer";
import type { CaptureFrame, CaptureResult, DeviceInfo } from "../model/types";

const LIVE_DEVICE: DeviceInfo = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "DSFAV-UNIT-01",
  batteryPct: 86,
  connected: true,
  syncState: "SYNCED",
  macTail: "A4:1F",
  firmwareVersion: "1.3.2",
  estimatedMeasuresLeft: 24,
};

function ModalHarness({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ouvrir la saisie
      </button>
      <UnknownPatientModal
        isOpen={open}
        idPseudo="PT-CAS-9277"
        onConfirm={onConfirm}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
      />
    </>
  );
}

describe("Capture screen and ResultCard TDD tests", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("[UC2] start button disabled with reason text below 2.5 kPa and above 9.0 kPa", () => {
    vi.useFakeTimers();

    // Under 2.5 kPa: disabled with reason text
    const { unmount } = render(<CaptureClient initialPressure={1.8} />);
    const startBtnLow = screen.getByRole("button", { name: /démarrer l’acquisition/i });
    expect(startBtnLow).toBeDisabled();
    expect(screen.getAllByText(/s’active à partir de 2,5 kpa|appui insuffisant/i).length).toBeGreaterThan(0);
    unmount();

    // Above 9.0 kPa: disabled with compression risk text
    const { unmount: unmount2 } = render(<CaptureClient initialPressure={10.2} />);
    const startBtnHigh = screen.getByRole("button", { name: /démarrer l’acquisition/i });
    expect(startBtnHigh).toBeDisabled();
    expect(screen.getAllByText(/risque de compression/i).length).toBeGreaterThan(0);
    unmount2();

    // Within recommended range (3.0 - 8.5 kPa): enabled once the pressure is stable
    const { unmount: unmount3 } = render(<CaptureClient initialPressure={4.8} />);
    const startBtnOk = screen.getByRole("button", { name: /démarrer l’acquisition/i });
    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    expect(startBtnOk).not.toBeDisabled();
    unmount3();
  }, 30000);

  it("[UC3] rejected result shows « Mesure à refaire » and the cause; after 3 rejections « non exploitable »", () => {
    const rejectedResultAttempt1: CaptureResult = {
      status: "REJECTED_QUALITY",
      idPseudo: "PT-CAS-8841",
      cleanDurationSec: 9.8,
      artifactPct: 24.5,
      meanPressureKpa: 4.6,
      rmsG: 0.12,
      peakFreqHz: 70,
      attemptsCount: 1,
      rejectionReason: "mouvement du bras",
      maxAttempts: 3,
    };

    const { unmount } = render(<ResultCard result={rejectedResultAttempt1} onRetry={vi.fn()} />);
    expect(screen.getByText(/mesure à refaire/i)).toBeInTheDocument();
    expect(screen.getByText(/cause : mouvement du bras/i)).toBeInTheDocument();
    unmount();

    // After 3 failed attempts: shows « non exploitable »
    const rejectedResultAttempt3: CaptureResult = {
      ...rejectedResultAttempt1,
      attemptsCount: 3,
    };

    render(<ResultCard result={rejectedResultAttempt3} onRetry={vi.fn()} />);
    expect(screen.getAllByText(/non exploitable/i).length).toBeGreaterThan(0);
  });

  it("[UC5] unknown code opens the confirmation modal", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <UnknownPatientModal
        isOpen={true}
        idPseudo="PT-CAS-9277"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(
      screen.getByText(/ce code n’a pas d’historique/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/PT-CAS-9277/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /créer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annuler/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /créer/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("[UC7] BASELINE_BUILDING result shows « Référence n/3 » and no comparison", () => {
    const buildingResult: CaptureResult = {
      status: "BASELINE_BUILDING",
      idPseudo: "PT-CAS-6603",
      cleanDurationSec: 23.5,
      artifactPct: 3.2,
      meanPressureKpa: 4.8,
      rmsG: 0.142,
      peakFreqHz: 68,
      baselineStep: 2,
      totalBaselineSteps: 3,
      attemptsCount: 1,
    };

    render(<ResultCard result={buildingResult} />);

    // Shows « Référence 2/3 »
    expect(screen.getByText(/référence 2\/3/i)).toBeInTheDocument();
    // Explains baseline building and no comparison before 3 valid measures
    expect(
      screen.getByText(/cette mesure construit la baseline du patient\. aucune comparaison avant 3 mesures valides\./i),
    ).toBeInTheDocument();
    // Must NOT show alert deviation or comparison against baseline
    expect(screen.queryByText(/écart à la baseline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/évolution inhabituelle/i)).not.toBeInTheDocument();
  });

  it("[DISCLAIMER] visible on the result card", () => {
    const normalResult: CaptureResult = {
      status: "NORMAL",
      idPseudo: "PT-CAS-8841",
      cleanDurationSec: 22.9,
      artifactPct: 8.2,
      meanPressureKpa: 4.6,
      rmsG: 0.142,
      peakFreqHz: 68,
      deviationScore: 0.2,
      attemptsCount: 1,
    };

    render(<ResultCard result={normalResult} />);
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  it("[UC2] each pressure zone shows its French state and matching color", () => {
    const zones = [
      { pressure: 2.4, label: "Insuffisant", status: "critical", message: /appui insuffisant/i },
      { pressure: 2.8, label: "Toléré \(faible\)", status: "warning", message: /appui toléré/i },
      { pressure: 4.8, label: "Recommandé", status: "normal", message: /appui correct/i },
      { pressure: 8.7, label: "Toléré \(élevé\)", status: "warning", message: /appui toléré/i },
      { pressure: 9.1, label: "Risque de compression", status: "critical", message: /risque de compression/i },
    ];

    for (const zone of zones) {
      const { unmount } = render(<CaptureClient initialPressure={zone.pressure} />);
      const gauge = screen.getByRole("slider", { name: /pression de contact mesurée/i });
      expect(gauge).toHaveAttribute("data-zone", zone.label);
      expect(gauge).toHaveAttribute("data-status", zone.status);
      expect(screen.getByTestId("pressure-gauge-zone-label")).toHaveClass(`text-${zone.status}-text`);
      expect(screen.getAllByText(zone.message).length).toBeGreaterThan(0);
      unmount();
    }
  }, 30000);

  it("[UC3] ARTIFACT and PRESSURE rejections show a translated cause and attempts one to three", () => {
    for (const [reason, frenchCause] of [
      ["ARTIFACT", "mouvement du bras"],
      ["PRESSURE", "appui hors plage"],
    ]) {
      for (const attemptsCount of [1, 2, 3]) {
        const { unmount } = render(
          <ResultCard
            result={{
              status: "REJECTED_QUALITY",
              idPseudo: "PT-CAS-8841",
              cleanDurationSec: 9.8,
              artifactPct: 24.5,
              meanPressureKpa: 4.6,
              rmsG: 0.12,
              peakFreqHz: 70,
              attemptsCount,
              maxAttempts: 3,
              rejectionReason: reason,
            }}
          />,
        );

        expect(screen.getByText(new RegExp(`cause : ${frenchCause}`, "i"))).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`tentative ${attemptsCount} sur 3`, "i"))).toBeInTheDocument();
        if (attemptsCount === 3) expect(screen.getAllByText(/non exploitable/i).length).toBeGreaterThan(0);
        unmount();
      }
    }
  });

  it("[UC2] capture can be started and completed using only the keyboard", () => {
    vi.useFakeTimers();
    render(<CaptureClient initialPressure={4.8} useFixture />);

    const start = screen.getByRole("button", { name: /démarrer l’acquisition/i });
    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    start.focus();
    fireEvent.keyDown(start, { key: "Enter", code: "Enter" });
    act(() => {
      vi.advanceTimersByTime(26_000);
    });

    expect(screen.getByText(/mesure correcte|évolution inhabituelle/i)).toBeInTheDocument();
  });
});

describe("Capture screen rework 1 (config thresholds, modal focus, canvas alt text, demo labelling)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("[UC2] start button gate uses configured thresholds passed through the capture screen", () => {
    render(<CaptureClient initialPressure={2.8} pressureThresholds={{ pressureMinKpa: 3.0 }} />);
    const startBtn = screen.getByRole("button", { name: /démarrer l’acquisition/i });
    expect(startBtn).toBeDisabled();
    expect(screen.getAllByText(/appui insuffisant/i).length).toBeGreaterThan(0);
  });

  it("[UC5] unknown-code dialog takes keyboard focus, traps Tab and restores focus on close", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(<ModalHarness onConfirm={onConfirm} onCancel={onCancel} />);

    const opener = screen.getByRole("button", { name: /ouvrir la saisie/i });
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);

    const annuler = screen.getByRole("button", { name: /annuler/i });
    const creer = screen.getByRole("button", { name: /créer/i });

    annuler.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(creer);

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(annuler);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it("[UC2] the waveform canvas exposes a text alternative describing the signal", () => {
    const frames: CaptureFrame[] = [
      { timestampSec: 0, thrillValue: 0.1, motionValue: 0.005, pressureKpa: 4.8, isArtifact: false },
      { timestampSec: 0.1, thrillValue: 0.12, motionValue: 0.004, pressureKpa: 4.8, isArtifact: false },
      { timestampSec: 0.2, thrillValue: 0.3, motionValue: 0.9, pressureKpa: 4.8, isArtifact: true },
    ];

    render(
      <LiveSignal
        status="capturing"
        elapsedSec={2.5}
        frames={frames}
        pressureKpa={4.8}
        isFrozen={false}
        onToggleFreeze={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const canvas = screen.getByRole("img", { name: /thrill/i });
    expect(canvas).toHaveAttribute("aria-describedby");
    const summaryId = canvas.getAttribute("aria-describedby") ?? "";
    const summary = document.getElementById(summaryId);
    expect(summary?.textContent).toMatch(/2,5 s/i);
    expect(summary?.textContent).toMatch(/artéfact/i);
  });

  it("[UC2] synthetic results are labelled « Mode démonstration » on the result card", () => {
    const demoResult: CaptureResult = {
      status: "NORMAL",
      idPseudo: "PT-CAS-8841",
      cleanDurationSec: 23.5,
      artifactPct: 6.0,
      meanPressureKpa: 4.8,
      rmsG: 0.142,
      peakFreqHz: 68,
      deviationScore: 0.2,
      attemptsCount: 1,
      demo: true,
    };

    render(<ResultCard result={demoResult} />);
    expect(screen.getByText(/mode démonstration/i)).toBeInTheDocument();
  });
});

describe("Capture screen rework 2 (stable pressure gate, TO_CONFIRM neutrality, live mode data)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("[UC2] start stays disabled until 1,0 s of continuous valid pressure and resets on pressure loss", () => {
    vi.useFakeTimers();
    render(<CaptureClient initialPressure={4.8} useFixture />);

    const start = screen.getByRole("button", { name: /démarrer l’acquisition/i });
    expect(start).toBeDisabled();
    expect(screen.getAllByText(/appui stable 1,0 s|maintenez un appui stable/i).length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    expect(start).not.toBeDisabled();

    // Pressure leaves the valid window: the timer restarts from zero
    fireEvent.click(screen.getByRole("button", { name: /1,8 kpa/i }));
    expect(start).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(screen.getByRole("button", { name: /4,8 kpa/i }));
    expect(start).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    expect(start).not.toBeDisabled();
  });

  it("[UC6] TO_CONFIRM shows the neutral confirmation line and numbers only, with no alert styling", () => {
    const toConfirmResult: CaptureResult = {
      status: "TO_CONFIRM",
      idPseudo: "PT-CAS-5530",
      cleanDurationSec: 22.9,
      artifactPct: 8.2,
      meanPressureKpa: 4.6,
      rmsG: 0.142,
      peakFreqHz: 68,
      deviationScore: 3.6,
      threshold: 3.4,
      deltaRmsPct: -12,
      historyRmsBaseline: 0.145,
      attemptsCount: 1,
    };

    const { container } = render(<ResultCard result={toConfirmResult} />);

    // Neutral confirmation line, measured numbers remain visible
    expect(screen.getAllByText(/à confirmer à la prochaine séance/i).length).toBeGreaterThan(0);
    expect(screen.getByText("0,142")).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument();
    expect(screen.getByText("3,6")).toBeInTheDocument();

    // No alert wording before medical confirmation
    expect(screen.queryByText(/au-dessus du seuil/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dans la tolérance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/évolution inhabituelle/i)).not.toBeInTheDocument();

    // No amber or red alert styling anywhere in the card
    expect(container.querySelector('[class*="warning"]')).toBeNull();
    expect(container.querySelector('[class*="critical"]')).toBeNull();
  });

  it("[UC5] live mode starts with no fabricated patient or device data; demo data is labelled", () => {
    const { unmount } = render(<CaptureClient initialPressure={4.8} />);

    expect(screen.getByRole("button", { name: /sélectionner un patient/i })).toBeInTheDocument();
    expect(screen.queryByText("PT-CAS-8841")).not.toBeInTheDocument();
    expect(screen.queryByText(/environ \d+ mesures/i)).not.toBeInTheDocument();
    expect(screen.getByText(/aucun boîtier connecté/i)).toBeInTheDocument();
    unmount();

    render(<CaptureClient initialPressure={4.8} useFixture />);
    expect(screen.getByText("PT-CAS-8841")).toBeInTheDocument();
    expect(screen.getAllByText(/mode démonstration/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/environ \d+ mesures/i)).toBeInTheDocument();
  });
});

describe("Capture screen rework 3 (measurement creation, neutral TO_CONFIRM header, live data honesty)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("[UC9] TO_CONFIRM header is the neutral confirmation line, never « Mesure correcte »", () => {
    const toConfirmResult: CaptureResult = {
      status: "TO_CONFIRM",
      idPseudo: "PT-CAS-5530",
      cleanDurationSec: 22.9,
      artifactPct: 8.2,
      meanPressureKpa: 4.6,
      rmsG: 0.142,
      peakFreqHz: 68,
      deviationScore: 3.6,
      threshold: 3.4,
      attemptsCount: 1,
    };

    render(<ResultCard result={toConfirmResult} />);

    expect(screen.getAllByText(/à confirmer à la prochaine séance/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/mesure correcte/i)).not.toBeInTheDocument();
    expect(screen.getByText("0,142")).toBeInTheDocument();
    expect(screen.getByText("3,6")).toBeInTheDocument();
  });

  it("[UC1] live start failure shows the French error and a Réessayer button, staying pre-capture", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    render(<CaptureClient initialPressure={4.8} initialDevice={LIVE_DEVICE} />);
    act(() => {
      vi.advanceTimersByTime(1_100);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /démarrer l’acquisition/i }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Impossible de démarrer la mesure. Réessayez.",
    );
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /démarrer l’acquisition/i })).toBeInTheDocument();
    expect(screen.queryByText(/analyse du signal en cours/i)).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /réessayer/i }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("[UC1] live mode shows an em dash for RMS and frequency and no artifact band before data arrives", () => {
    render(<CaptureClient initialPressure={0} />);

    expect(screen.getAllByText("—").length).toBe(2);
    expect(screen.queryByText("0,142")).not.toBeInTheDocument();
    expect(screen.queryByText("68")).not.toBeInTheDocument();
    expect(screen.queryByText(/artéfact écarté/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/aucun artéfact/i).length).toBeGreaterThan(0);
  });

  it("[UC1] sample RMS and frequency values appear only in the labelled demo mode", () => {
    render(<CaptureClient initialPressure={4.8} useFixture />);

    expect(screen.getAllByText(/mode démonstration/i).length).toBeGreaterThan(0);
    expect(screen.getByText("0,142")).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument();
  });

  it("[UC1] [UC5] live-signal renders axes, grid, legend and the idle message without any frames; the verbose sentence is sr-only", () => {
    render(
      <LiveSignal
        status="idle"
        deviceConnected={false}
        elapsedSec={0}
        frames={[]}
        pressureKpa={0}
        isFrozen={false}
        onToggleFreeze={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    // Axes and ticks
    expect(screen.getAllByText(/0 s|25 s/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0,00 g|\+0,50 g|-0,50 g/i).length).toBeGreaterThan(0);

    // Legend
    expect(screen.getByText(/Thrill ADXL355/i)).toBeInTheDocument();
    expect(screen.getByText(/Mouvement LIS2DW12/i)).toBeInTheDocument();

    // Idle message
    expect(screen.getByText("En attente de l'appareil")).toBeInTheDocument();

    // Summary sentence is sr-only
    const summary = screen.getByText(/signal thrill et mouvement en direct/i);
    expect(summary).toHaveClass("sr-only");
  });

  it("[UC1] [UC2] live-signal reserves 48px left margin and 24px bottom margin, and freeze button sits in top header", () => {
    const { container } = render(
      <LiveSignal
        status="idle"
        deviceConnected={true}
        elapsedSec={0}
        frames={[]}
        pressureKpa={4.8}
        isFrozen={false}
        onToggleFreeze={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    // Freeze button should be in the top card header row
    const freezeBtn = screen.getByRole("button", { name: /figer l’affichage/i });
    expect(freezeBtn).toBeInTheDocument();
    // The button must NOT be absolutely positioned inside the waveform plot tile
    expect(freezeBtn).not.toHaveClass("absolute");

    // Check SVG grid or text coordinates for 48px left margin
    const svg = container.querySelector("svg[role='presentation']");
    expect(svg).toBeInTheDocument();
    const yTexts = svg?.querySelectorAll("text[text-anchor='end']");
    expect(yTexts?.length).toBeGreaterThan(0);
    // Y text x coordinate should be margin.left - 6 = 42
    expect(yTexts?.[0]?.getAttribute("x")).toBe("42");
  });

  it("[UC4] motion epochs above 0.08 g draw the mask element for those seconds", () => {
    const framesWithMotion: CaptureFrame[] = [
      { timestampSec: 0.5, thrillValue: 0.1, motionValue: 0.02, pressureKpa: 4.8, isArtifact: false },
      { timestampSec: 1.0, thrillValue: 0.1, motionValue: 0.09, pressureKpa: 4.8, isArtifact: true },
      { timestampSec: 1.5, thrillValue: 0.1, motionValue: 0.11, pressureKpa: 4.8, isArtifact: true },
      { timestampSec: 2.0, thrillValue: 0.1, motionValue: 0.03, pressureKpa: 4.8, isArtifact: false },
    ];

    render(
      <LiveSignal
        status="capturing"
        deviceConnected={true}
        elapsedSec={2.0}
        frames={framesWithMotion}
        pressureKpa={4.8}
        isFrozen={false}
        onToggleFreeze={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const masks = screen.getAllByTestId("motion-epoch-mask");
    expect(masks.length).toBeGreaterThan(0);
  });

  it("[UC2] pressure strip shows the 3.0 to 8.5 kPa band; blocked state text below 2.5 and above 9.0", () => {
    // Low pressure: < 2.5 kPa
    const { unmount } = render(
      <LiveSignal
        status="idle"
        deviceConnected={true}
        elapsedSec={0}
        frames={[]}
        pressureKpa={1.8}
        isFrozen={false}
        onToggleFreeze={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/3,0 à 8,5 kPa/i)).toBeInTheDocument();
    expect(screen.getByTestId("pressure-strip-blocked")).toHaveTextContent(/< 2,5 kPa/);
    unmount();

    // High pressure: > 9.0 kPa
    render(
      <LiveSignal
        status="idle"
        deviceConnected={true}
        elapsedSec={0}
        frames={[]}
        pressureKpa={10.2}
        isFrozen={false}
        onToggleFreeze={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/3,0 à 8,5 kPa/i)).toBeInTheDocument();
    expect(screen.getByTestId("pressure-strip-blocked")).toHaveTextContent(/> 9,0 kPa/);
  });

  it("demo mode: switching it on feeds the recorded frames and reaches a result", () => {
    vi.useFakeTimers();

    render(<CaptureClient initialPressure={0} />);

    // Toggle demo mode
    const demoBtn = screen.getByRole("button", { name: /mode démonstration : désactivé/i });
    fireEvent.click(demoBtn);

    // Verify Données simulées badge appears
    expect(screen.getAllByText(/données simulées/i).length).toBeGreaterThan(0);

    // Advance timers so it auto-starts and finishes 25 s playback + 500ms analysis
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // Reaches result card
    expect(screen.getByText(/durée propre/i)).toBeInTheDocument();
    expect(screen.getAllByText(/mode démonstration/i).length).toBeGreaterThan(0);
  }, 15000);
});
