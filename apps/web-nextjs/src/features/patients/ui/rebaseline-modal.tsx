"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/ui/pill-button";
import type { RebaselineAction } from "../model/types";

export interface RebaselineModalProps {
  idPseudo: string;
  onRebaseline: RebaselineAction;
}

export function RebaselineModal({ idPseudo, onRebaseline }: RebaselineModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [completedReason, setCompletedReason] = useState("");

  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await onRebaseline({ idPseudo, reason: reason.trim() });
      setCompletedReason(reason.trim());
      setIsOpen(false);
      setReason("");
      setIsDone(true);
    } catch {
      setError("La référence n’a pas pu être réinitialisée.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <PillButton variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        Réinitialiser la référence
      </PillButton>

      {isDone ? (
        <p className="text-xs text-text-secondary" role="status">
          Événement d’audit enregistré · {completedReason} · l’ancienne référence est archivée.
        </p>
      ) : null}

        <DialogContent className="space-y-4">
            <DialogTitle>
              Réinitialiser la référence
            </DialogTitle>
            <DialogDescription>
              La baseline actuelle sera archivée, pas supprimée.
            </DialogDescription>

            <form onSubmit={handleConfirm} className="space-y-3">
              <label htmlFor="rebaseline-reason" className="text-sm font-medium text-text-primary">
                Motif (obligatoire)
              </label>
              <textarea
                id="rebaseline-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                required
                className="w-full rounded-[16px] border border-hairline bg-surface px-4 py-3 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />

              <div className="flex flex-wrap items-center justify-end gap-3">
                <PillButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    setError(null);
                  }}
                >
                  Annuler
                </PillButton>
                <PillButton type="submit" size="sm" disabled={isSaving || reason.trim().length === 0}>
                  {isSaving ? "Enregistrement…" : "Confirmer"}
                </PillButton>
              </div>
              {error ? <p className="text-xs text-critical-text">{error}</p> : null}
            </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
