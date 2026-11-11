import "server-only";
import { cookies } from "next/headers";
import type { components } from "@dsfav/shared-types";
import { SESSION_COOKIE_NAME } from "@/libs/auth/session";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { fetchJson } from "@/libs/http/fetcher";
import type { ClinicalNoteRow } from "../notes-page";

type ClinicalNote = components["schemas"]["ClinicalNote"];
type FollowUp = components["schemas"]["FollowUpSummary"];

export async function getPatientNotesAndFollowUps(idPseudo: string): Promise<ClinicalNoteRow[]> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const patientPath = `${getApiBaseUrl()}/patients/${encodeURIComponent(idPseudo)}`;
  const [notes, followUps] = await Promise.all([
    fetchJson<ClinicalNote[]>(`${patientPath}/notes`, { cache: "no-store", headers }),
    fetchJson<FollowUp[]>(`${patientPath}/follow-ups`, { cache: "no-store", headers }),
  ]);

  return [
    ...notes.map((note) => ({ idPseudo, kind: "NOTE" as const, createdAt: note.createdAt, text: note.text })),
    ...followUps.map((intent) => ({ idPseudo, kind: "FOLLOW_UP" as const, createdAt: intent.createdAt, text: intent.reason ?? undefined })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
