import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { BaselineHistoryPage } from "@/features/baseline-history/baseline-history-page";
import { getPatientBaselineVersions } from "@/features/baseline-history/data/baseline-history-api";
import { getPatients } from "@/features/patients/data/patients-api";
import { armSideLabel, fistulaLabel } from "@/features/patients/model/format";
import type { BaselineVersion } from "@/features/baseline-history/data/baseline-history-api";
import type { PatientNavOption } from "@/components/shared/patient-nav";

export default function BaselineHistoryRoute({ searchParams }: { searchParams: Promise<{ idPseudo?: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BaselineHistoryData searchParams={searchParams} />
    </Suspense>
  );
}

async function BaselineHistoryData({ searchParams }: { searchParams: Promise<{ idPseudo?: string }> }) {
  await connection();
  const { idPseudo } = await searchParams;
  let patients: PatientNavOption[] = [];
  let rows: BaselineVersion[] = [];
  let unavailable = false;
  let selected = idPseudo;
  try {
    patients = (await getPatients()).map((patient) => ({
      idPseudo: patient.idPseudo,
      fistula: fistulaLabel(patient.fistulaType),
      side: armSideLabel(patient.armSide),
    }));
    selected = selected ?? patients[0]?.idPseudo;
    if (selected) rows = await getPatientBaselineVersions(selected);
  } catch {
    unavailable = true;
  }
  return <BaselineHistoryPage rows={rows} patients={patients} selectedPatient={selected} unavailable={unavailable} />;
}
