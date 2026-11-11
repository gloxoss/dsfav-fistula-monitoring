import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { Card } from "@/components/ui/card";
import { HttpError } from "@/libs/http/fetcher";
import {
  getActiveClinicalConfig,
  getPatientHistory,
  getPatientNotes,
  getSessionRole,
} from "@/features/patients/data/patients-api";
import { toPatientDetailView } from "@/features/patients/model/adapters";
import type { ApiPatientHistory } from "@/features/patients/model/types";
import { PatientDetail } from "@/features/patients/ui/patient-detail";
import {
  addPatientNoteAction,
  rebaselinePatientAction,
  recordFollowUpIntentAction,
} from "./actions";

interface PatientDetailPageProps {
  params: Promise<{ idPseudo: string }>;
}

export default function PatientDetailPage({ params }: PatientDetailPageProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<PageSkeleton />}>
        <PatientDetailData params={params} />
      </Suspense>
    </div>
  );
}

async function PatientDetailData({ params }: PatientDetailPageProps) {
  await connection();
  const { idPseudo } = await params;

  const rolePromise = getSessionRole();
  const configPromise = getActiveClinicalConfig();

  let history: ApiPatientHistory | null = null;
  let failure: "NOT_FOUND" | "ERROR" | null = null;

  try {
    history = await getPatientHistory(idPseudo);
  } catch (error) {
    failure = error instanceof HttpError && error.status === 404 ? "NOT_FOUND" : "ERROR";
  }

  const [role, config, notes] = await Promise.all([
    rolePromise,
    configPromise,
    getPatientNotes(idPseudo),
  ]);

  if (failure || !history) {
    return (
      <Card className="space-y-3">
        <h1 className="text-2xl font-semibold text-text-primary">
          {failure === "NOT_FOUND" ? "Dossier introuvable" : "Données indisponibles"}
        </h1>
        <p className="text-sm text-text-secondary">
          {failure === "NOT_FOUND"
            ? "Aucun dossier ne correspond à ce code pseudonymisé."
            : "Le dossier n’a pas pu être chargé."}
        </p>
        <Link
          href={failure === "NOT_FOUND" ? "/patients" : `/patients/${idPseudo}`}
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          {failure === "NOT_FOUND" ? "Retour à la liste" : "Réessayer"}
        </Link>
      </Card>
    );
  }

  const patient = toPatientDetailView(history);

  return (
    <PatientDetail
      patient={patient}
      thresholdSigma={config?.values.thresholdSigma}
      isNephrologist={role === "NEPHROLOGIST"}
      notes={notes}
      onRecordFollowUp={recordFollowUpIntentAction}
      onAddNote={addPatientNoteAction}
      onRebaseline={rebaselinePatientAction}
    />
  );
}
