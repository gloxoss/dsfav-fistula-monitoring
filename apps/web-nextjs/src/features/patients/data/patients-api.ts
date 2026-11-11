import "server-only";
import { cookies } from "next/headers";
import { fetchJson } from "@/libs/http/fetcher";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { SESSION_COOKIE_NAME, verifySessionToken, type UserRole } from "@/libs/auth/session";
import type {
  ApiClinicalNote,
  ApiConfig,
  ApiPatientHistory,
  ApiPatientSummary,
  PatientNote,
} from "../model/types";

async function authHeaders(): Promise<HeadersInit> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getSessionRole(): Promise<UserRole | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token)?.role ?? null;
}

export async function getPatients(): Promise<ApiPatientSummary[]> {
  const headers = await authHeaders();
  return fetchJson<ApiPatientSummary[]>(`${getApiBaseUrl()}/patients`, {
    cache: "no-store",
    headers,
  });
}

export async function getPatientHistory(idPseudo: string): Promise<ApiPatientHistory> {
  const headers = await authHeaders();
  return fetchJson<ApiPatientHistory>(
    `${getApiBaseUrl()}/patients/${encodeURIComponent(idPseudo)}/history`,
    { cache: "no-store", headers },
  );
}

export async function getPatientNotes(idPseudo: string): Promise<PatientNote[]> {
  try {
    const headers = await authHeaders();
    const notes = await fetchJson<ApiClinicalNote[]>(
      `${getApiBaseUrl()}/patients/${encodeURIComponent(idPseudo)}/notes`,
      { cache: "no-store", headers },
    );
    return notes.map((note) => ({
      id: note.id,
      text: note.text,
      createdAt: note.createdAt,
    }));
  } catch {
    return [];
  }
}

export async function getActiveClinicalConfig(): Promise<ApiConfig | null> {
  try {
    const headers = await authHeaders();
    return await fetchJson<ApiConfig>(`${getApiBaseUrl()}/config/active`, {
      cache: "no-store",
      headers,
    });
  } catch {
    return null;
  }
}
