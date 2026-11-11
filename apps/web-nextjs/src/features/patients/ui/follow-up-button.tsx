"use client";

import { useState } from "react";
import type { FollowUpAction } from "../model/types";

export interface FollowUpButtonProps {
  idPseudo: string;
  measurementId: string;
  onRecordIntent: FollowUpAction;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function FollowUpButton({ idPseudo, measurementId, onRecordIntent }: FollowUpButtonProps) {
  const [state, setState] = useState<SaveState>("idle");

  async function handleClick() {
    setState("saving");
    try {
      await onRecordIntent({ idPseudo, measurementId });
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "saving"}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-cyan px-5 py-2.5 text-sm font-medium text-cyan outline-none transition hover:bg-cyan/10 focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "saving" ? "Enregistrement…" : "Documenter une orientation écho-Doppler"}
      </button>
      <p className="text-xs text-white/70">
        {state === "saved"
          ? "Intention enregistrée · aucune demande n’est envoyée."
          : state === "error"
            ? "L’intention n’a pas pu être enregistrée. Réessayez."
            : "Enregistre votre intention, aucune demande n’est envoyée."}
      </p>
    </div>
  );
}
