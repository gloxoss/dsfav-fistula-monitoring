import "server-only";
import { cookies } from "next/headers";
import type { components } from "@dsfav/shared-types";
import { fetchJson } from "@/libs/http/fetcher";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { SESSION_COOKIE_NAME, verifySessionToken, type UserRole } from "@/libs/auth/session";

type ApiConfig = components["schemas"]["ConfigVersionResponse"];

async function authHeaders(): Promise<HeadersInit> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getClinicalSettingsIdentity(): Promise<{ role: UserRole | null; userId: string | null }> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? verifySessionToken(token) : null;
  return { role: user?.role ?? null, userId: user?.id ?? null };
}

export function getClinicalThresholds(config: ApiConfig | null): Record<string, number> {
  const values: unknown = config?.values;
  if (typeof values !== "object" || values === null) return {};
  const record = values as Record<string, unknown>;
  const nested = record.thresholds;
  const nestedValues = typeof nested === "object" && nested !== null ? nested as Record<string, unknown> : {};
  const nestedThresholds = Object.entries(nestedValues).filter(([, value]) =>
    typeof value === "number" && Number.isFinite(value),
  );
  const topLevelThresholds = Object.entries(record).filter(([key, value]) =>
    key !== "thresholds" && /threshold|limit|pressure|motion|clean|battery/i.test(key) &&
    typeof value === "number" && Number.isFinite(value),
  );
  return Object.fromEntries([...nestedThresholds, ...topLevelThresholds]) as Record<string, number>;
}

export async function getActiveClinicalSettings(): Promise<ApiConfig | null> {
  const headers = await authHeaders();
  return fetchJson<ApiConfig>(`${getApiBaseUrl()}/config/active`, { cache: "no-store", headers }).catch(() => null);
}
