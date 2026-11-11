import "server-only";
import { cookies } from "next/headers";
import type { components } from "@dsfav/shared-types";
import { SESSION_COOKIE_NAME } from "@/libs/auth/session";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { fetchJson } from "@/libs/http/fetcher";
import type { BenchHistoryRow } from "../bench-history-page";

type BenchSession = components["schemas"]["BenchSessionSummary"];

export async function getBenchHistory(): Promise<BenchHistoryRow[]> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const sessions = await fetchJson<BenchSession[]>(`${getApiBaseUrl()}/bench/sessions`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return sessions.map((session) => ({
    sessionId: session.id,
    createdAt: session.createdAt,
    revealed: session.concordanceScore !== null && session.concordanceScore !== undefined,
    concordance: session.concordanceScore === null || session.concordanceScore === undefined ? null : `${session.concordanceScore}%`,
  }));
}
