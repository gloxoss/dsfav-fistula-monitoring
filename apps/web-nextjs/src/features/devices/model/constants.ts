import type { ApiConfig, DeviceThresholds } from "./types";

function readNumber(values: Record<string, unknown>, key: string): number | null {
  const value = values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function resolveDeviceThresholds(config: ApiConfig | null): DeviceThresholds | null {
  if (!config) return null;
  const values = config.values as unknown as Record<string, unknown>;
  const batteryWarnPct = readNumber(values, "batteryWarnPct");
  const batteryBlockPct = readNumber(values, "batteryBlockPct");
  const gainTolerancePct = readNumber(values, "gainTolerancePct");
  if (batteryWarnPct === null || batteryBlockPct === null || gainTolerancePct === null) {
    return null;
  }
  return { batteryWarnPct, batteryBlockPct, gainTolerancePct };
}
