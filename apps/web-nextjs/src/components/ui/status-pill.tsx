import type { ReactNode } from "react";

export type ClinicalStatus =
  | "NORMAL"
  | "TO_CONFIRM"
  | "UNUSUAL_EVOLUTION"
  | "REJECTED_QUALITY"
  | "BASELINE_BUILDING";

export interface StatusPillProps {
  status: ClinicalStatus;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

interface StatusStyleConfig {
  defaultLabel: string;
  bgClass: string;
  textClass: string;
  icon: ReactNode;
}

const STATUS_CONFIGS: Record<ClinicalStatus, StatusStyleConfig> = {
  NORMAL: {
    defaultLabel: "Normal",
    bgClass: "bg-normal-tint",
    textClass: "text-normal-text",
    icon: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
  },
  TO_CONFIRM: {
    defaultLabel: "À confirmer",
    bgClass: "bg-warning-tint",
    textClass: "text-warning-text",
    icon: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  UNUSUAL_EVOLUTION: {
    defaultLabel: "Évolution inhabituelle",
    bgClass: "bg-warning-tint",
    textClass: "text-warning-text",
    icon: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  REJECTED_QUALITY: {
    defaultLabel: "Qualité rejetée",
    bgClass: "bg-critical-tint",
    textClass: "text-critical-text",
    icon: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 21h5v-5" />
      </svg>
    ),
  },
  BASELINE_BUILDING: {
    defaultLabel: "Baseline en cours",
    bgClass: "bg-well",
    textClass: "text-text-secondary",
    icon: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
      </svg>
    ),
  },
};

export function StatusPill({ status, label, size = "md", className = "" }: StatusPillProps) {
  const config = STATUS_CONFIGS[status] ?? STATUS_CONFIGS.NORMAL;
  const displayText = label ?? config.defaultLabel;

  const sizeClasses = size === "sm" ? "px-2.5 py-0.5 text-xs gap-1.5" : "px-3.5 py-1.5 text-sm gap-2";

  return (
    <span
      role="status"
      className={`inline-flex items-center font-medium rounded-full whitespace-nowrap ${config.bgClass} ${config.textClass} ${sizeClasses} ${className}`}
    >
      {config.icon}
      <span className="whitespace-nowrap">{displayText}</span>
    </span>
  );
}
