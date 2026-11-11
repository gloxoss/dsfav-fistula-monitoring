"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { fetchJson } from "@/libs/http/fetcher";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { SESSION_COOKIE_NAME } from "@/libs/auth/session";
import type { AddNoteInput, FollowUpInput, RebaselineInput } from "@/features/patients/model/types";

async function authorizedInit(method: string, body: unknown): Promise<RequestInit> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  return {
    method,
    cache: "no-store",
    headers,
    body: JSON.stringify(body),
  };
}

export async function recordFollowUpIntentAction(input: FollowUpInput): Promise<void> {
  await fetchJson(
    `${getApiBaseUrl()}/patients/${encodeURIComponent(input.idPseudo)}/follow-up-intents`,
    await authorizedInit("POST", {
      measurementId: input.measurementId,
      reason: input.reason ?? null,
    }),
  );
  revalidatePath(`/patients/${input.idPseudo}`);
}

export async function addPatientNoteAction(input: AddNoteInput): Promise<void> {
  await fetchJson(
    `${getApiBaseUrl()}/patients/${encodeURIComponent(input.idPseudo)}/notes`,
    await authorizedInit("POST", {
      text: input.text,
      measurementId: input.measurementId ?? null,
    }),
  );
  revalidatePath(`/patients/${input.idPseudo}`);
  revalidatePath("/notes");
}

export async function rebaselinePatientAction(input: RebaselineInput): Promise<void> {
  await fetchJson(
    `${getApiBaseUrl()}/patients/${encodeURIComponent(input.idPseudo)}/rebaseline`,
    await authorizedInit("POST", { reason: input.reason }),
  );
  revalidatePath(`/patients/${input.idPseudo}`);
}
