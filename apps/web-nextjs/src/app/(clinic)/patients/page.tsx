import { Suspense } from "react";
import { connection } from "next/server";
import { PageTitle } from "@/components/shell/page-title";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { getPatients } from "@/features/patients/data/patients-api";
import type { ApiPatientSummary } from "@/features/patients/model/types";
import { PatientsList } from "@/features/patients/ui/patients-list";

export default function PatientsPage() {
  return (
    <div className="space-y-6">
      <PageTitle first="Patients" rest="suivis" />
      <Suspense fallback={<PageSkeleton />}>
        <PatientsData />
      </Suspense>
    </div>
  );
}

async function PatientsData() {
  await connection();

  let patients: ApiPatientSummary[] = [];
  let unavailable = false;

  try {
    patients = await getPatients();
  } catch {
    unavailable = true;
  }

  return (
    <div>
      <p className="text-sm text-text-secondary mt-1">
        {unavailable
          ? "Liste indisponible"
          : `${patients.length} code${patients.length > 1 ? "s" : ""} pseudonymisé${patients.length > 1 ? "s" : ""}`}
      </p>
      <PatientsList patients={patients} unavailable={unavailable} />
    </div>
  );
}
