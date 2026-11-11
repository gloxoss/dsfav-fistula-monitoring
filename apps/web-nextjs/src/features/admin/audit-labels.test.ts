import { describe, expect, it } from "vitest";
import { actionInfo, describeDetails, entityLabel, roleLabel } from "./audit-labels";
import { formatDateTime } from "@/libs/format/datetime";

describe("audit labels [UC13] [PSEUDO-SCAN]", () => {
  it("[UC13] translates known actions to French with a category, and keeps unknown codes readable", () => {
    expect(actionInfo("CLINICAL_NOTE_CREATED")).toEqual({ label: "Note clinique ajoutée", category: "notes" });
    expect(actionInfo("DEVICE_CALIBRATED")).toMatchObject({ label: "Appareil étalonné", category: "devices" });
    expect(actionInfo("REBASELINE")).toMatchObject({ category: "references" });
    expect(actionInfo("SOMETHING_NEW")).toEqual({ label: "SOMETHING_NEW", category: "other" });
  });

  it("[UC13] translates roles and entities", () => {
    expect(roleLabel("NEPHROLOGIST")).toBe("Néphrologue");
    expect(roleLabel("ADMIN")).toBe("Administrateur");
    expect(roleLabel("WEIRD")).toBe("WEIRD");
    expect(entityLabel("PatientPseudo")).toBe("Patient");
    expect(entityLabel("Device")).toBe("Appareil");
  });

  it("[PSEUDO-SCAN] details are shown as readable label and value pairs", () => {
    expect(describeDetails({ calibrationGain: 1.002, reason: "Étalonnage annuel" })).toEqual([
      { label: "Gain", value: "1,002" },
      { label: "Motif", value: "Étalonnage annuel" },
    ]);
    expect(describeDetails({ baselineLocked: false })).toEqual([{ label: "Référence verrouillée", value: "non" }]);
    expect(describeDetails(null)).toEqual([]);
  });

  it("formats a date and time with the year, in the local zone", () => {
    expect(formatDateTime("2026-11-10T11:23:55.301Z")).toMatch(/^10\/11\/2026 \d{2}:\d{2}$/);
    expect(formatDateTime("nope")).toBeNull();
    expect(formatDateTime(null)).toBeNull();
  });
});
