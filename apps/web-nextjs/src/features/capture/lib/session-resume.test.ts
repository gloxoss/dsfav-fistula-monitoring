import { afterEach, describe, expect, it } from "vitest";
import { clearCaptureSession, readCaptureSession, saveCaptureSession } from "./session-resume";

describe("capture session resume", () => {
  afterEach(() => sessionStorage.clear());

  it("[NO-LOSS] restores the same measurementId without creating another measurement", () => {
    const capture = {
      measurementId: "measurement-existing",
      idPseudo: "PT-CAS-8841",
      deviceId: "11111111-1111-4111-8111-111111111111",
      startedAt: "2026-11-08T12:00:00.000Z",
      lastState: "capturing" as const,
    };

    saveCaptureSession(capture);
    const restored = readCaptureSession();

    expect(restored).toEqual(capture);
    expect(restored?.measurementId).toBe(capture.measurementId);
    expect(sessionStorage.length).toBe(1);
    clearCaptureSession();
    expect(readCaptureSession()).toBeNull();
  });
});
