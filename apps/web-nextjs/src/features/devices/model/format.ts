import type { DeviceThresholds } from "./types";

export type ThresholdTone = "critical" | "warning" | "neutral";

export interface BatteryStatus {
  label: string;
  tone: ThresholdTone;
}

export interface GainStatus {
  text: string;
  tone: ThresholdTone;
}

export function formatDecimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

export function formatPercent(value: number, digits = 0): string {
  return `${formatDecimal(value, digits)} %`;
}

export function formatSignedPercent(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatDecimal(Math.abs(value), digits)} %`;
}

export function formatLastSeen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}`;
}

export function isGainOutOfTolerance(gain: number, tolerancePct: number): boolean {
  const deviationPct = (gain - 1) * 100;
  return Math.abs(deviationPct) > tolerancePct + 1e-9;
}

export function batteryStatus(
  batteryPct: number,
  thresholds: DeviceThresholds,
): BatteryStatus {
  if (batteryPct <= thresholds.batteryBlockPct) {
    return {
      label: `bloquée sous ${formatPercent(thresholds.batteryBlockPct)}`,
      tone: "critical",
    };
  }
  if (batteryPct <= thresholds.batteryWarnPct) {
    return {
      label: `faible sous ${formatPercent(thresholds.batteryWarnPct)}`,
      tone: "warning",
    };
  }
  return { label: "autonomie suffisante", tone: "neutral" };
}

export function gainStatus(gain: number, thresholds: DeviceThresholds): GainStatus {
  const deviationPct = (gain - 1) * 100;
  const tolerance = formatPercent(thresholds.gainTolerancePct);
  const within = !isGainOutOfTolerance(gain, thresholds.gainTolerancePct);
  return {
    text: `${formatSignedPercent(deviationPct)} ${
      within ? `dans la tolérance ${tolerance}` : `hors tolérance ${tolerance}`
    }`,
    tone: within ? "neutral" : "warning",
  };
}

export function toneTextClass(tone: ThresholdTone): string {
  if (tone === "critical") return "text-critical-text";
  if (tone === "warning") return "text-warning-text";
  return "text-text-secondary";
}

export function toneBarClass(tone: ThresholdTone): string {
  if (tone === "critical") return "bg-critical";
  if (tone === "warning") return "bg-warning";
  return "bg-primary";
}

export function formatDeviceName(deviceId: string | null | undefined): string {
  if (!deviceId) return "—";
  if (deviceId === "dev-01-001") return "DSFAV-UNIT-01";
  if (deviceId === "dev-01-002") return "DSFAV-UNIT-02";
  if (deviceId.startsWith("DSFAV-")) return deviceId;
  const match = deviceId.match(/dev-(\d+)-(\d+)/i);
  if (match && match[2]) {
    return `DSFAV-UNIT-${match[2].padStart(2, "0")}`;
  }
  const simpleMatch = deviceId.match(/dev-?0?(\d+)/i);
  if (simpleMatch && simpleMatch[1]) {
    return `DSFAV-UNIT-${simpleMatch[1].padStart(2, "0")}`;
  }
  return `Appareil ${deviceId.slice(0, 8)}`;
}
