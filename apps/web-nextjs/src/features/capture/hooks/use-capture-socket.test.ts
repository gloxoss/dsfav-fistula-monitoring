import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { CAPTURE_SESSION_EXPIRED_ERROR, useCaptureSocket } from "./use-capture-socket";
import type { CaptureResult } from "../model/types";
import { readCaptureSession, saveCaptureSession } from "../lib/session-resume";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  close() {
    this.readyState = 3;
  }
  send(data: string) {
    this.sent.push(data);
  }
}

function openLastSocket(): FakeWebSocket {
  const ws = FakeWebSocket.instances.at(-1);
  expect(ws).toBeDefined();
  if (!ws) throw new Error("no socket");
  ws.readyState = 1;
  ws.onopen?.();
  return ws;
}

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function jsonResponse(data: unknown, status = 201) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const apiResult: CaptureResult = {
  status: "UNUSUAL_EVOLUTION",
  idPseudo: "PT-CAS-8841",
  cleanDurationSec: 22.9,
  artifactPct: 8.2,
  meanPressureKpa: 4.6,
  rmsG: 0.089,
  peakFreqHz: 184,
  attemptsCount: 1,
};

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useCaptureSocket hook", () => {
  it("initializes with default values and allows pressure update", () => {
    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 4.8, useFixture: true }),
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.pressureKpa).toBe(4.8);
    expect(result.current.elapsedSec).toBe(0);
    expect(result.current.frames).toEqual([]);

    act(() => {
      result.current.setSimulatedPressure(2.2);
    });
    expect(result.current.pressureKpa).toBe(2.2);
  });

  it("[UC2] refuses to start capture when pressure is < 2.5 kPa or > 9.0 kPa", () => {
    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 2.1, useFixture: true }),
    );

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    act(() => {
      result.current.startCapture();
    });
    // Should remain idle
    expect(result.current.status).toBe("idle");

    act(() => {
      result.current.setSimulatedPressure(9.5);
    });
    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    act(() => {
      result.current.startCapture();
    });
    expect(result.current.status).toBe("idle");

    // Inside recommended range
    act(() => {
      result.current.setSimulatedPressure(4.5);
    });
    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    act(() => {
      result.current.startCapture();
    });
    expect(result.current.status).toBe("capturing");
  });

  it("handles retry and increments attempts count", () => {
    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 4.8, useFixture: true }),
    );

    expect(result.current.attemptsCount).toBe(1);

    act(() => {
      result.current.retryCapture();
    });
    expect(result.current.attemptsCount).toBe(2);
    expect(result.current.status).toBe("idle");
  });
});

describe("useCaptureSocket rework 2 (stable pressure gate, live capture lifecycle)", () => {
  it("[UC2] start stays blocked until a valid pressure has lasted 1.0 s continuously", () => {
    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 4.8, useFixture: true }),
    );

    act(() => {
      result.current.startCapture();
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.isPressureStable).toBe(false);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      result.current.startCapture();
    });
    expect(result.current.status).toBe("idle");

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.isPressureStable).toBe(true);
    act(() => {
      result.current.startCapture();
    });
    expect(result.current.status).toBe("capturing");
  });

  it("[UC2] the stability timer resets whenever the pressure leaves the valid window", () => {
    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 4.8, useFixture: true }),
    );

    act(() => {
      vi.advanceTimersByTime(700);
    });
    act(() => {
      result.current.setSimulatedPressure(2.0);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.stablePressureSec).toBe(0);

    act(() => {
      result.current.setSimulatedPressure(4.8);
    });
    act(() => {
      result.current.startCapture();
    });
    expect(result.current.status).toBe("idle");

    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => {
      result.current.startCapture();
    });
    expect(result.current.status).toBe("idle");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      result.current.startCapture();
    });
    expect(result.current.status).toBe("capturing");
  });

  it("[UC1] live capture sends captureStart and captureDone on the capture socket", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 4.8, measurementId: "mes-0042" }),
    );
    const ws = openLastSocket();
    expect(ws.url).toBe("ws://localhost:3001/ws/capture/mes-0042");

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    act(() => {
      result.current.startCapture();
    });
    expect(result.current.status).toBe("capturing");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: "captureStart",
      measurementId: "mes-0042",
    });

    act(() => {
      vi.advanceTimersByTime(25_100);
    });
    expect(result.current.status).toBe("analyzing");
    expect(ws.sent).toHaveLength(2);
    expect(JSON.parse(ws.sent[1])).toEqual({
      type: "captureDone",
      measurementId: "mes-0042",
    });
  });

  it("[UC1] stopping a live capture early sends captureDone", () => {
    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 4.8, measurementId: "mes-0043" }),
    );
    const ws = openLastSocket();

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    act(() => {
      result.current.startCapture();
    });
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    act(() => {
      result.current.stopCapture();
    });

    expect(result.current.status).toBe("idle");
    const done = ws.sent.map((m) => JSON.parse(m)).filter((m) => m.type === "captureDone");
    expect(done).toEqual([{ type: "captureDone", measurementId: "mes-0043" }]);
  });
});

describe("useCaptureSocket rework 1 (demo mode, config thresholds, API-only results)", () => {
  it("[UC2] refuses to start when the pressure gate uses configured thresholds, not hard-coded 2.5/9.0", () => {
    const { result } = renderHook(() =>
      useCaptureSocket({
        initialPressure: 2.8,
        pressureThresholds: { pressureMinKpa: 3.0 },
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    act(() => {
      result.current.startCapture();
    });
    expect(result.current.status).toBe("idle");
  });

  it("[UC2] live mode never synthesizes a result: waiting for the API, then shows the API result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ measurementId: "mes-1000", state: "INIT" })),
    );
    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 4.8, idPseudo: "PT-CAS-8841", deviceId: DEVICE_ID }),
    );

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    act(() => {
      result.current.startCapture();
    });
    await flushAsyncWork();
    expect(result.current.status).toBe("capturing");
    expect(result.current.result).toBeNull();

    const ws = openLastSocket();
    act(() => {
      vi.advanceTimersByTime(25_100);
    });
    expect(result.current.status).toBe("analyzing");
    expect(result.current.result).toBeNull();

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: "RESULT", result: apiResult }) });
    });
    expect(result.current.status).toBe("completed");
    expect(result.current.result?.status).toBe("UNUSUAL_EVOLUTION");
    expect(result.current.result?.demo).toBeFalsy();
  });

  it("[UC2] demo mode is explicit: fixture playback only with useFixture, synthetic result labelled demo", () => {
    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 4.8, useFixture: true }),
    );

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    act(() => {
      result.current.startCapture();
    });
    act(() => {
      vi.advanceTimersByTime(25_100);
    });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.status).toBe("completed");
    expect(result.current.result?.demo).toBe(true);
  });
});

describe("useCaptureSocket rework 3 (measurement creation, live data honesty)", () => {
  it("[NO-LOSS] resumes the stored measurementId after reload without creating another measurement", async () => {
    saveCaptureSession({
      measurementId: "mes-resume-01",
      idPseudo: "PT-CAS-8841",
      deviceId: DEVICE_ID,
      startedAt: "2026-11-08T12:00:00.000Z",
      lastState: "capturing",
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "mes-resume-01", state: "CAPTURING" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCaptureSocket({
      initialPressure: 4.8,
      idPseudo: "PT-CAS-8841",
      deviceId: DEVICE_ID,
      apiUrl: "http://localhost:3101",
    }));
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3101/measurements/mes-resume-01", expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/json" }) }));
    expect(result.current.status).toBe("capturing");
    expect(FakeWebSocket.instances.at(-1)?.url).toBe("ws://localhost:3001/ws/capture/mes-resume-01");
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/measurements"))).toHaveLength(0);
  });

  it("[NO-LOSS] keeps the measurementId and asks for re-login when resume lookup returns 401", async () => {
    saveCaptureSession({
      measurementId: "mes-expired-01",
      idPseudo: "PT-CAS-8841",
      deviceId: DEVICE_ID,
      startedAt: "2026-11-08T12:00:00.000Z",
      lastState: "capturing",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    const { result } = renderHook(() => useCaptureSocket({ apiUrl: "http://localhost:3101" }));
    await flushAsyncWork();

    expect(result.current.startError).toBe(CAPTURE_SESSION_EXPIRED_ERROR);
    expect(readCaptureSession()?.measurementId).toBe("mes-expired-01");
    expect(result.current.resumeMeasurementId).toBe("mes-expired-01");
  });

  it("[NO-LOSS] keeps the measurement when the capture socket reports an expired session", async () => {
    saveCaptureSession({
      measurementId: "mes-socket-expired",
      idPseudo: "PT-CAS-8841",
      deviceId: DEVICE_ID,
      startedAt: "2026-11-08T12:00:00.000Z",
      lastState: "capturing",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ measurementId: "mes-socket-expired" })));
    const { result } = renderHook(() => useCaptureSocket({ apiUrl: "http://localhost:3101" }));
    await flushAsyncWork();
    const ws = openLastSocket();

    act(() => ws.onmessage?.({ data: JSON.stringify({ type: "error", code: "UNAUTHORIZED" }) }));

    expect(result.current.startError).toBe(CAPTURE_SESSION_EXPIRED_ERROR);
    expect(readCaptureSession()?.measurementId).toBe("mes-socket-expired");
  });

  it("[UC1] live start creates the measurement through POST /measurements before captureStart", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ measurementId: "mes-7777", state: "INIT" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCaptureSocket({
        initialPressure: 4.8,
        idPseudo: "PT-CAS-8841",
        deviceId: DEVICE_ID,
        apiUrl: "http://localhost:3001",
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    act(() => {
      result.current.startCapture();
    });
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("http://localhost:3001/measurements");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      idPseudo: "PT-CAS-8841",
      deviceId: DEVICE_ID,
    });
    expect(result.current.status).toBe("capturing");
    expect(result.current.startError).toBeNull();
    expect(readCaptureSession()?.measurementId).toBe("mes-7777");

    const ws = openLastSocket();
    expect(ws.url).toBe("ws://localhost:3001/ws/capture/mes-7777");
    expect(ws.sent.map((m) => JSON.parse(m))).toEqual([
      { type: "captureStart", measurementId: "mes-7777" },
    ]);
  });

  it("[UC1] measurement creation failure keeps the pre-capture state, shows the French error and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(jsonResponse({ measurementId: "mes-8888", state: "INIT" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 4.8, idPseudo: "PT-CAS-8841", deviceId: DEVICE_ID }),
    );

    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    act(() => {
      result.current.startCapture();
    });
    await flushAsyncWork();

    expect(result.current.status).toBe("idle");
    expect(result.current.startError).toBe("Impossible de démarrer la mesure. Réessayez.");
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(result.current.result).toBeNull();

    act(() => {
      result.current.startCapture();
    });
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.startError).toBeNull();
    expect(result.current.status).toBe("capturing");
    const ws = openLastSocket();
    expect(ws.url).toBe("ws://localhost:3001/ws/capture/mes-8888");
    expect(ws.sent.map((m) => JSON.parse(m))).toEqual([
      { type: "captureStart", measurementId: "mes-8888" },
    ]);
  });

  it("[UC1] live mode exposes no sample RMS, frequency or artifact band before real data", () => {
    const { result } = renderHook(() => useCaptureSocket({ initialPressure: 4.8 }));

    expect(result.current.metrics.rmsG).toBeNull();
    expect(result.current.metrics.peakFreqHz).toBeNull();
    expect(result.current.artifactIntervals).toEqual([]);
  });

  it("[UC1] demo sample values appear only in fixture mode and no artifact band exists before playback", () => {
    const { result } = renderHook(() =>
      useCaptureSocket({ initialPressure: 4.8, useFixture: true }),
    );

    expect(result.current.metrics.rmsG).toBe(0.142);
    expect(result.current.metrics.peakFreqHz).toBe(68);
    expect(result.current.artifactIntervals).toEqual([]);
  });
});
