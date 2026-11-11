import type { BenchStep } from "../model/types";
import { Check } from "lucide-react";

const STEPS = [
  { number: 1, label: "Configurer" },
  { number: 2, label: "Décrire la palpation" },
  { number: 3, label: "Comparer" },
] as const;

export function BenchStepper({ current }: { current: BenchStep }) {
  return (
    <ol aria-label="Étapes du banc d’entraînement" className="flex flex-wrap items-center gap-2">
      {STEPS.map((step) => {
        const done = step.number < current;
        const active = step.number === current;
        return (
          <li
            key={step.number}
            aria-current={active ? "step" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              active
                ? "bg-primary text-white"
                : done
                  ? "bg-primary-tint text-primary"
                  : "bg-surface text-text-muted"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                active ? "bg-white/20" : done ? "bg-primary text-white" : "bg-well"
              }`}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                step.number
              )}
            </span>
            <span>
              {step.number}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
