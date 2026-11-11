import { armSideLabel, fistulaLabel } from "../model/format";
import type { ClinicalStatus } from "../model/types";
import { ReviewStatusPill } from "./review-status-pill";

export interface PatientHeaderStripProps {
  idPseudo: string;
  fistulaType: string;
  armSide: string;
  baselineLocked?: boolean;
  baselineStep?: number;
  sessionCount?: number;
  status?: ClinicalStatus | null;
  className?: string;
}

export function PatientHeaderStrip({
  idPseudo,
  fistulaType,
  armSide,
  baselineLocked = false,
  baselineStep = 0,
  sessionCount = 0,
  status = null,
  className = "",
}: PatientHeaderStripProps) {
  const baselineLabel = baselineLocked
    ? "Référence verrouillée"
    : `Référence en cours (${baselineStep}/3)`;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-surface p-4 border border-hairline shadow-xs ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-base font-semibold text-text-primary">
          {idPseudo}
        </span>
        <span className="text-text-muted">·</span>
        <span className="text-sm text-text-secondary">
          {fistulaLabel(fistulaType)} ({armSideLabel(armSide)})
        </span>
        <span className="text-text-muted">·</span>
        <span className="rounded-full bg-well px-2.5 py-0.5 text-xs font-medium text-text-secondary">
          {baselineLabel}
        </span>
        <span className="text-text-muted">·</span>
        <span className="text-xs text-text-muted">
          {sessionCount} séance{sessionCount > 1 ? "s" : ""}
        </span>
      </div>

      {status ? (
        <div className="shrink-0">
          <ReviewStatusPill status={status} />
        </div>
      ) : null}
    </div>
  );
}
