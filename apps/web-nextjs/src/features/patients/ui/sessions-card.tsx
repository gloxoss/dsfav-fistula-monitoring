"use client";

import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatSessionDate } from "../model/format";
import type { SessionView } from "../model/types";
import { ReviewStatusPill } from "./review-status-pill";

export interface SessionsCardProps {
  sessions: SessionView[];
  className?: string;
}

export function SessionsCard({ sessions, className = "" }: SessionsCardProps) {
  // Newest first
  const rows = [...sessions].reverse();
  const visibleRows = rows.slice(0, 6);
  const total = rows.length;

  return (
    <Card className={`space-y-3 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium tracking-wide text-text-label">Séances</h2>
        <span className="text-xs text-text-muted">{total} au total</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">Aucune séance enregistrée.</p>
      ) : (
        <>
          <ol className="divide-y divide-hairline">
            {visibleRows.map((session) => (
              <li
                key={session.measurementId}
                className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1.5 first:pt-0 last:pb-0"
              >
                <span className="font-tabular text-xs sm:text-sm text-text-primary shrink-0">
                  {formatSessionDate(session.recordedAt) ?? "Date inconnue"}
                </span>
                <ReviewStatusPill status={session.status} size="sm" />
              </li>
            ))}
          </ol>

          {total > 6 ? (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 focus:outline-hidden"
                >
                  Voir tout ({total} séances)
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
                <DialogTitle>Historique complet des séances</DialogTitle>
                <DialogDescription>
                  {total} séances enregistrées pour ce patient.
                </DialogDescription>
                <div className="overflow-y-auto mt-4 pr-1 max-h-[50vh]">
                  <ol className="divide-y divide-hairline">
                    {rows.map((session) => (
                      <li
                        key={session.measurementId}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span className="font-tabular text-text-primary shrink-0">
                          {formatSessionDate(session.recordedAt) ?? "Date inconnue"}
                        </span>
                        <ReviewStatusPill status={session.status} size="sm" />
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="mt-4 pt-3 border-t border-hairline flex justify-end">
                  <DialogClose asChild>
                    <button
                      type="button"
                      className="px-4 py-2 text-xs font-semibold rounded-full bg-well text-text-primary hover:bg-hairline transition"
                    >
                      Fermer
                    </button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </>
      )}
    </Card>
  );
}
