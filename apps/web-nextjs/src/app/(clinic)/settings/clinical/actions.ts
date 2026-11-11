"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { components } from "@dsfav/shared-types";
import { fetchJson } from "@/libs/http/fetcher";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { SESSION_COOKIE_NAME } from "@/libs/auth/session";

type ApiConfig = components["schemas"]["ConfigVersionResponse"];

async function authorizedInit(method: string, body?: unknown): Promise<RequestInit> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return { method, cache: "no-store", headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}

export async function proposeClinicalThresholdAction(input: {
  threshold: number;
  confidenceNote: string;
}): Promise<{ id: string }> {
  const result = await fetchJson<ApiConfig>(`${getApiBaseUrl()}/config/threshold-proposals`, await authorizedInit("POST", input));
  revalidatePath("/settings/clinical");
  return { id: result.id };
}

export async function approveClinicalThresholdAction(proposalId: string): Promise<void> {
  await fetchJson<ApiConfig>(
    `${getApiBaseUrl()}/config/threshold-proposals/${encodeURIComponent(proposalId)}/approve`,
    await authorizedInit("POST"),
  );
  revalidatePath("/settings/clinical");
}
