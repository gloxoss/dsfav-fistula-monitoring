import type { ApiDeviceSummary } from "@/features/devices/model/types";
import type { ApiPatientSummary } from "@/features/patients/model/types";
import type { DeviceInfo, FistulaType, PatientSummary } from "../model/types";

/** A device seen within this window counts as connected; there is no live presence flag in the API. */
const CONNECTED_WINDOW_MS = 2 * 60 * 1000;
/** Rough number of 25 s measures per battery percent, for the "environ N mesures" hint only. */
const MEASURES_PER_BATTERY_PCT = 1.2;

const FISTULA_LABELS: Record<string, FistulaType> = {
  RADIO_CEPHALIC: "radio-céphalique",
  BRACHIO_CEPHALIC: "brachio-céphalique",
  BRACHIO_BASILIC: "brachio-basilique",
};

export function toPatientSummary(patient: ApiPatientSummary): PatientSummary {
  return {
    idPseudo: patient.idPseudo,
    fistulaType: FISTULA_LABELS[patient.fistulaType] ?? "radio-céphalique",
    side: patient.armSide === "RIGHT" ? "droite" : "gauche",
    sessionsCount: 0,
    baselineStatus: patient.baselineLocked ? "ACTIVE" : "BUILDING",
    lastMeasurementDate: patient.lastMeasurementAt ?? undefined,
  };
}

export function toDeviceInfo(device: ApiDeviceSummary, now: Date = new Date()): DeviceInfo {
  const lastSeen = new Date(device.lastSeenAt).getTime();
  const connected = Number.isFinite(lastSeen) && now.getTime() - lastSeen <= CONNECTED_WINDOW_MS;
  return {
    id: device.id,
    name: device.serialNumber,
    batteryPct: device.lastBatteryPct,
    connected,
    syncState: device.failedCount > 0 ? "FAILED" : device.lastSyncAt ? "SYNCED" : "QUEUED_OFFLINE",
    macTail: device.macAddress.slice(-5),
    firmwareVersion: "",
    estimatedMeasuresLeft: Math.round(device.lastBatteryPct * MEASURES_PER_BATTERY_PCT),
    lastSeenAt: device.lastSeenAt,
  };
}
