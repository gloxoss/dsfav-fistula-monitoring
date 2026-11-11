import type { ReactNode } from "react";
import { Card } from "./card";

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  iconBgClass?: string;
  delta?: {
    text: string;
    type?: "positive" | "negative" | "neutral" | "warning";
  };
  caption?: string;
  className?: string;
  sparkline?: ReactNode;
}

export function MetricCard({
  label,
  value,
  unit,
  icon,
  iconBgClass = "bg-primary-tint text-primary",
  delta,
  caption,
  className = "",
  sparkline,
}: MetricCardProps) {
  const deltaColors = {
    positive: "text-normal-text bg-normal-tint",
    negative: "text-critical-text bg-critical-tint",
    neutral: "text-text-secondary bg-well",
    warning: "text-warning-text bg-warning-tint",
  };

  return (
    <Card className={`flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex items-center justify-between mb-4">
          {icon ? (
            <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${iconBgClass}`}>
              {icon}
            </div>
          ) : null}
          {delta ? (
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                deltaColors[delta.type ?? "neutral"]
              }`}
            >
              {delta.text}
            </span>
          ) : null}
        </div>

        <p className="text-[13px] font-medium text-text-label tracking-wide">{label}</p>

        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-3xl lg:text-4xl font-medium tracking-tight text-text-primary font-tabular">
            {typeof value === "number" ? value.toString().replace(".", ",") : value}
          </span>
          {unit ? <span className="text-base font-normal text-text-muted">{unit}</span> : null}
        </div>
      </div>

      {sparkline ? <div className="mt-4 pt-3 border-t border-hairline">{sparkline}</div> : null}

      {caption ? (
        <p className="text-xs text-text-secondary mt-3 pt-2 border-t border-hairline">{caption}</p>
      ) : null}
    </Card>
  );
}
