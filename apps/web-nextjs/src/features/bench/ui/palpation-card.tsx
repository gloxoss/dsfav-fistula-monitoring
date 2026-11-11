import { Card } from "@/components/ui/card";
import { PillButton } from "@/components/ui/pill-button";
import { LockKeyhole } from "lucide-react";
import {
  BENCH_INTENSITY_MAX,
  BENCH_INTENSITY_MIN,
  PERCEIVED_THRILL_LABELS,
  PERCEIVED_THRILL_ORDER,
} from "../model/constants";
import type { PerceivedThrill } from "../model/types";

export interface PalpationDraft {
  perceivedThrill: PerceivedThrill | null;
  perceivedIntensity: number | null;
  internNotes: string;
}

export interface LockedPalpation {
  perceivedThrill: PerceivedThrill;
  perceivedIntensity: number;
  internNotes: string | null;
}

export interface PalpationCardProps {
  locked: boolean;
  draft: PalpationDraft;
  lockedValues: LockedPalpation | null;
  onChange: (draft: PalpationDraft) => void;
  onValidate: () => void;
  isValidating: boolean;
}

const INTENSITIES = Array.from(
  { length: BENCH_INTENSITY_MAX - BENCH_INTENSITY_MIN + 1 },
  (_, index) => BENCH_INTENSITY_MIN + index,
);

export function PalpationCard({
  locked,
  draft,
  lockedValues,
  onChange,
  onValidate,
  isValidating,
}: PalpationCardProps) {
  if (locked && lockedValues) {
    return (
      <Card className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Votre palpation</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-xs font-medium text-primary">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Verrouillée
          </span>
        </div>

        <div>
          <p className="text-[13px] font-medium text-text-label">Sensation perçue</p>
          <p className="mt-1 text-base font-medium text-text-primary">
            {PERCEIVED_THRILL_LABELS[lockedValues.perceivedThrill]}
          </p>
        </div>

        <div>
          <p className="text-[13px] font-medium text-text-label">Intensité perçue</p>
          <p className="mt-1 text-base font-medium text-text-primary">
            {lockedValues.perceivedIntensity} / 5
          </p>
        </div>

        <div className="rounded-[20px] bg-well p-4">
          <p className="text-[13px] font-medium text-text-label">Note libre</p>
          <p className="mt-1 text-sm text-text-secondary">
            {lockedValues.internNotes && lockedValues.internNotes.trim().length > 0
              ? lockedValues.internNotes
              : "Aucune note."}
          </p>
        </div>
      </Card>
    );
  }

  const isValid = draft.perceivedThrill !== null && draft.perceivedIntensity !== null;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Votre palpation</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Décrivez votre palpation avant de révéler la mesure.
        </p>
      </div>

      <fieldset>
        <legend className="text-[13px] font-medium text-text-label">Sensation perçue</legend>
        <div className="mt-2 space-y-2">
          {PERCEIVED_THRILL_ORDER.map((thrill) => {
            const selected = draft.perceivedThrill === thrill;
            return (
              <label
                key={thrill}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-full px-4 text-sm font-medium transition ${
                  selected
                    ? "bg-primary text-white"
                    : "bg-well text-text-secondary hover:bg-hairline"
                }`}
              >
                <input
                  type="radio"
                  name="perceived-thrill"
                  value={thrill}
                  checked={selected}
                  onChange={() => onChange({ ...draft, perceivedThrill: thrill })}
                  className="h-4 w-4 accent-primary"
                />
                <span>{PERCEIVED_THRILL_LABELS[thrill]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[13px] font-medium text-text-label">
          Intensité perçue (1 à 5)
        </legend>
        <div className="mt-2 flex gap-2">
          {INTENSITIES.map((intensity) => {
            const selected = draft.perceivedIntensity === intensity;
            return (
              <button
                key={intensity}
                type="button"
                aria-pressed={selected}
                aria-label={`Intensité ${intensity}`}
                onClick={() => onChange({ ...draft, perceivedIntensity: intensity })}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  selected
                    ? "bg-primary text-white"
                    : "bg-well text-text-secondary hover:bg-hairline"
                }`}
              >
                {intensity}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="palpation-note" className="text-[13px] font-medium text-text-label">
          Note libre (facultative)
        </label>
        <textarea
          id="palpation-note"
          rows={2}
          value={draft.internNotes}
          onChange={(event) => onChange({ ...draft, internNotes: event.target.value })}
          className="mt-1 w-full rounded-[14px] bg-well p-3 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <div>
        <PillButton
          type="button"
          onClick={onValidate}
          disabled={!isValid}
          isLoading={isValidating}
          aria-describedby={!isValid ? "palpation-reason" : undefined}
        >
          Valider mon observation
        </PillButton>
        {!isValid ? (
          <p id="palpation-reason" className="mt-2 text-xs text-text-label">
            Choisissez une sensation et une intensité
          </p>
        ) : null}
      </div>
    </Card>
  );
}
