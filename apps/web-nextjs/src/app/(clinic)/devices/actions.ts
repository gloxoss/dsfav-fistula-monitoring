"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getApiBaseUrl } from "@/libs/http/backend-proxy";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/libs/auth/session";
import type { CalibrationState } from "@/features/devices/model/types";

export async function calibrateDeviceAction(
  _previous: CalibrationState,
  formData: FormData,
): Promise<CalibrationState> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (session?.role !== "ADMIN") {
    return { error: "Réservé à l’administration.", ok: false };
  }

  const deviceId = String(formData.get("deviceId") ?? "").trim();
  const calibrationGain = Number(String(formData.get("calibrationGain") ?? "").replace(",", "."));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!deviceId || !Number.isFinite(calibrationGain) || calibrationGain <= 0 || !reason) {
    return { error: "Renseignez un gain mesuré au banc et un motif.", ok: false };
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/devices/${encodeURIComponent(deviceId)}/calibration`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ calibrationGain, reason }),
      },
    );

    if (!response.ok) {
      return { error: "La calibration n’a pas pu être enregistrée.", ok: false };
    }

    revalidatePath("/devices");
    return { error: null, ok: true };
  } catch {
    return { error: "Impossible de joindre le serveur de la clinique.", ok: false };
  }
}
