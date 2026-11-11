import Link from "next/link";
import { EyeOff, GraduationCap } from "lucide-react";
import { PageTitle } from "@/components/shell/page-title";
import { formatDateTime } from "@/libs/format/datetime";

export interface BenchHistoryRow {
  sessionId: string;
  createdAt: string;
  revealed: boolean;
  concordance?: string | null;
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[20px] bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-label">{label}</p>
      <p className={`mt-1 font-tabular text-3xl font-medium ${tone}`}>{value}</p>
    </div>
  );
}

export function BenchHistoryPage({ rows, unavailable = false }: { rows: BenchHistoryRow[]; unavailable?: boolean }) {
  const revealed = rows.filter((row) => row.revealed).length;

  return (
    <section className="space-y-6">
      <PageTitle first="Historique du banc" subtitle="Séances d’entraînement sur fantôme et concordance après révélation." />

      {rows.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
          <Tile label="Séances" value={rows.length} tone="text-text-primary" />
          <Tile label="Révélées" value={revealed} tone="text-normal-text" />
          <Tile label="En attente" value={rows.length - revealed} tone="text-warning-text" />
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ol className="space-y-3">
          {rows.map((row) => (
            <li key={row.sessionId} className="flex gap-3 rounded-[20px] bg-surface p-4 shadow-[var(--shadow-card)]">
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  row.revealed ? "bg-normal-tint text-normal-text" : "bg-warning-tint text-warning-text"
                }`}
                aria-hidden="true"
              >
                {row.revealed ? <GraduationCap className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      row.revealed ? "bg-normal-tint text-normal-text" : "bg-warning-tint text-warning-text"
                    }`}
                  >
                    {row.revealed ? "Révélée" : "En attente"}
                  </span>
                  <span className="font-tabular text-xs text-text-muted">{formatDateTime(row.createdAt) ?? "—"}</span>
                </div>
                <p className="mt-2 text-sm text-text-primary">
                  <span className="text-text-secondary">Concordance : </span>
                  {row.revealed ? row.concordance ?? "Indisponible" : "Non révélée"}
                </p>
                <p className="mt-1 truncate font-mono text-xs text-text-muted" title={row.sessionId}>
                  {row.sessionId}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-[20px] border border-dashed border-hairline p-6 text-sm text-text-secondary">
          {unavailable ? (
            <p>Historique du banc indisponible.</p>
          ) : (
            <div className="space-y-1.5">
              <p className="font-medium text-text-primary">Aucune séance pour l’instant.</p>
              <p className="text-xs text-text-muted">
                Une séance commence sur le{" "}
                <Link href="/training-bench" className="text-primary underline underline-offset-4">
                  banc d’entraînement
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-text-secondary">Simulation sur banc, pas de donnée patient.</p>
    </section>
  );
}
