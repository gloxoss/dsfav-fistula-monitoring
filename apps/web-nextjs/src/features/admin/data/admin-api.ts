import "server-only";
import { cookies } from "next/headers";
import type { components, paths } from "@dsfav/shared-types";
import { SESSION_COOKIE_NAME } from "@/libs/auth/session";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { fetchJson } from "@/libs/http/fetcher";

export type AuditRow = components["schemas"]["AuditEventSummary"];
export type UserRow = components["schemas"]["AdminUserSummary"];
export type AuditFilters = NonNullable<paths["/audit"]["get"]["parameters"]["query"]>;
export type AuditPage = components["schemas"]["AuditEventPage"];

async function authHeaders(): Promise<HeadersInit> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getAuditEvents(filters: AuditFilters = {}): Promise<AuditPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  const res = await fetchJson<AuditPage | AuditRow[]>(`${getApiBaseUrl()}/audit${suffix}`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
  if (Array.isArray(res)) {
    return { items: res, nextCursor: null };
  }
  return res;
}

export async function getUsers(): Promise<UserRow[]> {
  return fetchJson<UserRow[]>(`${getApiBaseUrl()}/users`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
}
