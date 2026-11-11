"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Disclaimer } from "@/components/shared/disclaimer";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { formatSessionDate } from "../model/format";
import type { ApiPatientSummary } from "../model/types";
import { ReviewStatusPill } from "./review-status-pill";

export interface PatientsListProps {
  patients: ApiPatientSummary[];
  unavailable?: boolean;
}

function baselineLabel(patient: ApiPatientSummary): string {
  return patient.baselineLocked ? "Active" : "En construction";
}

export function PatientsList({ patients, unavailable = false }: PatientsListProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return patients;
    return patients.filter((patient) => patient.idPseudo.toLowerCase().includes(needle));
  }, [patients, query]);

  const locked = patients.filter((patient) => patient.baselineLocked).length;
  const building = patients.filter(
    (patient) => !patient.baselineLocked && patient.lastMeasurementAt !== null,
  ).length;
  const toReview = patients.filter(
    (patient) => patient.lastStatus === "UNUSUAL_EVOLUTION" || patient.lastStatus === "TO_CONFIRM",
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Baselines actives" value={locked} />
        <MetricCard label="En construction" value={building} />
        <MetricCard label="À revoir" value={toReview} />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="patient-search" className="sr-only">
            Rechercher un code patient
          </label>
          <input
            id="patient-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un code (PT-CAS-…)"
            className="w-full rounded-full border border-hairline bg-well px-4 py-2.5 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary sm:max-w-md"
          />
          <span className="text-xs text-text-secondary">
            {visible.length} code{visible.length > 1 ? "s" : ""} pseudonymisé{visible.length > 1 ? "s" : ""}
          </span>
        </div>

        {unavailable ? (
          <div className="space-y-2 rounded-[20px] bg-well p-5">
            <p className="text-sm text-text-primary">Patients indisponibles.</p>
            <Link href="/patients" className="text-sm font-medium text-primary underline underline-offset-4">
              Réessayer
            </Link>
          </div>
        ) : patients.length === 0 ? (
          <div className="space-y-2 rounded-[20px] bg-well p-5">
            <p className="text-sm text-text-primary">Un patient est créé à sa première mesure.</p>
            <Link href="/capture" className="text-sm font-medium text-primary underline underline-offset-4">
              Aller à l’acquisition
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-well p-5">
            <p className="text-sm text-text-primary">Aucun code ne correspond.</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-full border border-hairline bg-surface px-4 py-1.5 text-xs font-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Effacer la recherche
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <caption className="sr-only">Patients suivis</caption>
              <thead>
                <tr className="text-xs font-medium uppercase tracking-wide text-text-label">
                  <th scope="col" className="pb-3 pr-4 font-medium">Patient</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Baseline</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Dernière mesure</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Statut</th>
                  <th scope="col" className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {visible.map((patient) => (
                  <tr key={patient.id}>
                    <td className="py-3 pr-4 font-mono text-sm text-text-primary">{patient.idPseudo}</td>
                    <td className="py-3 pr-4 text-sm text-text-secondary">{baselineLabel(patient)}</td>
                    <td className="py-3 pr-4 font-tabular text-sm text-text-secondary">
                      {formatSessionDate(patient.lastMeasurementAt) ?? "Aucune"}
                    </td>
                    <td className="py-3 pr-4">
                      {patient.lastStatus ? (
                        <ReviewStatusPill status={patient.lastStatus} />
                      ) : (
                        <span className="text-sm text-text-muted">Aucun historique</span>
                      )}
                    </td>
                    <td className="py-3 text-sm">
                      <Link
                        href={`/patients/${patient.idPseudo}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Voir le dossier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="space-y-2">
        <Disclaimer />
        <p className="text-xs text-text-secondary">
          Seuls des codes pseudonymisés sont affichés. La correspondance avec l’identité reste dans le
          dossier de l’établissement.
        </p>
      </div>
    </div>
  );
}
