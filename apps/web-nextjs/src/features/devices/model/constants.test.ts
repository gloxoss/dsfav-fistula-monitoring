import { describe, expect, it } from "vitest";
import { resolveDeviceThresholds } from "./constants";
import type { ApiConfig } from "./types";

function config(values: Record<string, unknown>): ApiConfig {
  return { values } as unknown as ApiConfig;
}

describe("resolveDeviceThresholds", () => {
  it("[UC13] returns null when no active configuration is available", () => {
    expect(resolveDeviceThresholds(null)).toBeNull();
  });

  it("[UC13] returns null when the active configuration has no device threshold keys", () => {
    expect(
      resolveDeviceThresholds(
        config({
          thresholdSigma: 3.4,
          consecutiveAlerts: 2,
          pressureMinKpa: 2.5,
          pressureLowKpa: 3,
          pressureHighKpa: 8.5,
          pressureMaxKpa: 9,
          motionThresholdG: 0.08,
          cleanTimeMinSec: 12,
          stdFloorPct: 5,
        }),
      ),
    ).toBeNull();
  });

  it("[UC13] returns null when one device threshold key is missing", () => {
    expect(
      resolveDeviceThresholds(config({ batteryWarnPct: 20, batteryBlockPct: 15 })),
    ).toBeNull();
  });

  it("[UC13] reads every device threshold from the active configuration", () => {
    expect(
      resolveDeviceThresholds(
        config({ batteryWarnPct: 22, batteryBlockPct: 16, gainTolerancePct: 4 }),
      ),
    ).toEqual({ batteryWarnPct: 22, batteryBlockPct: 16, gainTolerancePct: 4 });
  });
});
