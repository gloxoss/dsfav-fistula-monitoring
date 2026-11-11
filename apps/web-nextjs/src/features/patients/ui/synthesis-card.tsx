import { Card } from "@/components/ui/card";
import { formatDecimal, formatGrams } from "../model/format";
import type { BaselineFeatures, FollowUpAction, SessionView } from "../model/types";
import { FollowUpButton } from "./follow-up-button";

export interface SynthesisCardProps {
  idPseudo: string;
  baseline: BaselineFeatures | null;
  latest: SessionView | null;
  canFollowUp: boolean;
  onRecordIntent?: FollowUpAction;
  className?: string;
}

export function SynthesisCard({
  idPseudo,
  baseline,
  latest,
  canFollowUp,
  onRecordIntent,
  className = "",
}: SynthesisCardProps) {
  const showFollowUp =
    canFollowUp &&
    latest !== null &&
    latest.status !== "REJECTED_QUALITY" &&
    onRecordIntent !== undefined;

  return (
    <Card variant="dark" className={`space-y-4 ${className}`}>
      <h2 className="text-[13px] font-medium tracking-wide text-white/70">Synthèse du signal</h2>

      {latest ? (
        <ul className="space-y-1.5 text-sm text-white/90">
          {latest.peakFreqHz !== null ? (
            <li>
              Pic de fréquence{" "}
              {baseline ? `${formatDecimal(baseline.peakFreqHz, 0)} → ` : ""}
              {formatDecimal(latest.peakFreqHz, 0)} Hz
            </li>
          ) : null}
          {latest.rmsG !== null ? (
            <li>
              RMS {baseline ? `${formatGrams(baseline.rmsG)} → ` : ""}
              {formatGrams(latest.rmsG)}
              {latest.avgPressureKpa !== null
                ? ` · appui moyen ${formatDecimal(latest.avgPressureKpa, 1)} kPa`
                : ""}
            </li>
          ) : null}
          {latest.cleanDurationSec !== null ? (
            <li>Durée propre {formatDecimal(latest.cleanDurationSec, 1)} s</li>
          ) : null}
        </ul>
      ) : (
        <p className="text-sm text-white/70">Aucune mesure exploitable pour ce patient.</p>
      )}

      {latest?.isUnusualEvolution && latest.explanation ? (
        <p className="rounded-[16px] bg-white/10 p-3 text-sm leading-relaxed text-white">
          {latest.explanation}
        </p>
      ) : null}

      {showFollowUp && latest && onRecordIntent ? (
        <FollowUpButton
          idPseudo={idPseudo}
          measurementId={latest.measurementId}
          onRecordIntent={onRecordIntent}
        />
      ) : null}
    </Card>
  );
}
