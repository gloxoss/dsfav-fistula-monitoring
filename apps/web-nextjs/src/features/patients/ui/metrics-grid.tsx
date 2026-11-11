import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";
import { formatDecimal, formatSignedPercent } from "../model/format";
import type { BaselineFeatures, SessionView } from "../model/types";

export interface MetricsGridProps {
  session: SessionView | null;
  sessions?: SessionView[];
  baseline: BaselineFeatures | null;
  className?: string;
}

const DELTA_STYLES: Record<string, string> = {
  positive: "text-normal-text bg-normal-tint",
  negative: "text-critical-text bg-critical-tint",
  neutral: "text-text-secondary bg-well",
  warning: "text-warning-text bg-warning-tint",
};

interface MetricTileProps {
  label: string;
  value: string;
  unit?: string;
  delta?: {
    text: string;
    type?: "positive" | "negative" | "neutral" | "warning";
  };
  sparklineValues?: number[];
  sparklineColor: string;
  sparklineLabel: string;
  sparklineUnit: string;
  baseline?: number;
  startAtZero?: boolean;
}

function MetricTile({
  label,
  value,
  unit,
  delta,
  sparklineValues,
  sparklineColor,
  sparklineLabel,
  sparklineUnit,
  baseline,
  startAtZero,
}: MetricTileProps) {
  return (
    <Card className="rounded-[28px] bg-surface p-4 shadow-[var(--shadow-card)] min-h-[170px] flex flex-col justify-between">
      <div>
        <p className="text-[13px] font-medium text-text-label tracking-wide">{label}</p>
        {delta ? (
          <div className="mt-1">
            <span
              className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                DELTA_STYLES[delta.type ?? "neutral"]
              }`}
            >
              {delta.text}
            </span>
          </div>
        ) : null}
        <div className="flex items-baseline gap-1.5 mt-1.5">
          <span className="text-3xl font-medium tracking-tight text-text-primary font-tabular">
            {value}
          </span>
          {unit ? <span className="text-sm font-normal text-text-muted">{unit}</span> : null}
        </div>
      </div>

      {sparklineValues && sparklineValues.length > 1 ? (
        <div className="mt-2">
          <Sparkline
            values={sparklineValues}
            baseline={baseline}
            startAtZero={startAtZero}
            colorVar={sparklineColor}
            label={sparklineLabel}
            unit={sparklineUnit}
            height={56}
          />
        </div>
      ) : (
        <div className="h-[56px]" />
      )}
    </Card>
  );
}

export function MetricsGrid({
  session,
  sessions = [],
  baseline,
  className = "",
}: MetricsGridProps) {
  // Extract historical values for sparklines
  const rmsValues = sessions
    .map((s) => s.rmsG)
    .filter((v): v is number => typeof v === "number");
  const freqValues = sessions
    .map((s) => s.peakFreqHz)
    .filter((v): v is number => typeof v === "number");
  const pressureValues = sessions
    .map((s) => s.avgPressureKpa)
    .filter((v): v is number => typeof v === "number");
  const artifactValues = sessions
    .map((s) => s.artifactPct)
    .filter((v): v is number => typeof v === "number");

  // 1. RMS Delta vs baseline
  const rmsDelta =
    session?.rmsG !== null && session?.rmsG !== undefined && baseline !== null && baseline.rmsG > 0
      ? ((session.rmsG - baseline.rmsG) / baseline.rmsG) * 100
      : null;

  const rmsDeltaProps =
    rmsDelta === null
      ? undefined
      : {
          text: `${rmsDelta >= 0 ? "↑" : "↓"} ${formatSignedPercent(rmsDelta)} vs réf.`,
          type: (rmsDelta < -30 ? "negative" : rmsDelta > 30 ? "warning" : "neutral") as
            | "negative"
            | "warning"
            | "neutral",
        };

  // 2. Pic spectral Delta vs baseline
  const freqDelta =
    session?.peakFreqHz !== null && session?.peakFreqHz !== undefined && baseline?.peakFreqHz
      ? session.peakFreqHz - baseline.peakFreqHz
      : null;

  const freqDeltaProps =
    freqDelta === null
      ? undefined
      : {
          text: `${freqDelta >= 0 ? "↑" : "↓"} ${freqDelta > 0 ? "+" : ""}${Math.round(freqDelta)} Hz vs réf.`,
          type: (Math.abs(freqDelta) > 40 ? "warning" : "neutral") as "warning" | "neutral",
        };

  // 3. Appui moyen indicator
  const pressureDeltaProps =
    session?.avgPressureKpa !== null && session?.avgPressureKpa !== undefined
      ? {
          text:
            session.avgPressureKpa >= 3.0 && session.avgPressureKpa <= 8.5
              ? "✓ Cible 3,0-8,5 kPa"
              : session.avgPressureKpa < 2.5
                ? "↓ Insuffisant (< 2,5)"
                : "↑ Élevé (> 8,5)",
          type: (session.avgPressureKpa >= 3.0 && session.avgPressureKpa <= 8.5
            ? "positive"
            : session.avgPressureKpa < 2.5
              ? "negative"
              : "warning") as "positive" | "negative" | "warning",
        }
      : undefined;

  // 4. Artéfacts indicator
  const artifactDeltaProps =
    session?.artifactPct !== null && session?.artifactPct !== undefined
      ? {
          text:
            session.artifactPct <= 10.0
              ? "✓ Conforme (≤ 10 %)"
              : "↑ Artéfacts élevés",
          type: (session.artifactPct <= 10.0 ? "positive" : "warning") as "positive" | "warning",
        }
      : undefined;

  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 items-start ${className}`}>
      <MetricTile
        label="Énergie RMS"
        value={session?.rmsG !== null && session?.rmsG !== undefined ? formatDecimal(session.rmsG, 3) : "—"}
        unit={session?.rmsG !== null && session?.rmsG !== undefined ? "g" : undefined}
        delta={rmsDeltaProps}
        sparklineValues={rmsValues}
        sparklineColor="var(--primary)"
        sparklineLabel="Évolution RMS"
        sparklineUnit="g"
        baseline={baseline?.rmsG}
        startAtZero
      />
      <MetricTile
        label="Pic spectral"
        value={
          session?.peakFreqHz !== null && session?.peakFreqHz !== undefined
            ? formatDecimal(session.peakFreqHz, 0)
            : "—"
        }
        unit={session?.peakFreqHz !== null && session?.peakFreqHz !== undefined ? "Hz" : undefined}
        delta={freqDeltaProps}
        sparklineValues={freqValues}
        sparklineColor="var(--accent)"
        sparklineLabel="Évolution pic spectral"
        sparklineUnit="Hz"
        baseline={baseline?.peakFreqHz}
      />
      <MetricTile
        label="Appui moyen"
        value={
          session?.avgPressureKpa !== null && session?.avgPressureKpa !== undefined
            ? formatDecimal(session.avgPressureKpa, 1)
            : "—"
        }
        unit={session?.avgPressureKpa !== null && session?.avgPressureKpa !== undefined ? "kPa" : undefined}
        delta={pressureDeltaProps}
        sparklineValues={pressureValues}
        sparklineColor="var(--normal)"
        sparklineLabel="Évolution appui moyen"
        sparklineUnit="kPa"
        startAtZero
      />
      <MetricTile
        label="Artéfacts"
        value={
          session?.artifactPct !== null && session?.artifactPct !== undefined
            ? formatDecimal(session.artifactPct, 1)
            : "—"
        }
        unit={session?.artifactPct !== null && session?.artifactPct !== undefined ? "%" : undefined}
        delta={artifactDeltaProps}
        sparklineValues={artifactValues}
        sparklineColor="var(--artifact)"
        sparklineLabel="Évolution artéfacts"
        sparklineUnit="%"
        startAtZero
      />
    </div>
  );
}
