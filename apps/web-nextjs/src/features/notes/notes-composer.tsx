"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AddNoteForPatient = (input: { idPseudo: string; text: string }) => Promise<void>;

export function NotesComposer({ idPseudo, onAddNote }: { idPseudo: string; onAddNote: AddNoteForPatient }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputId = `note-${idPseudo}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setState("saving");
    try {
      await onAddNote({ idPseudo, text: trimmed });
      setText("");
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-hairline bg-surface p-4">
      <label htmlFor={inputId} className="block text-sm font-medium text-text-primary">
        Nouvelle note pour {idPseudo}
      </label>
      <textarea
        id={inputId}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (state !== "idle") setState("idle");
        }}
        rows={3}
        maxLength={2000}
        placeholder="Observation clinique, décision, point à revoir…"
        className="w-full rounded-[16px] border border-hairline bg-surface px-4 py-3 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={state === "saving" || text.trim().length === 0}
          className="min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "saving" ? "Enregistrement…" : "Enregistrer la note"}
        </button>
        <span role="status" className="text-xs">
          {state === "saved" ? (
            <span className="text-normal-text">Note enregistrée.</span>
          ) : state === "error" ? (
            <span className="text-critical-text">La note n’a pas pu être enregistrée. Réessayez.</span>
          ) : (
            <span className="text-text-muted">{text.length} / 2000</span>
          )}
        </span>
      </div>
    </form>
  );
}
