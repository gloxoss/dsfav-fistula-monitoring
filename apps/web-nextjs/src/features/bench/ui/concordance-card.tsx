import { Card } from "@/components/ui/card";
import {
  BENCH_BREAKDOWN_MAX,
  BENCH_LOW_CONCORDANCE_PCT,
  BENCH_SIMULATION_LINE,
} from "../model/constants";
import type { BenchSessionResult } from "../model/types";

export interface ConcordanceCardProps {
  result: BenchSessionResult | null;
}

export function ConcordanceCard({ result }: ConcordanceCardProps) {
  if (!result) {
    return (
      <Card variant="dark" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-white">Concordance</h2>
        <p className="text-sm text-white/70">
          La concordance apparaîtra après la révélation.
        </p>
        <p className="text-xs text-white/50">{BENCH_SIMULATION_LINE}</p>
      </Card>
    );
  }

  const score = Math.round(result.concordanceScore);
  const lowConcordance = score < BENCH_LOW_CONCORDANCE_PCT;
  const breakdown = result.concordanceBreakdown ?? {};
  const ringLength = 2 * Math.PI * 40;
  const ringFill = Math.min(Math.max(score, 0), 100) / 100;

  return (
    <Card variant="dark" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-white">Concordance</h2>

      <div className={`flex items-center gap-4 ${lowConcordance ? "text-warning" : "text-cyan"}`}>
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" className="shrink-0">
          <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="12" />
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${ringLength * ringFill} ${ringLength}`}
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div>
          <p className="text-[44px] font-medium leading-none tabular-nums text-white">
            {score} %
          </p>
          <p className="mt-1 text-sm text-white/70">Indicateur pédagogique</p>
        </div>
      </div>

      {lowConcordance ? (
        <p className="text-sm font-medium text-warning">
          Écart important entre votre sensation et la mesure.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {typeof breakdown.sensationScorePct === "number" ? (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            {`Catégorie ${breakdown.sensationScorePct}/${BENCH_BREAKDOWN_MAX.sensation}`}
          </span>
        ) : null}
        {typeof breakdown.intensityScorePct === "number" ? (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            {`Intensité ${breakdown.intensityScorePct}/${BENCH_BREAKDOWN_MAX.intensity}`}
          </span>
        ) : null}
        {typeof breakdown.notesScorePct === "number" ? (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            {`Note ${breakdown.notesScorePct}/${BENCH_BREAKDOWN_MAX.notes}`}
          </span>
        ) : null}
      </div>

      <p className="text-xs text-white/60">
        Profil attendu : {result.expectedProfile.trim().length > 0 ? result.expectedProfile : "à calibrer"}
      </p>
      <p className="text-xs text-white/60">{BENCH_SIMULATION_LINE}</p>
    </Card>
  );
}
