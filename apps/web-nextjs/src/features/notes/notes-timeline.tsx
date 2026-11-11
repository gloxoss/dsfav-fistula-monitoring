"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, NotebookPen } from "lucide-react";
import { formatSessionDate } from "@/features/patients/model/format";

export interface TimelineRow {
  idPseudo: string;
  kind: "NOTE" | "FOLLOW_UP";
  createdAt: string;
  text?: string;
}

type Filter = "ALL" | "NOTE" | "FOLLOW_UP";

export function NotesTimeline({ rows, idPseudo, unavailable }: { rows: TimelineRow[]; idPseudo?: string; unavailable: boolean }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const noteCount = rows.filter((row) => row.kind === "NOTE").length;
  const followUpCount = rows.length - noteCount;
  const visible = filter === "ALL" ? rows : rows.filter((row) => row.kind === filter);

  const tabs: Array<{ id: Filter; label: string }> = [
    { id: "ALL", label: `Tout (${rows.length})` },
    { id: "NOTE", label: `Notes (${noteCount})` },
    { id: "FOLLOW_UP", label: `Suivis (${followUpCount})` },
  ];

  return (
    <section aria-label="Historique" className="space-y-4">
      <div role="tablist" aria-label="Filtrer l’historique" className="inline-flex rounded-full bg-well p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={`min-h-9 rounded-full px-4 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-primary ${
              filter === tab.id ? "bg-surface text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <ol className="space-y-3">
          {visible.map((row, index) => {
            const isNote = row.kind === "NOTE";
            return (
              <li
                key={`${row.createdAt}-${index}`}
                className="flex gap-3 rounded-[20px] bg-surface p-4 shadow-[var(--shadow-card)]"
              >
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    isNote ? "bg-normal-tint text-normal-text" : "bg-warning-tint text-warning-text"
                  }`}
                  aria-hidden="true"
                >
                  {isNote ? <NotebookPen className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-text-label">{isNote ? "Note clinique" : "Intention de suivi"}</span>
                    <span className="font-tabular text-text-muted">{formatSessionDate(row.createdAt) ?? "—"}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-text-primary">{row.text ?? "—"}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-[20px] border border-dashed border-hairline p-6 text-sm text-text-secondary">
          {unavailable ? (
            <p>Notes et suivis indisponibles.</p>
          ) : rows.length === 0 && idPseudo ? (
            <div className="space-y-1.5">
              <p className="font-medium text-text-primary">Aucune note pour ce patient.</p>
              <p className="text-xs text-text-muted">
                Vous pouvez ajouter une note ou une intention de suivi depuis la{" "}
                <Link href={`/patients/${idPseudo}`} className="text-primary underline underline-offset-4">
                  fiche du patient {idPseudo}
                </Link>
                .
              </p>
            </div>
          ) : rows.length === 0 ? (
            <p>Aucun patient disponible dans la file.</p>
          ) : (
            <p>Aucun élément de ce type pour ce patient.</p>
          )}
        </div>
      )}
    </section>
  );
}
