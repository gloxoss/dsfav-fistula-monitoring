"use client";

import { useState } from "react";
import { Disclaimer } from "@/components/shared/disclaimer";
import { Card } from "@/components/ui/card";
import { PillButton } from "@/components/ui/pill-button";
import {
  benchErrorMessage,
  createBenchSession,
  isCaptureRejection,
  revealBenchSession,
  submitBenchPalpation,
} from "../data/bench-api";
import {
  DEMO_BENCH_NOTES,
  DEMO_BENCH_OBJECTIVE,
  DEMO_BENCH_RESULT,
  DEMO_BENCH_SESSION,
  DEMO_BENCH_SETUP,
} from "../data/demo-bench";
import {
  BENCH_CAPTURE_CREATING,
  BENCH_CAPTURE_IDLE_HINT,
  BENCH_CAPTURE_RECEIVED,
  BENCH_CAPTURE_REJECTED_FALLBACK,
  BENCH_CAPTURE_RUNNING,
  BENCH_CLAMP_DEFAULT_PCT,
  BENCH_DEMO_LABEL,
  BENCH_DEVICE_CONFIG_ERROR,
  BENCH_FLOW_DEFAULT_ML_MIN,
} from "../model/constants";
import { resolveBenchDeviceId } from "../model/bench-device";
import { useBenchCapture } from "../hooks/use-bench-capture";
import type {
  BenchObjectiveData,
  BenchSessionResult,
  BenchSessionSummary,
  BenchSetup,
  BenchStep,
  PalpationInput,
  PerceivedThrill,
} from "../model/types";
import { BenchStepper } from "./bench-stepper";
import { BenchSetupCard } from "./bench-setup-card";
import { ConcordanceCard } from "./concordance-card";
import { ObjectiveCard } from "./objective-card";
import { PalpationCard, type PalpationDraft } from "./palpation-card";

export interface BenchClientProps {
  demo?: boolean;
  initialSession?: BenchSessionSummary | null;
  measurementId?: string | null;
  deviceId?: string | null;
  objective?: BenchObjectiveData | null;
}

type BusyState = "initializing" | "palpation" | "revealing" | null;
type RetryKind = "init" | "palpation" | "reveal" | null;

function initialDraft(session: BenchSessionSummary | null): PalpationDraft {
  return {
    perceivedThrill: session?.perceivedThrill ?? null,
    perceivedIntensity: session?.perceivedIntensity ?? null,
    internNotes: "",
  };
}

export function BenchClient({
  demo = false,
  initialSession = null,
  measurementId = null,
  deviceId = null,
  objective = null,
}: BenchClientProps) {
  const benchDeviceId = demo ? null : resolveBenchDeviceId(deviceId);
  const captureConfigured = demo || benchDeviceId !== null;
  const capture = useBenchCapture({ deviceId: benchDeviceId });
  const [setup, setSetup] = useState<BenchSetup>(
    demo
      ? DEMO_BENCH_SETUP
      : { pumpFlowMlMin: BENCH_FLOW_DEFAULT_ML_MIN, clampStenosisPct: BENCH_CLAMP_DEFAULT_PCT },
  );
  const [session, setSession] = useState<BenchSessionSummary | null>(
    demo ? DEMO_BENCH_SESSION : initialSession,
  );
  const [draft, setDraft] = useState<PalpationDraft>(initialDraft(demo ? DEMO_BENCH_SESSION : initialSession));
  const [lockedLocal, setLockedLocal] = useState(false);
  const [savedNotes, setSavedNotes] = useState<string | null>(demo ? DEMO_BENCH_NOTES : null);
  const [result, setResult] = useState<BenchSessionResult | null>(demo ? DEMO_BENCH_RESULT : null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [retryKind, setRetryKind] = useState<RetryKind>(null);
  const [saved, setSaved] = useState(false);

  const locked =
    demo ||
    lockedLocal ||
    (session?.perceivedThrill != null && session?.perceivedIntensity != null);

  const step: BenchStep = !session ? 1 : !locked ? 2 : 3;

  const lockedValues =
    locked && session?.perceivedThrill && session?.perceivedIntensity != null
      ? {
          perceivedThrill: session.perceivedThrill,
          perceivedIntensity: session.perceivedIntensity,
          internNotes: savedNotes,
        }
      : null;

  const revealedObjective = demo ? DEMO_BENCH_OBJECTIVE : (capture.objective ?? objective);
  const activeMeasurementId = capture.measurementId ?? measurementId;
  const activeRejectionMessage = rejectionMessage ?? capture.rejectionMessage;
  const activeError = error ?? capture.startError;
  const canReveal = Boolean(measurementId) || capture.status === "completed";
  const isCapturing = capture.status === "creating" || capture.status === "capturing";

  async function handleInitialize() {
    if (demo) {
      setSession(DEMO_BENCH_SESSION);
      return;
    }
    setBusy("initializing");
    setError(null);
    setRetryKind(null);
    try {
      const created = await createBenchSession(setup);
      setSession(created);
      setDraft(initialDraft(created));
    } catch (caught) {
      setError(benchErrorMessage(caught));
      setRetryKind("init");
    } finally {
      setBusy(null);
    }
  }

  async function handleValidatePalpation() {
    if (!session || draft.perceivedThrill === null || draft.perceivedIntensity === null) {
      return;
    }
    const notes = draft.internNotes.trim();
    const payload: PalpationInput = {
      perceivedThrill: draft.perceivedThrill as PerceivedThrill,
      perceivedIntensity: draft.perceivedIntensity,
      internNotes: notes.length > 0 ? notes : null,
    };
    setBusy("palpation");
    setError(null);
    setRetryKind(null);
    try {
      const updated = await submitBenchPalpation(session.id, payload);
      setSession(updated);
      setSavedNotes(payload.internNotes);
      setLockedLocal(true);
    } catch (caught) {
      setError(benchErrorMessage(caught));
      setRetryKind("palpation");
    } finally {
      setBusy(null);
    }
  }

  async function handleReveal() {
    if (!session || !locked) {
      return;
    }
    if (demo) {
      setResult(DEMO_BENCH_RESULT);
      return;
    }
    if (!activeMeasurementId) {
      setError("Aucune mesure n’est associée à cette séance. Lancez une capture sur le banc, puis réessayez.");
      setRetryKind(null);
      return;
    }
    setBusy("revealing");
    setError(null);
    setRetryKind(null);
    setRejectionMessage(null);
    try {
      setResult(await revealBenchSession(session.id, activeMeasurementId));
    } catch (caught) {
      if (isCaptureRejection(caught)) {
        const message = benchErrorMessage(caught);
        setRejectionMessage(
          message.trim().length > 0 ? message : BENCH_CAPTURE_REJECTED_FALLBACK,
        );
      } else {
        setError(benchErrorMessage(caught));
        setRetryKind("reveal");
      }
    } finally {
      setBusy(null);
    }
  }

  function handleRetry() {
    if (retryKind === "init") {
      void handleInitialize();
    } else if (retryKind === "palpation") {
      void handleValidatePalpation();
    } else if (retryKind === "reveal") {
      void handleReveal();
    } else if (capture.startError) {
      capture.retryStart();
    }
  }

  function handleRestartCapture() {
    setRejectionMessage(null);
    capture.resetCapture();
    setError(null);
    setRetryKind(null);
  }

  function handleSaveSession() {
    if (result) {
      setSaved(true);
    }
  }

  function handleRestart() {
    if (demo) {
      setSetup(DEMO_BENCH_SETUP);
      setSession(DEMO_BENCH_SESSION);
      setDraft(initialDraft(DEMO_BENCH_SESSION));
      setSavedNotes(DEMO_BENCH_NOTES);
      setResult(DEMO_BENCH_RESULT);
    } else {
      setSetup({
        pumpFlowMlMin: BENCH_FLOW_DEFAULT_ML_MIN,
        clampStenosisPct: BENCH_CLAMP_DEFAULT_PCT,
      });
      setSession(initialSession);
      setDraft(initialDraft(initialSession));
      setSavedNotes(null);
      setResult(null);
    }
    setLockedLocal(false);
    setRejectionMessage(null);
    capture.resetCapture();
    setError(null);
    setRetryKind(null);
    setBusy(null);
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BenchStepper current={step} />
        {demo ? (
          <span className="rounded-full bg-periwinkle-tint px-3 py-1 text-xs font-medium text-artifact-text">
            {BENCH_DEMO_LABEL}
          </span>
        ) : null}
      </div>

      {activeError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-critical-tint p-4 text-sm font-medium text-critical-text"
        >
          <p>{activeError}</p>
          {retryKind || capture.startError ? (
            <PillButton type="button" variant="secondary" size="sm" onClick={handleRetry}>
              Réessayer
            </PillButton>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <BenchSetupCard
          setup={setup}
          onChange={setSetup}
          locked={Boolean(session)}
          onInitialize={() => void handleInitialize()}
          isInitializing={busy === "initializing"}
        />

        {step === 1 ? (
          <Card className="flex flex-col justify-center space-y-5 p-6 lg:col-span-2">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-text-primary uppercase">
                Protocole d’entraînement au banc
              </h2>
              <p className="mt-1 text-xs text-text-secondary">
                Suivez les trois étapes pour comparer votre évaluation tactile aux mesures objectives du banc.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 rounded-2xl bg-well p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    1
                  </span>
                  <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-text-primary">1. Configurer le banc</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Réglez le débit de la pompe et la sténose du fantôme, puis cliquez sur « Initialiser le banc ».
                </p>
              </div>

              <div className="space-y-2 rounded-2xl bg-well p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    2
                  </span>
                  <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-text-primary">
                  2. Décrire la palpation avant de voir les mesures
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Consignez votre sensation tactile et l’intensité ressentie à l’aveugle avant toute révélation.
                </p>
              </div>

              <div className="space-y-2 rounded-2xl bg-well p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    3
                  </span>
                  <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-text-primary">3. Comparer avec les mesures</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Déclenchez la capture capteur, révélez le signal objectif et visualisez l’indice de concordance.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-hairline bg-surface p-3 text-xs text-text-muted">
              Règle d’aveugle : le serveur refuse de révéler les données objectives tant que votre palpation n’a pas été enregistrée.
            </div>
          </Card>
        ) : (
          <>
            <PalpationCard
              locked={locked}
              draft={draft}
              lockedValues={lockedValues}
              onChange={setDraft}
              onValidate={() => void handleValidatePalpation()}
              isValidating={busy === "palpation"}
            />
            <ConcordanceCard result={result} />
          </>
        )}
      </div>

      {step >= 2 ? (
        <div className="space-y-4">
          <ObjectiveCard
            step={step}
            revealed={result !== null}
            objective={revealedObjective}
            result={result}
            rejectionMessage={activeRejectionMessage}
            onRestartCapture={handleRestartCapture}
          />

          {step === 3 && !result && !activeRejectionMessage ? (
            <div className="flex flex-wrap items-center gap-3">
              {canReveal ? (
                <PillButton
                  type="button"
                  onClick={() => void handleReveal()}
                  isLoading={busy === "revealing"}
                >
                  Révéler la mesure
                </PillButton>
              ) : (
                <PillButton
                  type="button"
                  onClick={capture.startCapture}
                  isLoading={isCapturing}
                  disabled={!captureConfigured}
                  aria-describedby="bench-capture-reason"
                >
                  Lancer la capture
                </PillButton>
              )}
              <p id="bench-capture-reason" role="status" className="text-xs text-text-label">
                {canReveal
                  ? BENCH_CAPTURE_RECEIVED
                  : !captureConfigured
                    ? BENCH_DEVICE_CONFIG_ERROR
                    : capture.status === "creating"
                      ? BENCH_CAPTURE_CREATING
                      : capture.status === "capturing"
                        ? BENCH_CAPTURE_RUNNING
                        : BENCH_CAPTURE_IDLE_HINT}
              </p>
            </div>
          ) : null}

          {result ? (
            <div className="flex flex-wrap items-center gap-3">
              <PillButton type="button" onClick={handleSaveSession}>
                Enregistrer la séance
              </PillButton>
              <PillButton type="button" variant="secondary" onClick={handleRestart}>
                Recommencer
              </PillButton>
              {saved ? (
                <p role="status" className="text-sm font-medium text-normal-text">
                  Séance enregistrée.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="pt-4 pb-8">
        <Disclaimer />
      </footer>
    </div>
  );
}
