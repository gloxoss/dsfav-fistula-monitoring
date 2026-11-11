import Link from "next/link";
import { Disclaimer } from "@/components/shared/disclaimer";
import { AiOpinionCard } from "@/features/ai";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/shell/page-title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { countConsecutiveAbove, latestValidSession } from "../model/adapters";
import { armSideLabel, fistulaLabel } from "../model/format";
import type {
  AddNoteAction,
  FollowUpAction,
  PatientDetailView,
  RebaselineAction,
} from "../model/types";
import { DeviationCard } from "./deviation-card";
import { FistulaMap } from "./fistula-map";
import { MetricsGrid } from "./metrics-grid";
import { NotesCard, type NoteView } from "./notes-card";
import { RebaselineModal } from "./rebaseline-modal";
import { ReviewStatusPill } from "./review-status-pill";
import { RmsHistoryChart } from "./rms-history-chart";
import { SessionsCard } from "./sessions-card";
import { SynthesisCard } from "./synthesis-card";
import { Spectrogram } from "@/components/charts/spectrogram";

export interface PatientDetailProps {
  patient: PatientDetailView;
  thresholdSigma?: number;
  isNephrologist?: boolean;
  notes?: NoteView[];
  onRecordFollowUp?: FollowUpAction;
  onAddNote?: AddNoteAction;
  onRebaseline?: RebaselineAction;
}

export function PatientDetail({
  patient,
  thresholdSigma,
  isNephrologist = false,
  notes,
  onRecordFollowUp,
  onAddNote,
  onRebaseline,
}: PatientDetailProps) {
  const sessionCount = patient.sessions.length;
  const latest = sessionCount > 0 ? patient.sessions[sessionCount - 1]! : null;
  const exploitable = latestValidSession(patient.sessions);
  const consecutiveAbove =
    thresholdSigma === undefined ? 0 : countConsecutiveAbove(patient.sessions, thresholdSigma);

  const subtitle = `${patient.idPseudo} · ${fistulaLabel(patient.fistulaType)} ${armSideLabel(patient.armSide)} · ${sessionCount} séances`;

  const notesCard = (
    <NotesCard
      idPseudo={patient.idPseudo}
      canAddNote={isNephrologist}
      initialNotes={notes}
      onAddNote={onAddNote}
    />
  );

  return (
    <div className="space-y-6">
      <PageTitle
        first="Suivi"
        rest="de la FAV"
        subtitle={subtitle}
        actions={
          <>
            {latest ? <ReviewStatusPill status={latest.status} /> : null}
            {isNephrologist && onRebaseline ? (
              <RebaselineModal idPseudo={patient.idPseudo} onRebaseline={onRebaseline} />
            ) : null}
          </>
        }
      />

      {sessionCount === 0 ? (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">Aucun historique</h2>
          <p className="text-sm text-text-secondary">
            Réalisez une première mesure pour démarrer la référence de ce patient.
          </p>
          <Link href="/capture" className="text-sm font-medium text-primary underline underline-offset-4">
            Aller à l’acquisition
          </Link>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <FistulaMap
          fistulaType={patient.fistulaType}
          armSide={patient.armSide}
          baseline={patient.baselineFeatures}
          latest={exploitable}
          className="xl:col-span-7"
        />
        <div className="grid grid-cols-1 content-start gap-4 xl:col-span-5">
          <DeviationCard
            status={patient.latestStatus}
            deviationScore={latest?.deviationScore ?? null}
            thresholdSigma={thresholdSigma}
            consecutiveAbove={consecutiveAbove}
            baselineLocked={patient.baselineLocked}
            baselineStep={patient.baselineStep}
          />
          <SynthesisCard
            idPseudo={patient.idPseudo}
            baseline={patient.baselineFeatures}
            latest={exploitable}
            canFollowUp={isNephrologist}
            onRecordIntent={onRecordFollowUp}
          />
        </div>
      </div>

      {sessionCount > 0 ? (
        <Tabs defaultValue="trend" className="space-y-4">
          <TabsList aria-label="Détails du suivi" className="max-w-full overflow-x-auto">
            <TabsTrigger value="trend">Tendance</TabsTrigger>
            <TabsTrigger value="spectrogram">Spectrogramme</TabsTrigger>
            <TabsTrigger value="sessions">{`Séances (${sessionCount})`}</TabsTrigger>
            <TabsTrigger value="notes">{`Notes (${notes?.length ?? 0})`}</TabsTrigger>
          </TabsList>

          {/* All panels stay mounted (hidden when inactive) so charts keep their state and size. */}
          <TabsContent value="trend" forceMount className="data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
              <RmsHistoryChart
                sessions={patient.sessions}
                baseline={patient.baselineFeatures}
                className="min-w-0 lg:col-span-7"
              />
              <MetricsGrid
                session={exploitable}
                sessions={patient.sessions}
                baseline={patient.baselineFeatures}
                className="min-w-0 lg:col-span-5"
              />
            </div>
          </TabsContent>

          <TabsContent value="spectrogram" forceMount className="data-[state=inactive]:hidden">
            {exploitable ? (
              <Card className="space-y-3">
                <Spectrogram
                  matrix={exploitable.stftPreview}
                  dominantFreqHz={exploitable.peakFreqHz}
                  height={240}
                  title="Spectrogramme de la dernière séance valide (temps / fréquence)"
                />
              </Card>
            ) : (
              <Card>
                <p className="text-sm text-text-secondary">Aucune séance valide à analyser pour le moment.</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sessions" forceMount className="data-[state=inactive]:hidden">
            <SessionsCard sessions={patient.sessions} />
          </TabsContent>

          <TabsContent value="notes" forceMount className="data-[state=inactive]:hidden">
            {notesCard}
          </TabsContent>
        </Tabs>
      ) : (
        notesCard
      )}

      {latest ? (
        <AiOpinionCard
          aiOpinion={latest.aiOpinion}
          baselineBuilding={latest.status === "BASELINE_BUILDING"}
          showDisclaimer={false}
        />
      ) : null}

      <div className="pt-2">
        <Disclaimer />
      </div>
    </div>
  );
}
