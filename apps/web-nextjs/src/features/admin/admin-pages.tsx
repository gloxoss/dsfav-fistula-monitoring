"use client";

import { useMemo, useState } from "react";
import type { components } from "@dsfav/shared-types";
import { Search } from "lucide-react";
import { PageTitle } from "@/components/shell/page-title";
import { formatDateTime } from "@/libs/format/datetime";
import {
  AUDIT_CATEGORIES,
  actionInfo,
  describeDetails,
  entityLabel,
  roleLabel,
  type AuditCategory,
} from "./audit-labels";

export type AuditViewRow = components["schemas"]["AuditEventSummary"];
export type UserViewRow = components["schemas"]["AdminUserSummary"];

const CATEGORY_TONE: Record<AuditCategory, string> = {
  notes: "bg-normal-tint text-normal-text",
  references: "bg-periwinkle-tint text-artifact-text",
  devices: "bg-primary-tint text-primary",
  measures: "bg-warning-tint text-warning-text",
  settings: "bg-accent-tint text-warning-text",
  other: "bg-well text-text-secondary",
};

export function AuditLogPage({
  rows = [],
  unavailable = false,
  nextCursor = null,
  onLoadMore,
}: {
  rows?: AuditViewRow[];
  unavailable?: boolean;
  nextCursor?: string | null;
  onLoadMore?: (cursor: string) => Promise<{ items: AuditViewRow[]; nextCursor: string | null }>;
}) {
  const [items, setItems] = useState<AuditViewRow[]>(rows);
  const [cursor, setCursor] = useState<string | null>(nextCursor);
  const [visibleCount, setVisibleCount] = useState<number>(50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const row of items) {
      const key = actionInfo(row.action).category;
      result[key] = (result[key] ?? 0) + 1;
    }
    return result;
  }, [items]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((row) => {
      const info = actionInfo(row.action);
      if (category !== "all" && info.category !== category) return false;
      if (date && !row.at.startsWith(date)) return false;
      if (!needle) return true;
      return [info.label, row.action, entityLabel(row.entity), row.entityId ?? "", roleLabel(row.actorRole)]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [items, category, query, date]);

  const displayedRows = useMemo(() => filteredRows.slice(0, visibleCount), [filteredRows, visibleCount]);
  const hasMore = visibleCount < filteredRows.length || (Boolean(cursor) && Boolean(onLoadMore));

  async function handleLoadMore() {
    if (visibleCount < filteredRows.length) {
      setVisibleCount((prev) => prev + 50);
      return;
    }
    if (cursor && onLoadMore) {
      setIsLoadingMore(true);
      try {
        const next = await onLoadMore(cursor);
        setItems((prev) => [...prev, ...next.items]);
        setCursor(next.nextCursor);
        setVisibleCount((prev) => prev + next.items.length);
      } finally {
        setIsLoadingMore(false);
      }
    }
  }

  const chipClass = (active: boolean) =>
    `min-h-11 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
      active ? "bg-primary text-white" : "bg-surface text-text-secondary hover:bg-well"
    }`;

  return (
    <section className="space-y-6">
      <PageTitle first="Journal d’audit" subtitle="Qui a fait quoi, et quand. Aucune donnée personnelle n’y figure." />

      <div className="space-y-3" aria-label="Filtres du journal d’audit">
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")} className={chipClass(category === "all")}>
            Tout ({items.length})
          </button>
          {AUDIT_CATEGORIES.filter((entry) => counts[entry.id]).map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={category === entry.id}
              onClick={() => setCategory(entry.id)}
              className={chipClass(category === entry.id)}
            >
              {entry.label} ({counts[entry.id]})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block min-w-64 flex-1 sm:max-w-md">
            <span className="sr-only">Rechercher dans le journal</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un événement, un appareil, un patient…"
              className="min-h-11 w-full rounded-full border border-hairline bg-surface pl-9 pr-4 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            Jour
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="min-h-11 rounded-full border border-hairline bg-surface px-4 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
        </div>
      </div>

      <p className="text-xs text-text-secondary" data-testid="audit-count">
        {displayedRows.length} affiché{displayedRows.length > 1 ? "s" : ""} sur {filteredRows.length}
      </p>

      <div className="overflow-x-auto rounded-[20px] bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-well text-xs uppercase tracking-wider text-text-label">
            <tr>
              <th className="p-3 pl-5 font-semibold">Date</th>
              <th className="p-3 font-semibold">Événement</th>
              <th className="p-3 font-semibold">Acteur</th>
              <th className="p-3 font-semibold">Cible</th>
              <th className="p-3 pr-5 font-semibold">Détails</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row) => {
              const info = actionInfo(row.action);
              const details = describeDetails(row.after as Record<string, unknown> | null);
              return (
                <tr key={row.id} className="border-t border-hairline align-top hover:bg-well/50">
                  <td className="whitespace-nowrap p-3 pl-5 font-tabular text-xs text-text-secondary">
                    {formatDateTime(row.at) ?? "—"}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${CATEGORY_TONE[info.category]}`}>
                      {info.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap p-3 text-text-primary">{roleLabel(row.actorRole)}</td>
                  <td className="p-3">
                    <span className="block text-text-primary">{entityLabel(row.entity)}</span>
                    <span className="block max-w-[14rem] truncate font-mono text-xs text-text-muted" title={row.entityId ?? undefined}>
                      {row.entityId ?? "—"}
                    </span>
                  </td>
                  <td className="p-3 pr-5 text-xs">
                    {details.length === 0 ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <dl className="space-y-0.5">
                        {details.map((detail) => (
                          <div key={detail.label} className="flex gap-1.5">
                            <dt className="text-text-muted">{detail.label}</dt>
                            <dd className="text-text-primary">{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {displayedRows.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">
            {unavailable ? "Journal d’audit indisponible." : "Aucun événement pour ces filtres."}
          </p>
        ) : null}
      </div>

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={isLoadingMore}
            className="min-h-11 cursor-pointer rounded-full border border-hairline bg-surface px-6 text-sm font-medium text-text-primary transition-colors hover:bg-well focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            {isLoadingMore ? "Chargement…" : "Charger plus"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function UserListPage({ rows, unavailable = false }: { rows: UserViewRow[]; unavailable?: boolean }) {
  return (
    <section className="space-y-6">
      <PageTitle first="Utilisateurs" subtitle="Rôle et état des comptes, sans données personnelles." />
      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-well text-text-secondary"><tr><th className="p-3">Rôle</th><th className="p-3">État</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.role}-${index}`} className="border-t border-hairline"><td className="p-3">{row.role}</td><td className="p-3">{row.status}</td></tr>)}</tbody>
        </table>
        {rows.length === 0 ? <p className="p-4 text-sm text-text-secondary">{unavailable ? "Liste des utilisateurs indisponible." : "Aucun compte disponible."}</p> : null}
      </div>
    </section>
  );
}
