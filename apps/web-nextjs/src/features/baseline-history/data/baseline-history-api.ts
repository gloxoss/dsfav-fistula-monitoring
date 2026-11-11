import "server-only";
import { cookies } from "next/headers";
import type { components } from "@dsfav/shared-types";
import { SESSION_COOKIE_NAME } from "@/libs/auth/session";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { fetchJson } from "@/libs/http/fetcher";

export type BaselineVersion = components["schemas"]["BaselineVersionSummary"];

export async function getPatientBaselineVersions(idPseudo: string): Promise<BaselineVersion[]> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return fetchJson<BaselineVersion[]>(`${getApiBaseUrl()}/patients/${encodeURIComponent(idPseudo)}/baseline-versions`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
