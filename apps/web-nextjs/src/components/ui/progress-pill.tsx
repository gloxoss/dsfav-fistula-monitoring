import type { ReactNode } from "react";

export interface ProgressPillProps {
  value: number; // 0 to max
  max?: number;
  label?: string;
  displayValue?: string;
  colorClass?: string;
  icon?: ReactNode;
  className?: string;
}

export function ProgressPill({
  value,
  max = 100,
  label,
  displayValue,
  colorClass = "bg-primary",
  icon,
  className = "",
}: ProgressPillProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`space-y-2 ${className}`}>
      {label || displayValue ? (
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-1.5 text-text-label">
            {icon}
            {label}
          </span>
          <span className="text-text-primary font-semibold font-tabular">
            {displayValue ?? `${Math.round(percentage)} %`}
          </span>
        </div>
      ) : null}

      {/* 14px progress pill bar with hatched remainder */}
      <div className="relative h-3.5 w-full rounded-full overflow-hidden bg-hairline">
        {/* Hatched pattern background for remainder */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #94A3B8 0, #94A3B8 2px, transparent 0, transparent 6px)",
          }}
        />

        {/* Filled active portion */}
        <div
          style={{ width: `${percentage}%` }}
          className={`relative h-full rounded-full transition-all duration-300 ${colorClass}`}
        />
      </div>
    </div>
  );
}
