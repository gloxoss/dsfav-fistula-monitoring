"use client";

import Link from "next/link";
import { Disclaimer } from "@/components/shared/disclaimer";
import { PillButton } from "@/components/ui/pill-button";
import { AiOpinionCard } from "@/features/ai";
import { Spectrogram } from "@/components/charts/spectrogram";
import { ReferenceBarChart } from "@/components/charts/reference-bar-chart";
import type { CaptureResult } from "../model/types";

export interface ResultCardProps {
  result?: CaptureResult | null;
  isAnalyzing?: boolean;
  isOfflineQueued?: boolean;
  offlineQueueCount?: number;
  onNextPatient?: () => void;
  onRetry?: () => void;
  onRetrySync?: () => void;
  className?: string;
}

function rejectionLabel(reason?: string): string {
  if (!reason || reason === "ARTIFACT") return "mouvement du bras";
  if (reason === "PRESSURE") return "appui hors plage";
  return reason;
}

export function ResultCard({
  result,
  isAnalyzing = false,
  isOfflineQueued = false,
  offlineQueueCount = 0,
  onNextPatient,
  onRetry,
  onRetrySync,
  className = "",
}: ResultCardProps) {
  // State h: Analyzing / uploading
  if (isAnalyzing) {
    return (
      <div
        role="status"
        aria-label="Analyse du signal en cours"
        className={`bg-surface rounded-[28px] p-6 lg:p-8 shadow-[var(--shadow-card)] space-y-6 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <h3 className="text-lg font-semibold text-text-primary">
            Analyse du signal en cours…
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div aria-hidden="true" className="h-28 bg-well rounded-[20px] animate-pulse" />
          <div aria-hidden="true" className="h-28 bg-well rounded-[20px] animate-pulse" />
          <div aria-hidden="true" className="h-28 bg-well rounded-[20px] animate-pulse" />
        </div>
        <div className="pt-4 border-t border-hairline">
          <Disclaimer />
        </div>
      </div>
    );
  }

  // State i: Offline queued
  if (isOfflineQueued) {
    return (
      <div
        className={`bg-surface rounded-[28px] p-6 lg:p-8 border border-warning-text/20 shadow-[var(--shadow-card)] space-y-6 ${className}`}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning-tint text-warning-text">
              Connexion perdue · mesure gardée sur cette tablette · en attente : {offlineQueueCount}
            </span>
            <h3 className="text-xl font-semibold text-text-primary mt-2">
              Session enregistrée hors ligne
            </h3>
            <p className="text-sm text-text-secondary">
              Les données brutes sont conservées dans la mémoire locale de la tablette. La synchronisation reprendra dès le rétablissement du réseau.
            </p>
          </div>
          {onRetrySync ? (
            <PillButton variant="secondary" size="md" onClick={onRetrySync}>
              Réessayer l’envoi
            </PillButton>
          ) : null}
        </div>
        <div className="pt-4 border-t border-hairline">
          <Disclaimer />
        </div>
      </div>
    );
  }

  if (!result) return null;

  const isRejected = result.status === "REJECTED_QUALITY";
  const isBaselineBuilding = result.status === "BASELINE_BUILDING";
  const isUnusual = result.status === "UNUSUAL_EVOLUTION";
  const isToConfirm = result.status === "TO_CONFIRM";
  const isNormal = result.status === "NORMAL";

  const maxAttempts = result.maxAttempts || 3;
  const attempts = Math.max(1, Math.min(result.attemptsCount || 1, maxAttempts));
  const isNonExploitable = isRejected && attempts >= maxAttempts;

  const formattedCleanDuration = result.cleanDurationSec.toFixed(1).replace(".", ",");
  const formattedArtifactPct = result.artifactPct.toFixed(1).replace(".", ",");
  const formattedMeanPressure = result.meanPressureKpa.toFixed(1).replace(".", ",");
  const formattedRms = result.rmsG.toFixed(3).replace(".", ",");
  const formattedFreq = Math.round(result.peakFreqHz).toString();
  const formattedDeviation = result.deviationScore !== undefined ? result.deviationScore.toFixed(1).replace(".", ",") : null;

  return (
    <div
      className={`bg-surface rounded-[28px] p-6 lg:p-8 shadow-[var(--shadow-card)] space-y-6 ${className}`}
    >
      {/* Header status bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Status pill according to state */}
          {isRejected ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-critical-tint text-critical-text">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              <span>{isNonExploitable ? "Mesure non exploitable" : "Mesure à refaire"}</span>
            </span>
          ) : isBaselineBuilding ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-well text-text-secondary">
              <span className="flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className={`w-2 h-2 rounded-full ${(result.baselineStep ?? 2) >= 2 ? "bg-primary" : "bg-hairline"}`} />
                <span className={`w-2 h-2 rounded-full ${(result.baselineStep ?? 2) >= 3 ? "bg-primary" : "bg-hairline"}`} />
              </span>
              <span>Référence {result.baselineStep ?? 2}/{result.totalBaselineSteps ?? 3}</span>
            </span>
          ) : isUnusual ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-warning-tint text-warning-text">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Évolution inhabituelle</span>
            </span>
          ) : isToConfirm ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-well text-text-secondary">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>À confirmer à la prochaine séance</span>
            </span>
          ) : isNormal ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-normal-tint text-normal-text">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Mesure correcte</span>
            </span>
          ) : null}

          <span className="font-mono text-sm text-text-muted">
            {result.idPseudo}
          </span>

          {result.demo ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Mode démonstration
            </span>
          ) : null}
        </div>

        {/* Action pills */}
        <div className="flex items-center gap-3">
          {isRejected ? (
            <PillButton variant="primary" size="md" onClick={onRetry}>
              Recommencer la mesure
            </PillButton>
          ) : (
            <>
              <Link href={`/patients/${result.idPseudo}`}>
                <PillButton variant="secondary" size="md">
                  Voir le dossier
                </PillButton>
              </Link>
              {onNextPatient ? (
                <PillButton variant="primary" size="md" onClick={onNextPatient}>
                  Mesure suivante
                </PillButton>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isRejected ? (
        // State g: Rejected detail
        <div className="bg-well rounded-[20px] p-5 space-y-2">
          <p className="text-sm font-medium text-text-primary">
            Durée propre {formattedCleanDuration} s, minimum 12 s.{" "}
            <span className="text-critical-text font-semibold">
              Cause : {rejectionLabel(result.rejectionReason)}
            </span>
            .
          </p>
          <p className="text-xs text-text-secondary">
            {isNonExploitable
              ? `Tentative ${attempts} sur ${maxAttempts}. Nombre maximal de repositionnements atteint. Séance enregistrée comme non exploitable.`
              : `Tentative ${attempts} sur ${maxAttempts}. Repositionnez le capteur sans comprimer la FAV et recommencez.`}
          </p>
        </div>
      ) : isBaselineBuilding ? (
        // State f: Baseline building detail
        <div className="space-y-4">
          <div className="bg-well rounded-[20px] p-5 space-y-2">
            <p className="text-sm font-medium text-text-primary">
              Cette mesure construit la baseline du patient. Aucune comparaison avant 3 mesures valides.
            </p>
            <p className="text-xs text-text-secondary">
              Les caractéristiques actuelles sont enregistrées pour constituer la référence longitudinale propre à ce patient.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-well rounded-[20px] p-4 flex items-center justify-between">
              <span className="text-xs font-medium text-text-label">Énergie RMS mesurée</span>
              <span className="text-2xl font-medium text-text-primary font-tabular">
                {formattedRms} <span className="text-xs text-text-muted">g</span>
              </span>
            </div>
            <div className="bg-well rounded-[20px] p-4 flex items-center justify-between">
              <span className="text-xs font-medium text-text-label">Fréquence dominante</span>
              <span className="text-2xl font-medium text-text-primary font-tabular">
                {formattedFreq} <span className="text-xs text-text-muted">Hz</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        // States d & e: Normal or Unusual
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Metric 1: RMS */}
            <div className="bg-well rounded-[20px] p-4 flex flex-col justify-between">
              <span className="text-xs font-medium text-text-label">RMS</span>
              <div className="flex items-baseline gap-1 mt-2 font-tabular">
                <span className="text-3xl font-medium text-text-primary">{formattedRms}</span>
                <span className="text-xs text-text-muted">g</span>
              </div>
              {result.deltaRmsPct !== undefined ? (
                <span
                  className={`text-xs font-semibold mt-1 ${
                    isUnusual && result.deltaRmsPct < 0 ? "text-critical-text" : "text-text-secondary"
                  }`}
                >
                  {result.deltaRmsPct > 0 ? "+" : ""}
                  {result.deltaRmsPct.toFixed(0)} %
                </span>
              ) : null}
            </div>

            {/* Metric 2: Frequency */}
            <div className="bg-well rounded-[20px] p-4 flex flex-col justify-between">
              <span className="text-xs font-medium text-text-label">Fréquence dominante</span>
              <div className="flex items-baseline gap-1 mt-2 font-tabular">
                <span className="text-3xl font-medium text-text-primary">{formattedFreq}</span>
                <span className="text-xs text-text-muted">Hz</span>
              </div>
              <span className="text-xs text-text-secondary mt-1">Pic spectral</span>
            </div>

            {/* Metric 3: Deviation vs threshold */}
            <div className="bg-well rounded-[20px] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-label">Écart à la référence</span>
                {result.threshold ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-dark text-white font-mono">
                    Seuil {result.threshold.toFixed(1).replace(".", ",")}
                  </span>
                ) : null}
              </div>
              <div className="flex items-baseline gap-1 mt-2 font-tabular">
                <span
                  className={`text-3xl font-medium ${
                    isUnusual ? "text-warning-text" : "text-text-primary"
                  }`}
                >
                  {formattedDeviation ?? "0,0"}
                </span>
                <span className="text-xs text-text-muted">σ</span>
              </div>
              <span className="text-xs text-text-secondary mt-1">
                {isToConfirm
                  ? "À confirmer à la prochaine séance"
                  : isUnusual
                    ? "Au-dessus du seuil"
                    : "Dans la tolérance"}
              </span>
            </div>
          </div>

          {/* Explanation if unusual */}
          {isUnusual && result.explanation ? (
            <div className="bg-warning-tint/50 border border-warning-text/20 rounded-[20px] p-4 text-xs font-medium text-warning-text leading-relaxed">
              {result.explanation}
            </div>
          ) : null}

          {/* Baseline vs today comparison mini-bars (valeur / référence for RMS, fréquence, ratio) */}
          {(result.historyRmsBaseline !== undefined || result.baselinePeakFreqHz !== undefined) && !isToConfirm && (
            <div className="bg-well rounded-[20px] p-4 space-y-3">
              <span className="text-xs font-medium text-text-label">Comparaison valeur / référence (baseline)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {/* 1. RMS */}
                <ReferenceBarChart
                  label="RMS"
                  currentValue={result.rmsG}
                  baselineValue={result.historyRmsBaseline ?? 0.145}
                  unit="g"
                  maxValue={0.25}
                />

                {/* 2. Fréquence dominante */}
                <ReferenceBarChart
                  label="Fréquence"
                  currentValue={result.peakFreqHz}
                  baselineValue={result.baselinePeakFreqHz ?? 68}
                  unit="Hz"
                  maxValue={250}
                />

                {/* 3. Ratio */}
                <ReferenceBarChart
                  label="Rapport sténose"
                  currentValue={result.stenosisRatio ?? 0.32}
                  baselineValue={result.baselineStenosisRatio ?? 0.32}
                  maxValue={2.0}
                />
              </div>
            </div>
          )}

          {/* Compact spectrogram from stft_preview */}
          {result.stftPreview && result.stftPreview.length > 0 ? (
            <div className="bg-well rounded-[20px] p-4">
              <Spectrogram
                matrix={result.stftPreview}
                dominantFreqHz={result.peakFreqHz}
                height={140}
                compact
                title="Spectrogramme du signal propre (stft_preview)"
              />
            </div>
          ) : null}
        </div>
      )}

      <AiOpinionCard aiOpinion={result.aiOpinion} baselineBuilding={isBaselineBuilding} showDisclaimer={false} />

      {/* Quality footer line */}
      <div className="text-xs text-text-secondary pt-2 border-t border-hairline flex flex-wrap items-center justify-between gap-2">
        <span>
          Durée propre {formattedCleanDuration} s · artéfacts {formattedArtifactPct} % · appui moyen {formattedMeanPressure} kPa
        </span>
        <span className="text-text-muted">Critères de qualité appliqués</span>
      </div>

      {/* Mandatory clinical disclaimer */}
      <div className="pt-2">
        <Disclaimer />
      </div>
    </div>
  );
}
