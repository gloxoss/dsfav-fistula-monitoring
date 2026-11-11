"use client";

import type { QualityMetrics } from "../model/types";

export interface QualityCardProps {
  metrics: QualityMetrics;
  className?: string;
}

export function QualityCard({ metrics, className = "" }: QualityCardProps) {
  const minCleanDuration = 12.0; // Canonical quality gate threshold
  const targetDuration = metrics.targetDurationSec || 25.0;

  // Percentage for the 12s minimum marker on the progress pill bar
  const minMarkerPct = (minCleanDuration / targetDuration) * 100;
  const currentCleanPct = Math.min(100, Math.max(0, (metrics.cleanDurationSec / targetDuration) * 100));

  const formattedCleanDuration = metrics.cleanDurationSec.toFixed(1).replace(".", ",");
  const formattedRms = metrics.rmsG === null ? "—" : metrics.rmsG.toFixed(3).replace(".", ",");
  const formattedFreq = metrics.peakFreqHz === null ? "—" : Math.round(metrics.peakFreqHz).toString();
  const formattedArtifactPct = metrics.artifactPct.toFixed(1).replace(".", ",");

  return (
    <div
      className={`bg-surface text-text-primary rounded-[28px] p-6 flex flex-col justify-between shadow-[var(--shadow-card)] space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">Qualité en cours</h3>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-artifact-tint text-artifact-text">
          Artéfacts {formattedArtifactPct} %
        </span>
      </div>

      <div className="space-y-3">
        {/* Metric tile 1: Durée propre */}
        <div className="bg-well rounded-[20px] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-label">Durée propre</span>
            <div className="flex items-baseline gap-1 font-tabular">
              <span className="text-2xl font-medium text-text-primary">{formattedCleanDuration}</span>
              <span className="text-xs text-text-muted">/ {targetDuration.toFixed(1).replace(".", ",")} s</span>
            </div>
          </div>

          {/* Pill bar with 12s minimum mark */}
          <div className="relative pt-1">
            <div className="h-3 w-full bg-hairline rounded-full overflow-hidden">
              <div
                style={{ width: `${currentCleanPct}%` }}
                className={`h-full rounded-full transition-all duration-200 ${
                  metrics.cleanDurationSec >= minCleanDuration ? "bg-primary" : "bg-warning-text"
                }`}
              />
            </div>
            {/* 12s threshold mark */}
            <div
              style={{ left: `${minMarkerPct}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-text-primary/40 -translate-x-1/2"
              title="Seuil minimal de 12 s"
            />
          </div>
          <div className="flex justify-between text-[11px] text-text-muted">
            <span>0 s</span>
            <span className="font-medium text-text-secondary">Min. 12 s</span>
            <span>{targetDuration.toFixed(0)} s</span>
          </div>
        </div>

        {/* Metric tile 2: RMS */}
        <div className="bg-well rounded-[20px] p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-text-label">Énergie RMS</span>
            <p className="text-xs text-text-muted">Bande 15–450 Hz</p>
          </div>
          <div className="flex items-baseline gap-1 font-tabular">
            <span className="text-2xl font-medium text-text-primary">{formattedRms}</span>
            <span className="text-xs text-text-muted">g</span>
          </div>
        </div>

        {/* Metric tile 3: Peak frequency */}
        <div className="bg-well rounded-[20px] p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-text-label">Fréquence dominante</span>
            <p className="text-xs text-text-muted">Pic spectral (Welch)</p>
          </div>
          <div className="flex items-baseline gap-1 font-tabular">
            <span className="text-2xl font-medium text-text-primary">{formattedFreq}</span>
            <span className="text-xs text-text-muted">Hz</span>
          </div>
        </div>
      </div>
    </div>
  );
}
