import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { NotesPage } from "@/features/notes/notes-page";
import { getPatientNotesAndFollowUps } from "@/features/notes/data/notes-api";
import { getPatients } from "@/features/patients/data/patients-api";
import type { ClinicalNoteRow, NotesPatientOption } from "@/features/notes/notes-page";
import { armSideLabel, fistulaLabel } from "@/features/patients/model/format";
import { addPatientNoteAction } from "../patients/[idPseudo]/actions";

export default function NotesRoute({ searchParams }: { searchParams: Promise<{ idPseudo?: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotesData searchParams={searchParams} />
    </Suspense>
  );
}

async function NotesData({ searchParams }: { searchParams: Promise<{ idPseudo?: string }> }) {
  await connection();
  const { idPseudo } = await searchParams;
  let patients: NotesPatientOption[] = [];
  let rows: ClinicalNoteRow[] = [];
  let unavailable = false;
  let selectedPatient = idPseudo;
  try {
    patients = (await getPatients()).map((patient) => ({
      idPseudo: patient.idPseudo,
      fistula: fistulaLabel(patient.fistulaType),
      side: armSideLabel(patient.armSide),
    }));
    if (!selectedPatient && patients.length > 0) {
      selectedPatient = patients[0]?.idPseudo;
    }
    if (selectedPatient) {
      rows = await getPatientNotesAndFollowUps(selectedPatient);
    }
  } catch {
    unavailable = true;
  }
  return (
    <NotesPage
      rows={rows}
      patients={patients}
      selectedPatient={selectedPatient}
      unavailable={unavailable}
      onAddNote={addPatientNoteAction}
    />
  );
}
