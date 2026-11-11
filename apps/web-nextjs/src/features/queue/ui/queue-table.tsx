"use client";

import { useState } from "react";
import Link from "next/link";
import { formatTime } from "@/features/patients/model/format";
import { formatDeviceName } from "@/features/devices/model/format";
import type { ApiQueueItem, ClinicalStatus } from "../model/types";
import { QueueStatusPill } from "./queue-status-pill";

export interface QueueTableProps {
  queue: ApiQueueItem[];
  /** Controlled filter shared with the summary tiles. Falls back to local state when omitted. */
  statusFilter?: ClinicalStatus | "ALL";
  onStatusFilterChange?: (status: ClinicalStatus | "ALL") => void;
}

export function QueueTable({ queue, statusFilter: controlledFilter, onStatusFilterChange }: QueueTableProps) {
  const [localFilter, setLocalFilter] = useState<ClinicalStatus | "ALL">("ALL");
  const statusFilter = controlledFilter ?? localFilter;
  const setStatusFilter = onStatusFilterChange ?? setLocalFilter;

  if (queue.length === 0) {
    return (
      <p className="rounded-[20px] bg-well p-5 text-sm text-text-secondary">
        Aucune mesure aujourd’hui. Les patients apparaissent ici dès qu’une mesure est enregistrée.
      </p>
    );
  }

  const rows = [...queue].sort(
    (left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
  );
  const visibleRows = statusFilter === "ALL" ? rows : rows.filter((item) => item.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="queue-status-filter" className="text-sm font-medium text-text-label">
          Filtrer par statut
        </label>
        <select
          id="queue-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as ClinicalStatus | "ALL")}
          className="min-h-11 rounded-full border border-hairline bg-surface px-4 text-sm text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="NORMAL">Mesure correcte</option>
          <option value="TO_CONFIRM">À confirmer</option>
          <option value="UNUSUAL_EVOLUTION">Évolution inhabituelle</option>
          <option value="REJECTED_QUALITY">Mesure à refaire</option>
          <option value="BASELINE_BUILDING">Référence en cours</option>
        </select>
      </div>

      {visibleRows.length === 0 ? (
        <p role="status" className="rounded-[20px] bg-well p-5 text-sm text-text-secondary">
          Aucune mesure ne correspond à ce statut.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">Patients à examiner aujourd’hui</caption>
            <thead>
              <tr className="text-xs font-medium uppercase tracking-wide text-text-label">
                <th scope="col" className="pb-3 pr-4 font-medium">Heure</th>
                <th scope="col" className="pb-3 pr-4 font-medium">Patient</th>
                <th scope="col" className="pb-3 pr-4 font-medium">Statut</th>
                <th scope="col" className="pb-3 pr-4 font-medium">Appareil</th>
                <th scope="col" className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {visibleRows.map((item) => (
                <tr key={item.measurementId}>
                  <td className="py-3 pr-4 font-tabular text-sm text-text-secondary">
                    {formatTime(item.recordedAt) ?? "—"}
                  </td>
                  <td className="py-3 pr-4 font-mono text-sm text-text-primary">
                    {item.idPseudo ?? "Non rattaché"}
                  </td>
                  <td className="py-3 pr-4">
                    <QueueStatusPill status={item.status} />
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-text-secondary" title={item.deviceId}>
                    {formatDeviceName(item.deviceId)}
                  </td>
                  <td className="py-3 text-sm">
                    {item.idPseudo ? (
                      <Link
                        href={`/patients/${item.idPseudo}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Voir le dossier
                      </Link>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
