"use client";

import type { ReactNode } from "react";
import { Check, Clock, FlaskConical, RotateCcw, TriangleAlert } from "lucide-react";
import type { ApiQueueItem, ClinicalStatus } from "../model/types";

export interface QueueSummaryProps {
  queue: ApiQueueItem[];
  active: ClinicalStatus | "ALL";
  onSelect: (status: ClinicalStatus | "ALL") => void;
}

interface Tile {
  status: ClinicalStatus;
  label: string;
  hint: string;
  icon: ReactNode;
  tone: string;
}

const TILES: Tile[] = [
  { status: "UNUSUAL_EVOLUTION", label: "Évolution inhabituelle", hint: "Écart confirmé à la baseline", tone: "bg-warning-tint text-warning-text", icon: <TriangleAlert className="h-5 w-5" aria-hidden="true" /> },
  { status: "TO_CONFIRM", label: "À confirmer", hint: "Un premier écart à revérifier", tone: "bg-well text-text-secondary", icon: <Clock className="h-5 w-5" aria-hidden="true" /> },
  { status: "REJECTED_QUALITY", label: "Mesure à refaire", hint: "Qualité du signal insuffisante", tone: "bg-critical-tint text-critical-text", icon: <RotateCcw className="h-5 w-5" aria-hidden="true" /> },
  { status: "BASELINE_BUILDING", label: "Référence en cours", hint: "Pas d’alerte avant 3 mesures valides", tone: "bg-periwinkle-tint text-periwinkle", icon: <FlaskConical className="h-5 w-5" aria-hidden="true" /> },
  { status: "NORMAL", label: "Mesure correcte", hint: "Dans la référence du patient", tone: "bg-normal-tint text-normal-text", icon: <Check className="h-5 w-5" aria-hidden="true" /> },
];

/** Counts of today's queue per status. Each tile is a toggle button that filters the table below. */
export function QueueSummary({ queue, active, onSelect }: QueueSummaryProps) {
  return (
    <section aria-label="Résumé de la file du jour" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {TILES.map((tile) => {
        const count = queue.filter((item) => item.status === tile.status).length;
        const pressed = active === tile.status;
        return (
          <button
            key={tile.status}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(pressed ? "ALL" : tile.status)}
            className={`flex min-h-[88px] items-center gap-3 rounded-[24px] border bg-surface p-4 text-left transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              pressed ? "border-primary shadow-md" : "border-hairline"
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tile.tone}`}>{tile.icon}</span>
            <span className="min-w-0">
              <span className="block font-tabular text-2xl font-semibold leading-none text-text-primary">{count}</span>
              <span className="mt-1 block text-sm font-medium text-text-primary">{tile.label}</span>
              <span className="block text-xs text-text-secondary">{tile.hint}</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
