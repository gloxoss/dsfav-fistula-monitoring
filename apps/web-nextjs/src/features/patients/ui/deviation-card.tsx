import { Card } from "@/components/ui/card";
import { formatDecimal } from "../model/format";
import type { ClinicalStatus } from "../model/types";
import { ReviewStatusPill } from "./review-status-pill";

export interface DeviationCardProps {
  status: ClinicalStatus | null;
  deviationScore: number | null;
  thresholdSigma?: number;
  consecutiveAbove: number;
  baselineLocked: boolean;
  baselineStep: number;
  className?: string;
}

function comparisonCaption(
  status: ClinicalStatus,
  consecutiveAbove: number,
  hasScore: boolean,
): string {
  if (status === "UNUSUAL_EVOLUTION") {
    return consecutiveAbove > 1 ? `${consecutiveAbove} séances de suite au-dessus` : "Au-dessus du seuil";
  }
  if (status === "TO_CONFIRM") return "À confirmer à la prochaine séance";
  if (status === "NORMAL") return hasScore ? "Dans la tolérance" : "Pas de comparaison disponible";
  return "Pas de comparaison disponible";
}

function formatDeviationScore(score: number): string {
  const hasTwoDecimals = Math.round(score * 100) % 10 !== 0;
  return formatDecimal(score, hasTwoDecimals ? 2 : 1);
}

export function DeviationCard({
  status,
  deviationScore,
  thresholdSigma,
  consecutiveAbove,
  baselineLocked,
  baselineStep,
  className = "",
}: DeviationCardProps) {
  return (
    <Card className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-medium tracking-wide text-text-label">Écart à la baseline</h2>
        {status ? <ReviewStatusPill status={status} baselineStep={baselineStep} /> : null}
      </div>

      {!baselineLocked ? (
        <div className="space-y-2">
          <p className="text-3xl font-medium text-text-primary">Comparaison après 3 mesures valides</p>
          <p className="text-sm text-text-secondary">
            Aucune alerte pendant la construction de la référence.
          </p>
        </div>
      ) : status === "REJECTED_QUALITY" ? (
        <p className="text-sm text-text-secondary">
          Mesure rejetée : aucune comparaison avec la baseline.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-6xl font-medium tracking-tight text-text-primary font-tabular">
              {deviationScore === null ? "—" : formatDeviationScore(deviationScore)}
            </span>
            <span className="text-base text-text-muted">σ</span>
            {thresholdSigma !== undefined ? (
              <span className="inline-flex items-center rounded-full bg-dark px-3 py-1 font-mono text-xs text-white">
                Seuil {formatDecimal(thresholdSigma, 1)}
              </span>
            ) : null}
          </div>
          {status ? (
            <p className="text-sm text-text-secondary">
              {comparisonCaption(status, consecutiveAbove, deviationScore !== null)}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
