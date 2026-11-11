"use client";

export interface ReferenceBarChartProps {
  label: string;
  currentValue: number;
  baselineValue: number;
  unit?: string;
  maxValue?: number;
  className?: string;
}

export function ReferenceBarChart({
  label,
  currentValue,
  baselineValue,
  unit = "",
  maxValue,
  className = "",
}: ReferenceBarChartProps) {
  const max = maxValue ?? Math.max(currentValue, baselineValue, 0.001) * 1.35;
  const currentPct = Math.min(100, Math.max(0, (currentValue / max) * 100));
  const baselinePct = Math.min(100, Math.max(0, (baselineValue / max) * 100));

  const formatVal = (v: number) => {
    const precision = unit === "g" ? 3 : unit === "Hz" ? 0 : 2;
    return `${v.toFixed(precision).replace(".", ",")}${unit ? ` ${unit}` : ""}`;
  };

  const deltaPct =
    baselineValue > 0
      ? ((currentValue - baselineValue) / baselineValue) * 100
      : 0;
  const isElevated = Math.abs(deltaPct) > 30;

  return (
    <div
      role="img"
      aria-label={`${label} : valeur ${formatVal(currentValue)}, référence ${formatVal(baselineValue)}`}
      className={`space-y-1.5 rounded-[14px] bg-surface p-2.5 border border-hairline/60 ${className}`}
    >
      <div className="flex items-center justify-between text-[11px] text-text-secondary">
        <span className="font-medium text-text-label">{label}</span>
        <span className="font-tabular font-medium text-text-primary">
          {formatVal(currentValue)} / {formatVal(baselineValue)}
        </span>
      </div>

      <div className="relative h-2 w-full bg-hairline rounded-full overflow-hidden">
        <div
          style={{ width: `${currentPct}%` }}
          className={`h-full rounded-full transition-all duration-200 ${
            isElevated ? "bg-warning-text" : "bg-primary"
          }`}
        />
        {/* Baseline marker line */}
        <div
          title={`Référence : ${formatVal(baselineValue)}`}
          style={{ left: `${baselinePct}%` }}
          className="absolute top-0 bottom-0 w-1 bg-text-primary/70 -translate-x-1/2"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-text-muted">
        <span>Valeur actuelle</span>
        <span>Réf.</span>
      </div>
    </div>
  );
}
