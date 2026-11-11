import { Disclaimer } from "@/components/shared/disclaimer";
import type { AiOpinion } from "../types";

export interface AiOpinionCardProps {
  aiOpinion: AiOpinion | null | undefined;
  baselineBuilding: boolean;
  /** false when the host screen already shows the one verbatim disclaimer */
  showDisclaimer?: boolean;
}

function EvidenceList({ title, values }: { title: string; values: { name: string; value: number }[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      <ul className="mt-1 list-disc pl-5 text-sm text-text-secondary">
        {values.map(({ name, value }) => (
          <li key={name}>{name} : {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(value)}</li>
        ))}
      </ul>
    </div>
  );
}

export function AiOpinionCard({ aiOpinion, baselineBuilding, showDisclaimer = true }: AiOpinionCardProps) {
  if (!aiOpinion || baselineBuilding) return null;
  return (
    <section aria-labelledby="ai-opinion-title" className="space-y-3 rounded-[20px] border border-hairline bg-surface p-4">
      <h2 id="ai-opinion-title" className="text-base font-semibold text-text-primary">Avis complémentaire</h2>
      <div className="space-y-2">
        <EvidenceList title="Caractéristiques mesurées" values={aiOpinion.evidence.features} />
        <EvidenceList title="Valeurs de référence" values={aiOpinion.evidence.baselineValues} />
        {aiOpinion.evidence.topContributors.length ? (
          <div>
            <h3 className="text-sm font-medium text-text-primary">Principaux contributeurs</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-text-secondary">
              {aiOpinion.evidence.topContributors.map((name: string) => <li key={name}>{name}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="text-sm font-medium text-text-primary">Niveau estimé : {aiOpinion.level}</p>
      {aiOpinion.dataLabel === "Données synthétiques, non cliniques" ? (
        <p className="text-sm text-text-secondary">Données synthétiques, non cliniques</p>
      ) : null}
      {showDisclaimer ? <Disclaimer /> : null}
    </section>
  );
}
