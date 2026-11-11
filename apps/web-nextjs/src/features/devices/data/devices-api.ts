import "server-only";
import { cookies } from "next/headers";
import type { components } from "@dsfav/shared-types";
import { fetchJson } from "@/libs/http/fetcher";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { SESSION_COOKIE_NAME, verifySessionToken, type UserRole } from "@/libs/auth/session";
import type {
  ApiConfig,
  ApiDeviceSummary,
  CalibrationAuditDetails,
  CalibrationAuditEvent,
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

export async function getDevices(): Promise<ApiDeviceSummary[]> {
  const headers = await authHeaders();
  return fetchJson<ApiDeviceSummary[]>(`${getApiBaseUrl()}/devices`, {
    cache: "no-store",
    headers,
  });
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

function isCalibrationAuditDetails(value: unknown): value is CalibrationAuditDetails {
  if (typeof value !== "object" || value === null) return false;
  const details = value as Record<string, unknown>;
  return typeof details.calibrationGain === "number" && typeof details.reason === "string";
}

export async function getCalibrationHistory(
  devices: ApiDeviceSummary[],
): Promise<CalibrationAuditEvent[]> {
  const headers = await authHeaders();
  const rowsByDevice = await Promise.all(
    devices.map(async (device): Promise<components["schemas"]["AuditEventSummary"][]> => {
      const query = new URLSearchParams({
        action: "DEVICE_CALIBRATED",
        entity: "Device",
        entityId: device.id,
        limit: "10",
      });
      try {
        const res = await fetchJson<
          components["schemas"]["AuditEventPage"] | components["schemas"]["AuditEventSummary"][]
        >(`${getApiBaseUrl()}/audit?${query.toString()}`, { cache: "no-store", headers });
        return Array.isArray(res) ? res : res.items;
      } catch {
        return [];
      }
    }),
  );

  return rowsByDevice.flat().flatMap((row) => {
    if (!row.entityId || !isCalibrationAuditDetails(row.after)) return [];
    return [{ ...row, after: row.after }];
  });
}
