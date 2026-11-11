import { CircleCheck, History } from "lucide-react";
import { PageTitle } from "@/components/shell/page-title";
import { PatientNav, type PatientNavOption } from "@/components/shared/patient-nav";
import { formatDateTime } from "@/libs/format/datetime";
import type { BaselineVersion } from "./data/baseline-history-api";

export function BaselineHistoryPage({
  rows,
  patients,
  selectedPatient,
  unavailable = false,
}: {
  rows: BaselineVersion[];
  patients: PatientNavOption[];
  selectedPatient?: string;
  unavailable?: boolean;
}) {
  const currentPatient = selectedPatient || patients[0]?.idPseudo;

  return (
    <section className="space-y-6">
      <PageTitle first="Historique des références" subtitle="Chaque référence personnelle, son motif et sa date de verrouillage." />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <PatientNav options={patients} current={currentPatient} basePath="/baseline-history" />

        <div className="min-w-0 space-y-4">
          {currentPatient ? <h2 className="font-mono text-xl font-semibold text-text-primary">{currentPatient}</h2> : null}

          {rows.length > 0 ? (
            <ol className="space-y-3">
              {rows.map((row, index) => (
                <li
                  key={`${row.lockedAt}-${index}`}
                  className={`flex gap-3 rounded-[20px] bg-surface p-4 shadow-[var(--shadow-card)] ${row.active ? "ring-1 ring-normal/30" : ""}`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      row.active ? "bg-normal-tint text-normal-text" : "bg-well text-text-secondary"
                    }`}
                    aria-hidden="true"
                  >
                    {row.active ? <CircleCheck className="h-4 w-4" /> : <History className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.active ? "bg-normal-tint text-normal-text" : "bg-well text-text-secondary"
                        }`}
                      >
                        {row.active ? "Active" : "Archivée"}
                      </span>
                      <span className="font-tabular text-xs text-text-muted">
                        Verrouillée le {formatDateTime(row.lockedAt) ?? "—"}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-text-primary">{row.reason ?? "Aucun motif renseigné"}</p>
                    {row.archivedAt ? (
                      <p className="text-xs text-text-muted">Archivée le {formatDateTime(row.archivedAt) ?? "—"}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-[20px] border border-dashed border-hairline p-6 text-sm text-text-secondary">
              {unavailable ? (
                <p>Historique des références indisponible.</p>
              ) : currentPatient ? (
                <div className="space-y-1.5">
                  <p className="font-medium text-text-primary">Aucune version pour ce patient.</p>
                  <p className="text-xs text-text-muted">
                    La référence se construit avec les 3 premières mesures conformes, puis se verrouille. Seul un néphrologue la recalcule, avec un motif.
                  </p>
                </div>
              ) : (
                <p>Aucun patient disponible.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
