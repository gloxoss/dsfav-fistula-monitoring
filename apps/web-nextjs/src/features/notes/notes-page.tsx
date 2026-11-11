import { PageTitle } from "@/components/shell/page-title";
import { PatientNav } from "@/components/shared/patient-nav";
import { NotesComposer, type AddNoteForPatient } from "./notes-composer";
import { NotesTimeline } from "./notes-timeline";

export interface ClinicalNoteRow {
  idPseudo: string;
  kind: "NOTE" | "FOLLOW_UP";
  createdAt: string;
  text?: string;
}

export interface NotesPatientOption {
  idPseudo: string;
  fistula?: string;
  side?: string;
}

export function NotesPage({
  rows,
  patients,
  selectedPatient,
  unavailable = false,
  onAddNote,
}: {
  rows: ClinicalNoteRow[];
  /** Patient codes, or codes with their fistula for a richer list */
  patients: Array<string | NotesPatientOption>;
  selectedPatient?: string;
  unavailable?: boolean;
  /** Present only for roles allowed to write notes */
  onAddNote?: AddNoteForPatient;
}) {
  const options: NotesPatientOption[] = patients.map((patient) =>
    typeof patient === "string" ? { idPseudo: patient } : patient,
  );
  const currentPatient = selectedPatient || options[0]?.idPseudo;
  const current = options.find((option) => option.idPseudo === currentPatient);

  return (
    <section className="space-y-6">
      <PageTitle first="Notes et suivis" subtitle="Notes cliniques et intentions de suivi, patient par patient." />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <PatientNav options={options} current={currentPatient} basePath="/notes" />

        <div className="min-w-0 space-y-5">
          {currentPatient ? (
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-mono text-xl font-semibold text-text-primary">{currentPatient}</h2>
              {current?.fistula ? (
                <span className="text-sm text-text-secondary">
                  {current.fistula}
                  {current.side ? ` ${current.side}` : ""}
                </span>
              ) : null}
            </header>
          ) : null}

          {onAddNote && currentPatient && !unavailable ? (
            <NotesComposer key={`composer-${currentPatient}`} idPseudo={currentPatient} onAddNote={onAddNote} />
          ) : null}

          <NotesTimeline key={`timeline-${currentPatient}`} rows={rows} idPseudo={currentPatient} unavailable={unavailable} />

          <p className="text-xs text-text-secondary">
            Une intention de suivi ne crée pas de demande d’examen. Elle se documente depuis la fiche du patient, liée à une mesure.
          </p>
        </div>
      </div>
    </section>
  );
}
