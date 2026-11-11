import "server-only";
import { cookies } from "next/headers";
import { fetchJson } from "@/libs/http/fetcher";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { SESSION_COOKIE_NAME } from "@/libs/auth/session";
import type { ApiQueueItem } from "../model/types";

export async function getQueue(): Promise<ApiQueueItem[]> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  return fetchJson<ApiQueueItem[]>(`${getApiBaseUrl()}/queue`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
