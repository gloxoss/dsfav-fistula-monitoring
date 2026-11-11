import type { ReactNode } from "react";
import { CircleDashed, Clock3 } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { ClinicalStatus } from "../model/types";

export interface ReviewStatusPillProps {
  status: ClinicalStatus;
  baselineStep?: number;
  size?: "sm" | "md";
  className?: string;
}

function NeutralPill({
  label,
  icon,
  size = "md",
  className = "",
}: {
  label: string;
  icon: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizeClasses =
    size === "sm" ? "px-2.5 py-0.5 text-xs gap-1.5" : "px-3.5 py-1.5 text-sm gap-2";

  return (
    <span
      role="status"
      className={`inline-flex items-center rounded-full bg-well font-medium text-text-secondary whitespace-nowrap ${sizeClasses} ${className}`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

export function ReviewStatusPill({ status, baselineStep, size = "md", className }: ReviewStatusPillProps) {
  if (status === "TO_CONFIRM") {
    return (
      <NeutralPill
        className={className}
        size={size}
        label="À confirmer"
        icon={<Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      />
    );
  }

  if (status === "BASELINE_BUILDING") {
    return (
      <NeutralPill
        className={className}
        size={size}
        label={baselineStep === undefined ? "Référence en cours" : `Référence ${baselineStep}/3`}
        icon={<CircleDashed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      />
    );
  }

  const label =
    status === "NORMAL" ? "Mesure stable" : status === "REJECTED_QUALITY" ? "Mesure à refaire" : undefined;

  return <StatusPill status={status} label={label} size={size} className={className} />;
}
