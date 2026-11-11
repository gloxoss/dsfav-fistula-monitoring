import { describe, expect, it } from "vitest";
import { toDeviceInfo, toPatientSummary } from "./capture-sources";

const NOW = new Date("2026-11-10T09:00:00.000Z");

describe("capture sources [UC1] [UC5]", () => {
  it("maps an API patient to the picker model with the baseline state", () => {
    const building = toPatientSummary({
      id: "p1", idPseudo: "PT-CAS-4471", fistulaType: "BRACHIO_CEPHALIC", armSide: "RIGHT",
      baselineLocked: false, lastStatus: "BASELINE_BUILDING", lastMeasurementAt: "2026-11-10T08:50:00.000Z",
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    expect(building).toMatchObject({
      idPseudo: "PT-CAS-4471", fistulaType: "brachio-céphalique", side: "droite", baselineStatus: "BUILDING",
    });
    const locked = toPatientSummary({
      id: "p2", idPseudo: "PT-CAS-8841", fistulaType: "RADIO_CEPHALIC", armSide: "LEFT",
      baselineLocked: true, createdAt: "2026-10-01T00:00:00.000Z",
    });
    expect(locked).toMatchObject({ fistulaType: "radio-céphalique", side: "gauche", baselineStatus: "ACTIVE" });
  });

  it("marks a device connected only when it was seen in the last 2 minutes", () => {
    const base = {
      id: "dev-1", serialNumber: "DSFAV-UNIT-01", macAddress: "AA:BB:CC:DD:EE:01", calibrationGain: 1,
      lastBatteryPct: 82, lastSyncAt: null, failedCount: 0,
      continuity: { uniquePatients: 1 },
    };
    const fresh = toDeviceInfo({ ...base, lastSeenAt: "2026-11-10T08:59:00.000Z" } as never, NOW);
    const stale = toDeviceInfo({ ...base, lastSeenAt: "2026-11-10T07:00:00.000Z" } as never, NOW);
    expect(fresh.connected).toBe(true);
    expect(stale.connected).toBe(false);
    expect(stale).toMatchObject({ id: "dev-1", name: "DSFAV-UNIT-01", batteryPct: 82, lastSeenAt: "2026-11-10T07:00:00.000Z" });
  });
});
