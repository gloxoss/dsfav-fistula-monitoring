"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ClinicalStatus } from "@/components/ui/status-pill";

const emptySubscribe = () => () => {};

export interface SessionTrendChartProps {
  sessions: Array<{
    measurementId: string;
    recordedAt: string | null;
    rmsG: number | null;
    status: ClinicalStatus;
  }>;
  baseline?: {
    rmsG: number;
    peakFreqHz?: number | null;
    stenosisRatio?: number | null;
  } | null;
  thresholdRms?: number | null;
  className?: string;
  height?: number;
}

const STATUS_LABELS: Record<ClinicalStatus, string> = {
  NORMAL: "Mesure stable",
  TO_CONFIRM: "À confirmer",
  UNUSUAL_EVOLUTION: "Évolution inhabituelle",
  REJECTED_QUALITY: "Qualité rejetée",
  BASELINE_BUILDING: "Construction référence",
};

function getSessionDay(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "—";
  }
}

function getSessionTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "";
  }
}

function formatDecimal(val: number, precision = 3): string {
  return val.toFixed(precision).replace(".", ",");
}

export function SessionTrendChart({
  sessions,
  baseline = null,
  thresholdRms = null,
  className = "",
  height = 260,
}: SessionTrendChartProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const validSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.rmsG !== null && typeof s.rmsG === "number")
        .slice(-14),
    [sessions],
  );

  const chartData = useMemo(() => {
    // Count occurrences of each day in validSessions
    const dayCounts = new Map<string, number>();
    for (const s of validSessions) {
      const day = getSessionDay(s.recordedAt);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }

    return validSessions.map((s, idx) => {
      const day = getSessionDay(s.recordedAt);
      const time = getSessionTime(s.recordedAt);
      const isMulti = (dayCounts.get(day) ?? 0) > 1;
      // Show time when same day, or single label per day
      const dateLabel = isMulti && time ? `${day} ${time}` : day;

      return {
        id: s.measurementId,
        index: idx + 1,
        date: dateLabel,
        rawDay: day,
        rms: s.rmsG as number,
        status: s.status,
        statusLabel: STATUS_LABELS[s.status] ?? s.status,
      };
    });
  }, [validSessions]);

  if (chartData.length === 0) {
    return (
      <div className={`rounded-[20px] bg-well p-4 text-center text-sm text-text-secondary ${className}`}>
        Aucune mesure d’énergie RMS disponible pour ce patient.
      </div>
    );
  }

  const allValues = chartData.map((d) => d.rms);
  if (baseline) allValues.push(baseline.rmsG);
  if (thresholdRms) allValues.push(thresholdRms);
  const maxVal = Math.max(...allValues, 0.2);
  const yDomainMax = +(Math.ceil(maxVal * 20) / 20).toFixed(2);
  const xInterval = chartData.length > 6 ? Math.ceil(chartData.length / 6) : 0;

  return (
    <div className={`space-y-3 min-w-0 w-full ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-medium tracking-wide text-text-label">RMS par séance</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          {baseline ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-text-muted" />
              Baseline {formatDecimal(baseline.rmsG, 3)} g
            </span>
          ) : null}
          {thresholdRms ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dotted border-warning" />
              Seuil d&apos;alerte
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-normal" />
            Stable
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-warning" />
            Évolution
          </span>
        </div>
      </div>

      <div
        className="w-full min-w-0 h-[280px] rounded-[20px] bg-well p-3 relative"
        role="img"
        aria-label="Graphique d'évolution de l'énergie RMS par séance"
      >
        <div className="sr-only">
          {chartData.map((d) => (
            <span key={`pt-${d.id}`} data-testid="rms-chart-point" data-rms={d.rms} data-status={d.status}>
              {d.date} : {d.rms} g
            </span>
          ))}
        </div>
        {mounted ? (
          <ResponsiveContainer width="100%" height={height} minWidth={240}>
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, bottom: 25, left: 35 }}
            >
              <XAxis
                dataKey="date"
                interval={xInterval}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                label={{ value: "Date", position: "insideBottomRight", offset: -5, fill: "var(--text-muted)", fontSize: 12 }}
              />
              <YAxis
                domain={[0, yDomainMax]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                tickFormatter={(v) => `${Number(v).toString().replace(".", ",")} g`}
                label={{ value: "Énergie (g)", angle: -90, position: "insideLeft", offset: 10, fill: "var(--text-muted)", fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0]?.payload;
                  if (!data) return null;
                  return (
                    <div className="rounded-xl bg-dark text-white px-3 py-2 text-xs shadow-md space-y-1">
                      <p className="font-semibold">{data.date}</p>
                      <p className="font-tabular">
                        RMS : <span className="font-bold">{formatDecimal(data.rms, 3)} g</span>
                      </p>
                      <p className="text-text-muted">{data.statusLabel}</p>
                    </div>
                  );
                }}
              />

              {baseline ? (
                <ReferenceLine
                  y={baseline.rmsG}
                  stroke="var(--text-muted)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Baseline : ${formatDecimal(baseline.rmsG, 3)} g`,
                    fill: "var(--text-label)",
                    fontSize: 12,
                    position: "insideTopRight",
                    fontWeight: 600,
                  }}
                />
              ) : null}

              {baseline ? (
                <ReferenceArea
                  y1={baseline.rmsG * 0.95}
                  y2={baseline.rmsG * 1.05}
                  fill="var(--text-muted)"
                  fillOpacity={0.08}
                />
              ) : null}

              {thresholdRms ? (
                <ReferenceLine
                  y={thresholdRms}
                  stroke="var(--warning)"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Seuil : ${formatDecimal(thresholdRms, 3)} g`,
                    fill: "var(--warning-text)",
                    fontSize: 12,
                    position: "insideTopLeft",
                    fontWeight: 600,
                  }}
                />
              ) : null}

              <Line
                type="monotone"
                dataKey="rms"
                stroke="var(--primary)"
                strokeWidth={2}
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; payload?: { status?: string } }) => {
                  const { cx, cy, payload } = props;
                  if (!payload || cx == null || cy == null) return null;
                  const status = payload.status;
                  const dotColor =
                    status === "NORMAL"
                      ? "var(--normal)"
                      : status === "UNUSUAL_EVOLUTION" || status === "TO_CONFIRM"
                      ? "var(--warning)"
                      : status === "REJECTED_QUALITY"
                      ? "var(--artifact)"
                      : "var(--primary)";
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={dotColor}
                      stroke="var(--bg-surface)"
                      strokeWidth={2}
                    />
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-text-muted text-xs">
            Chargement du graphique...
          </div>
        )}
      </div>

      {/* Accessible data table behind disclosure */}
      <details className="mt-2 text-xs text-text-secondary">
        <summary className="cursor-pointer py-1.5 text-xs text-text-label underline underline-offset-2 hover:text-text-primary">
          Afficher les données (tableau accessible)
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left" aria-label="Valeurs RMS par séance">
            <caption className="sr-only">Valeurs représentées dans le graphique RMS</caption>
            <thead>
              <tr className="border-b border-hairline text-text-label text-[11px]">
                <th scope="col" className="py-1.5 pr-3 font-medium">Séance</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Date</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Valeur RMS</th>
                <th scope="col" className="py-1.5 font-medium">Statut clinique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {chartData.map((d) => (
                <tr key={d.id}>
                  <td className="py-1.5 pr-3 font-medium">#{d.index}</td>
                  <td className="py-1.5 pr-3 font-tabular">{d.date}</td>
                  <td className="py-1.5 pr-3 font-tabular font-medium">
                    {formatDecimal(d.rms, 3)} g
                  </td>
                  <td className="py-1.5">
                    {d.status === "TO_CONFIRM" ? (
                      <span
                        role="status"
                        className="inline-flex items-center gap-1 rounded-full bg-well px-2 py-0.5 text-xs text-text-secondary"
                      >
                        {d.statusLabel}
                      </span>
                    ) : (
                      <span>{d.statusLabel}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {baseline ? (
              <tfoot>
                <tr className="border-t-2 border-hairline font-medium text-text-primary">
                  <th scope="row" className="py-1.5 pr-3">Baseline</th>
                  <td className="py-1.5 pr-3" colSpan={2}>Valeur de référence</td>
                  <td className="py-1.5 text-right font-tabular">{formatDecimal(baseline.rmsG, 3)} g</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </details>
    </div>
  );
}
