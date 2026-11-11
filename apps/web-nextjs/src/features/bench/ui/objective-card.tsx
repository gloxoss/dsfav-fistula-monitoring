import { Card } from "@/components/ui/card";
import { PillButton } from "@/components/ui/pill-button";
import { LockKeyhole } from "lucide-react";
import {
  BENCH_BLIND_MESSAGE,
  BENCH_CAPTURE_REJECTED_FALLBACK,
  BENCH_EXPECTED_PROFILE_CALIBRATING,
  BENCH_NO_DATA,
  BENCH_SIMULATION_LINE,
  BENCH_TEACHING_SENTENCE,
  PERCEIVED_THRILL_LABELS,
} from "../model/constants";
import type {
  BenchObjectiveData,
  BenchSessionResult,
  BenchStep,
  PerceivedThrill,
} from "../model/types";

export interface ObjectiveCardProps {
  step: BenchStep;
  revealed: boolean;
  objective: BenchObjectiveData | null;
  result: BenchSessionResult | null;
  rejectionMessage: string | null;
  onRestartCapture: () => void;
}

function formatFr(value: number, digits: number): string {
  return value.toFixed(digits).replace(".", ",");
}

function expectedProfileText(expectedProfile: string | null | undefined): string {
  const trimmed = expectedProfile?.trim() ?? "";
  if (trimmed.length === 0 || /^(?:à|a)\s+calibrer$/i.test(trimmed)) {
    return BENCH_EXPECTED_PROFILE_CALIBRATING;
  }
  return PERCEIVED_THRILL_LABELS[trimmed as PerceivedThrill] ?? trimmed;
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-well p-4">
      <p className="text-[13px] font-medium text-text-label">{label}</p>
      <p className="mt-1 text-xl font-medium text-text-primary tabular-nums">{value}</p>
    </div>
  );
}

export function ObjectiveCard({
  step,
  revealed,
  objective,
  result,
  rejectionMessage,
  onRestartCapture,
}: ObjectiveCardProps) {
  if (rejectionMessage) {
    return (
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Mesure objective</h2>
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-[20px] bg-critical-tint p-4 text-sm font-medium text-critical-text"
        >
          <p>{rejectionMessage || BENCH_CAPTURE_REJECTED_FALLBACK}</p>
          <PillButton type="button" variant="secondary" size="sm" onClick={onRestartCapture}>
            Recommencer la capture
          </PillButton>
        </div>
      </Card>
    );
  }

  if (!revealed) {
    return (
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Mesure objective</h2>
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-well px-6 py-10 text-center">
          <LockKeyhole className="h-8 w-8 text-text-muted" aria-hidden="true" />
          <p
            data-testid="bench-reveal-hidden-notice"
            className="max-w-md text-sm font-medium text-text-secondary"
          >
            {step === 2
              ? BENCH_BLIND_MESSAGE
              : "Lancez la révélation pour comparer la mesure à votre palpation."}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-text-primary">Mesure objective</h2>
        <span className="rounded-full bg-primary-tint px-3 py-1 text-xs font-medium text-primary">
          {BENCH_SIMULATION_LINE}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricTile
          label="RMS"
          value={typeof objective?.rmsG === "number" ? `${formatFr(objective.rmsG, 3)} g` : BENCH_NO_DATA}
        />
        <MetricTile
          label="Pic spectral"
          value={
            typeof objective?.peakFreqHz === "number"
              ? `${Math.round(objective.peakFreqHz)} Hz`
              : BENCH_NO_DATA
          }
        />
        <MetricTile
          label="Rapport HF/BF"
          value={
            typeof objective?.ratioHighLow === "number"
              ? formatFr(objective.ratioHighLow, 2)
              : BENCH_NO_DATA
          }
        />
      </div>

      {typeof objective?.rmsG === "number" || typeof objective?.peakFreqHz === "number" ? (
        <div className="space-y-3 rounded-[20px] bg-well p-4">
          <p className="text-[13px] font-medium text-text-label">Profil vibratoire mesuré</p>
          <div className="space-y-2">
            {typeof objective?.rmsG === "number" ? (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Énergie RMS</span>
                  <span className="font-tabular font-medium text-text-primary">{formatFr(objective.rmsG, 3)} g</span>
                </div>
                <div className="h-2 w-full rounded-full bg-hairline overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(100, (objective.rmsG / 0.3) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}

            {typeof objective?.peakFreqHz === "number" ? (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Spectre fréquentiel (0 à 400 Hz)</span>
                  <span className="font-tabular font-medium text-text-primary">Pic à {Math.round(objective.peakFreqHz)} Hz</span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-hairline overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${Math.min(100, (objective.peakFreqHz / 400) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-[20px] bg-accent-tint p-4 text-sm text-text-secondary">
        <p className="font-medium text-text-primary">
          {`Profil attendu : ${expectedProfileText(result?.expectedProfile)}`}
        </p>
        <p className="mt-2">{BENCH_TEACHING_SENTENCE}</p>
      </div>
    </Card>
  );
}
