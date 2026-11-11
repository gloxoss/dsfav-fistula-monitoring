"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Disclaimer } from "@/components/shared/disclaimer";
import {
  PressureGauge,
  findPressureZone,
  type ClinicalPressureThresholds,
  CANONICAL_PRESSURE_THRESHOLDS,
} from "@/components/ui/pressure-gauge";
import { PatientPicker } from "./patient-picker";
import { DeviceCard } from "./device-card";
import { ProtocolCard } from "./protocol-card";
import { LiveSignal } from "./live-signal";
import { QualityCard } from "./quality-card";
import { ResultCard } from "./result-card";
import { UnknownPatientModal } from "./unknown-patient-modal";
import { CAPTURE_SESSION_EXPIRED_ERROR, useCaptureSocket } from "../hooks/use-capture-socket";
import type { DeviceInfo, PatientSummary } from "../model/types";
import { DEMO_DEVICE, DEMO_INITIAL_PRESSURE_KPA, DEMO_PATIENTS } from "../data/demo-capture";

export interface CaptureClientProps {
  initialPressure?: number;
  initialPatient?: PatientSummary;
  /** Real patients from the API (live mode) */
  initialPatients?: PatientSummary[];
  initialDevice?: DeviceInfo | null;
  pressureThresholds?: Partial<ClinicalPressureThresholds>;
  useFixture?: boolean;
}

export function CaptureClient({
  initialPressure = 0,
  initialPatient,
  initialPatients,
  initialDevice = null,
  pressureThresholds,
  useFixture = false,
}: CaptureClientProps) {
  const livePatients = initialPatients ?? (initialPatient ? [initialPatient] : []);
  const [patient, setPatient] = useState<PatientSummary | null>(
    useFixture ? (DEMO_PATIENTS[0] ?? null) : (initialPatient ?? null),
  );
  const [patientsList, setPatientsList] = useState<PatientSummary[]>(
    useFixture ? DEMO_PATIENTS : livePatients,
  );
  const [device, setDevice] = useState<DeviceInfo | null>(
    useFixture ? DEMO_DEVICE : initialDevice,
  );
  const [unknownModalId, setUnknownModalId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(useFixture);

  const effectiveThresholds: ClinicalPressureThresholds = {
    pressureMinKpa: pressureThresholds?.pressureMinKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureMinKpa,
    pressureLowKpa: pressureThresholds?.pressureLowKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureLowKpa,
    pressureHighKpa: pressureThresholds?.pressureHighKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureHighKpa,
    pressureMaxKpa: pressureThresholds?.pressureMaxKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureMaxKpa,
  };

  const {
    status,
    pressureKpa,
    stablePressureSec,
    elapsedSec,
    targetDurationSec,
    metrics,
    frames,
    artifactIntervals,
    attemptsCount,
    result,
    startError,
    resumeMeasurementId,
    isFrozen,
    setIsFrozen,
    startCapture,
    stopCapture,
    retryCapture,
    resetCapture,
    setSimulatedPressure,
  } = useCaptureSocket({
    initialPressure: isDemoMode ? DEMO_INITIAL_PRESSURE_KPA : initialPressure,
    idPseudo: patient?.idPseudo ?? "",
    deviceId: device?.id,
    useFixture: isDemoMode,
    pressureThresholds: effectiveThresholds,
  });

  const activeZone = findPressureZone(pressureKpa, effectiveThresholds);
  const isPressureTooLow = pressureKpa < effectiveThresholds.pressureMinKpa;
  const isPressureTooHigh = pressureKpa > effectiveThresholds.pressureMaxKpa;

  function handleUnknownPatientCode(code: string) {
    setUnknownModalId(code);
  }

  function handleConfirmCreatePatient() {
    if (!unknownModalId) return;
    const newPatient: PatientSummary = {
      idPseudo: unknownModalId,
      fistulaType: "brachio-céphalique",
      side: "gauche",
      sessionsCount: 0,
      baselineStatus: "NONE",
    };
    setPatientsList((prev) => [newPatient, ...prev]);
    setPatient(newPatient);
    setUnknownModalId(null);
  }

  function handleNextPatient() {
    resetCapture();
    if (!patient || patientsList.length === 0) return;
    const nextIdx = (patientsList.findIndex((p) => p.idPseudo === patient.idPseudo) + 1) % patientsList.length;
    const nextPatient = patientsList[nextIdx];
    if (nextPatient) setPatient(nextPatient);
  }

  function toggleDemoMode() {
    const nextDemo = !isDemoMode;
    resetCapture();
    setIsDemoMode(nextDemo);
    if (nextDemo) {
      setPatientsList(DEMO_PATIENTS);
      setPatient(DEMO_PATIENTS[0] ?? null);
      setDevice(DEMO_DEVICE);
      setSimulatedPressure(DEMO_INITIAL_PRESSURE_KPA);
    } else {
      setPatientsList(livePatients);
      setPatient(initialPatient ?? null);
      setDevice(initialDevice);
      setSimulatedPressure(0);
    }
  }

  // Demo playback auto-start when mode is switched on
  useEffect(() => {
    if (isDemoMode && status === "idle") {
      const timer = setTimeout(() => {
        startCapture();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isDemoMode, startCapture, status]);

  const showResultCard = status === "completed" || status === "rejected" || status === "analyzing";

  return (
    <div className="space-y-6">
      {/* Top Patient Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-hairline/60">
        <div>
          <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
            Patient sélectionné
          </span>
          <div className="mt-1">
            <PatientPicker
              currentPatient={patient}
              patientsList={patientsList}
              onSelectPatient={(p) => {
                resetCapture();
                setPatient(p);
              }}
              onUnknownPatientCode={handleUnknownPatientCode}
            />
          </div>
        </div>

        {/* Demo mode control; live mode carries no synthetic patient, device or pressure data */}
        <div className="flex flex-wrap items-center gap-2">
          {isDemoMode ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning-tint text-warning-text border border-warning/30">
              Données simulées
            </span>
          ) : null}

          <button
            type="button"
            aria-pressed={isDemoMode}
            onClick={toggleDemoMode}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              isDemoMode
                ? "bg-primary text-white border-primary shadow-xs font-semibold"
                : "bg-surface text-text-secondary border-hairline hover:bg-well"
            }`}
          >
            {isDemoMode ? "Mode démonstration : activé" : "Mode démonstration : désactivé"}
          </button>

          {isDemoMode ? (
            <div className="flex items-center gap-1.5 text-xs bg-surface p-1.5 rounded-full border border-hairline shadow-2xs">
              <span className="text-[11px] text-text-muted px-2">Simulateur :</span>
              <button
                type="button"
                onClick={() => setSimulatedPressure(1.8)}
                className={`px-2 py-1 rounded-full text-[11px] font-medium transition ${
                  pressureKpa === 1.8 ? "bg-critical-tint text-critical-text font-bold" : "text-text-secondary hover:bg-well"
                }`}
              >
                1,8 kPa
              </button>
              <button
                type="button"
                onClick={() => setSimulatedPressure(4.8)}
                className={`px-2 py-1 rounded-full text-[11px] font-medium transition ${
                  pressureKpa === 4.8 ? "bg-normal-tint text-normal-text font-bold" : "text-text-secondary hover:bg-well"
                }`}
              >
                4,8 kPa
              </button>
              <button
                type="button"
                onClick={() => setSimulatedPressure(10.2)}
                className={`px-2 py-1 rounded-full text-[11px] font-medium transition ${
                  pressureKpa === 10.2 ? "bg-critical-tint text-critical-text font-bold" : "text-text-secondary hover:bg-well"
                }`}
              >
                10,2 kPa
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ROW 1: 3 cards (4 + 4 + 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Appui sur la FAV */}
        <div className="bg-surface rounded-[28px] p-6 shadow-[var(--shadow-card)] flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="w-11 h-11 rounded-full bg-normal-tint text-normal-text flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2v4" />
                  <path d="m4.93 4.93 2.83 2.83" />
                  <path d="M2 12h4" />
                  <path d="m4.93 19.07 2.83-2.83" />
                  <path d="M12 22v-4" />
                  <path d="m19.07 19.07-2.83-2.83" />
                  <path d="M22 12h-4" />
                  <path d="m19.07 4.93-2.83 2.83" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-text-label uppercase tracking-wider">
                Appui sur la FAV
              </span>
            </div>

            <PressureGauge
              value={pressureKpa}
              thresholds={effectiveThresholds}
              className="[&>div:last-child]:flex-col [&>div:last-child]:items-start [&>div:last-child]:gap-1"
            />
          </div>

          {/* Blocked pressure (too low / too high) is stated once, in the pressure strip below; this footer only confirms usable states. */}
          <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between">
            {isPressureTooLow || isPressureTooHigh ? (
              <span className="text-xs text-text-secondary">
                {isPressureTooLow ? "Repositionnez le capteur" : "Relâchez la pression"}
              </span>
            ) : activeZone.status === "normal" ? (
              <span role="status" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-normal-tint text-normal-text">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Appui correct · prêt
              </span>
            ) : (
              <span role="status" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning-tint text-warning-text">
                <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                Appui toléré · {activeZone.label.toLowerCase()}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Appareil (Dark Feature Card) */}
        <DeviceCard device={device} />

        {/* Card 3: Protocole (Mustard Card) */}
        <ProtocolCard />
      </div>

      {startError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-critical-text/20 bg-critical-tint px-5 py-4"
        >
          <p className="text-sm font-medium text-critical-text">{startError}</p>
          {startError === CAPTURE_SESSION_EXPIRED_ERROR ? (
            <Link href="/login" className="text-sm font-semibold text-critical-text underline underline-offset-2">
              Se reconnecter
            </Link>
          ) : null}
          <button
            type="button"
            onClick={startCapture}
            className="inline-flex items-center rounded-full bg-critical-text px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {resumeMeasurementId ? (
        <p role="status" data-testid="capture-measurement-id" className="text-xs text-text-secondary">
          Séance reprise : <span className="font-mono">{resumeMeasurementId}</span>
        </p>
      ) : null}

      {/* ROW 2: Live Stream OR Result Card */}
      {showResultCard ? (
        <ResultCard
          result={result}
          isAnalyzing={status === "analyzing"}
          onNextPatient={handleNextPatient}
          onRetry={retryCapture}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8">
            <LiveSignal
              status={status}
              deviceConnected={device?.connected ?? false}
              elapsedSec={elapsedSec}
              targetDurationSec={targetDurationSec}
              frames={frames}
              artifactIntervals={artifactIntervals}
              pressureKpa={pressureKpa}
              pressureThresholds={effectiveThresholds}
              stablePressureSec={stablePressureSec}
              attemptsCount={attemptsCount}
              isFrozen={isFrozen}
              onToggleFreeze={() => setIsFrozen((prev) => !prev)}
              onStart={startCapture}
              onStop={stopCapture}
              onRetry={retryCapture}
            />
          </div>

          <div className="lg:col-span-4">
            <QualityCard metrics={metrics} />
          </div>
        </div>
      )}

      {/* FOOTER LINE: Quiet disclaimer on left, secure sync on right */}
      <footer className="pt-4 pb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-text-muted border-t border-hairline/60">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-primary shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <Disclaimer />
        </div>

        <div className="inline-flex items-center gap-2 text-normal-text font-medium shrink-0">
          <span className="w-2 h-2 rounded-full bg-normal-text" />
          <span>Synchronisation sécurisée</span>
        </div>
      </footer>

      {/* Modal for unknown patient code */}
      <UnknownPatientModal
        isOpen={Boolean(unknownModalId)}
        idPseudo={unknownModalId || ""}
        onConfirm={handleConfirmCreatePatient}
        onCancel={() => setUnknownModalId(null)}
      />
    </div>
  );
}
