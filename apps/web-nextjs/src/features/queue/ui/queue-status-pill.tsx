import type { ReactNode } from "react";
import { CircleDashed, Clock3 } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { ClinicalStatus } from "../model/types";

export interface QueueStatusPillProps {
  status: ClinicalStatus;
  className?: string;
}

function NeutralPill({ label, icon, className = "" }: { label: string; icon: ReactNode; className?: string }) {
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full bg-well px-3.5 py-1.5 text-sm font-medium text-text-secondary ${className}`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

export function QueueStatusPill({ status, className }: QueueStatusPillProps) {
  if (status === "TO_CONFIRM") {
    return (
      <NeutralPill
        className={className}
        label="À confirmer"
        icon={<Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />}
      />
    );
  }

  if (status === "BASELINE_BUILDING") {
    return (
      <NeutralPill
        className={className}
        label="Référence en cours"
        icon={<CircleDashed className="h-4 w-4 shrink-0" aria-hidden="true" />}
      />
    );
  }

  const label =
    status === "NORMAL" ? "Mesure correcte" : status === "REJECTED_QUALITY" ? "Mesure à refaire" : undefined;

  return <StatusPill status={status} label={label} className={className} />;
}
