"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export interface ProtocolCardProps {
  className?: string;
}

const STEPS = [
  "Boîtier désinfecté",
  "Contact cutané seul, sans comprimer la FAV",
  "Capteur posé sur le thrill, bras immobile",
] as const;

/** Pre-measurement checklist for the nurse. Reminders only: ticking changes nothing in the measurement gates. */
export function ProtocolCard({ className = "" }: ProtocolCardProps) {
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const remaining = done.filter((value) => !value).length;

  return (
    <div
      className={`bg-surface text-text-primary rounded-[28px] p-6 flex flex-col gap-4 shadow-[var(--shadow-card)] min-h-[220px] ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-label">Avant la mesure</span>
        <span className={`text-xs font-medium ${remaining === 0 ? "text-normal-text" : "text-text-secondary"}`} aria-live="polite">
          {remaining === 0 ? "Tout est prêt" : `${remaining} à vérifier`}
        </span>
      </div>

      <ul className="space-y-1">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              role="checkbox"
              aria-checked={done[index]}
              onClick={() => setDone((prev) => prev.map((value, i) => (i === index ? !value : value)))}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[14px] px-2 text-left text-sm font-medium text-text-primary transition-colors hover:bg-well focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  done[index] ? "border-normal-text/30 bg-normal-tint text-normal-text" : "border-hairline bg-surface text-transparent"
                }`}
              >
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
              <span className={done[index] ? "text-text-secondary" : undefined}>{label}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-auto border-t border-hairline pt-3 text-xs text-text-secondary">
        Durée 25 s. Appui stable 1,0 s requis avant le top départ.
      </p>
    </div>
  );
}
