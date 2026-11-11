"use client";

import { useActionState } from "react";
import { PillButton } from "@/components/ui/pill-button";
import type { CalibrationAction, CalibrationState } from "../model/types";

const INITIAL_STATE: CalibrationState = { error: null, ok: false };

export interface CalibrationFormProps {
  deviceId: string;
  serialNumber: string;
  action: CalibrationAction;
}

const FIELD_CLASS =
  "mt-1 w-full rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan";

export function CalibrationForm({ deviceId, serialNumber, action }: CalibrationFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="deviceId" value={deviceId} />
      <p className="text-sm text-text-muted">
        Gain mesuré au banc pour {serialNumber}, ratio appliqué aux prochaines mesures.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-text-muted">
          Gain mesuré (ratio)
          <input
            name="calibrationGain"
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0.5"
            max="2"
            required
            className={FIELD_CLASS}
          />
        </label>
        <label className="block text-xs text-text-muted">
          Motif de la calibration
          <input
            name="reason"
            type="text"
            required
            maxLength={200}
            className={FIELD_CLASS}
          />
        </label>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-critical-tint">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-normal-tint">
          Calibration enregistrée.
        </p>
      ) : null}
      <PillButton type="submit" isLoading={isPending}>
        Lancer la calibration
      </PillButton>
    </form>
  );
}
