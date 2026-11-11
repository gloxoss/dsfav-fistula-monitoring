"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PillButton } from "@/components/ui/pill-button";
import { formatSessionDate } from "../model/format";
import type { AddNoteAction, PatientNote } from "../model/types";

export type NoteView = PatientNote;

export interface NotesCardProps {
  idPseudo: string;
  canAddNote: boolean;
  initialNotes?: NoteView[];
  onAddNote?: AddNoteAction;
  className?: string;
}

export function NotesCard({
  idPseudo,
  canAddNote,
  initialNotes = [],
  onAddNote,
  className = "",
}: NotesCardProps) {
  const [notes, setNotes] = useState<NoteView[]>(initialNotes);
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !onAddNote) return;

    setIsSaving(true);
    setError(null);
    try {
      await onAddNote({ idPseudo, text: trimmed });
      setNotes((current) => [
        {
          id: `local-${Date.now()}`,
          text: trimmed,
          createdAt: new Date().toISOString(),
          authorLabel: "Vous",
        },
        ...current,
      ]);
      setText("");
    } catch {
      setError("La note n’a pas pu être enregistrée.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className={`space-y-4 ${className}`}>
      <h2 className="text-[13px] font-medium tracking-wide text-text-label">Notes cliniques</h2>

      {notes.length === 0 ? (
        <p className="text-sm text-text-secondary">Aucune note pour ce patient.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-[16px] bg-well p-3">
              <p className="text-sm text-text-primary">{note.text}</p>
              <p className="mt-1 text-xs text-text-secondary">
                {note.authorLabel ? `${note.authorLabel} · ` : ""}
                {formatSessionDate(note.createdAt) ?? ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canAddNote && onAddNote ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <label htmlFor="note-text" className="sr-only">
            Ajouter une note
          </label>
          <textarea
            id="note-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="Ajouter une note"
            className="w-full rounded-[16px] border border-hairline bg-surface px-4 py-3 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <div className="flex items-center gap-3">
            <PillButton type="submit" size="sm" disabled={isSaving || text.trim().length === 0}>
              {isSaving ? "Enregistrement…" : "Enregistrer la note"}
            </PillButton>
            {error ? <span className="text-xs text-critical-text">{error}</span> : null}
          </div>
        </form>
      ) : null}
    </Card>
  );
}
