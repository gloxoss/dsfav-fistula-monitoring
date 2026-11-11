"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { operations } from "@dsfav/shared-types";
import {
  type ClinicalPressureThresholds,
  CANONICAL_PRESSURE_THRESHOLDS,
} from "@/components/ui/pressure-gauge";
import { clientEnv } from "@/libs/env/client";
import { fetchJson } from "@/libs/http/fetcher";
import {
  clearCaptureSession,
  readCaptureSession,
  saveCaptureSession,
  subscribeCaptureSession,
} from "../lib/session-resume";
import type {
  CaptureFrame,
  CaptureResult,
  CaptureStreamStatus,
  QualityMetrics,
} from "../model/types";
import { PRESSURE_STABLE_REQUIRED_SEC } from "../model/constants";
import recordedFixture from "../data/recorded-frames.json";
import { DEMO_STFT_PREVIEW } from "../data/demo-capture";

type CreateMeasurementBody =
  operations["createMeasurement"]["requestBody"]["content"]["application/json"];
type CreateMeasurementResponse =
  operations["createMeasurement"]["responses"][201]["content"]["application/json"];

export const CAPTURE_START_ERROR = "Impossible de démarrer la mesure. Réessayez.";
export const CAPTURE_SESSION_EXPIRED_ERROR = "Session expirée. Reconnectez-vous, puis revenez à la capture pour reprendre la séance enregistrée.";

const noCaptureSession = () => null;

export interface UseCaptureSocketOptions {
  url?: string;
  apiUrl?: string;
  idPseudo?: string;
  deviceId?: string;
  measurementId?: string;
  initialPressure?: number;
  useFixture?: boolean;
  pressureThresholds?: Partial<ClinicalPressureThresholds>;
}

function computeArtifactIntervals(
  frames: CaptureFrame[],
): Array<{ startSec: number; endSec: number }> {
  const intervals: Array<{ startSec: number; endSec: number }> = [];
  let startSec: number | null = null;

  for (const frame of frames) {
    if (frame.isArtifact) {
      if (startSec === null) startSec = frame.timestampSec;
    } else if (startSec !== null) {
      intervals.push({ startSec, endSec: frame.timestampSec });
      startSec = null;
    }
  }

  const last = frames.at(-1);
  if (startSec !== null && last) {
    intervals.push({ startSec, endSec: +(last.timestampSec + 0.1).toFixed(1) });
  }

  return intervals;
}

export interface UseCaptureSocketReturn {
  status: CaptureStreamStatus;
  pressureKpa: number;
  stablePressureSec: number;
  isPressureStable: boolean;
  elapsedSec: number;
  targetDurationSec: number;
  metrics: QualityMetrics;
  frames: CaptureFrame[];
  artifactIntervals: Array<{ startSec: number; endSec: number }>;
  attemptsCount: number;
  result: CaptureResult | null;
  startError: string | null;
  resumeMeasurementId: string | null;
  isFrozen: boolean;
  setIsFrozen: (frozen: boolean | ((prev: boolean) => boolean)) => void;
  startCapture: () => void;
  stopCapture: () => void;
  retryCapture: () => void;
  resetCapture: () => void;
  setSimulatedPressure: (kpa: number) => void;
  isOnline: boolean;
}

export function useCaptureSocket({
  url = "ws://localhost:3001/ws/capture",
  apiUrl = clientEnv.NEXT_PUBLIC_API_URL,
  idPseudo = "",
  deviceId,
  measurementId,
  initialPressure = 0,
  useFixture = false,
  pressureThresholds,
}: UseCaptureSocketOptions = {}): UseCaptureSocketReturn {
  const savedSession = useSyncExternalStore(subscribeCaptureSession, readCaptureSession, noCaptureSession);
  const [status, setStatus] = useState<CaptureStreamStatus>("idle");
  const [pressureKpa, setPressureKpa] = useState<number>(initialPressure);
  const [stablePressureSec, setStablePressureSec] = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [frames, setFrames] = useState<CaptureFrame[]>([]);
  const [attemptsCount, setAttemptsCount] = useState<number>(1);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [createdMeasurementId, setCreatedMeasurementId] = useState<string | null>(null);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const activeMeasurementId = measurementId ?? createdMeasurementId ?? savedSession?.measurementId ?? null;
  const resumeMeasurementId = savedSession?.measurementId ?? null;
  const displayStatus = savedSession && status === "idle" && startError !== CAPTURE_SESSION_EXPIRED_ERROR
    ? savedSession.lastState === "analyzing" ? "analyzing" : "capturing"
    : status;
  const activeMeasurementIdRef = useRef<string | null>(measurementId ?? createdMeasurementId ?? null);
  const pendingStartIdRef = useRef<string | null>(null);
  const authExpiredRef = useRef(false);

  useEffect(() => {
    if (!savedSession || savedSession.measurementId === activeMeasurementIdRef.current) return;
    const saved = savedSession;
    authExpiredRef.current = false;
    activeMeasurementIdRef.current = saved.measurementId;
    if (saved.lastState === "capturing") pendingStartIdRef.current = saved.measurementId;
    void fetchJson<unknown>(`${apiUrl.replace(/\/+$/, "")}/measurements/${encodeURIComponent(saved.measurementId)}`)
      .catch((error: unknown) => {
        if (typeof error === "object" && error !== null && "status" in error && error.status === 401) {
          setStartError(CAPTURE_SESSION_EXPIRED_ERROR);
        }
      });
  }, [apiUrl, savedSession]);

  const targetDurationSec = 25.0;
  const minKpa = pressureThresholds?.pressureMinKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureMinKpa;
  const maxKpa = pressureThresholds?.pressureMaxKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureMaxKpa;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const fixtureIdxRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const framesRef = useRef<CaptureFrame[]>([]);
  const stableSinceRef = useRef<number | null>(null);
  const pressureRef = useRef<number>(pressureKpa);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  useEffect(() => {
    pressureRef.current = pressureKpa;
  }, [pressureKpa]);

  useEffect(() => {
    activeMeasurementIdRef.current = activeMeasurementId;
  }, [activeMeasurementId]);

  // Continuous valid pressure timer: 1.0 s inside the window enables the start.
  useEffect(() => {
    const id = setInterval(() => {
      const kpa = pressureRef.current;
      if (kpa < minKpa || kpa > maxKpa) {
        stableSinceRef.current = null;
        setStablePressureSec(0);
        return;
      }
      if (stableSinceRef.current === null) {
        stableSinceRef.current = Date.now();
      }
      setStablePressureSec(+((Date.now() - stableSinceRef.current) / 1000).toFixed(1));
    }, 100);
    return () => clearInterval(id);
  }, [minKpa, maxKpa]);

  const isPressureStable = stablePressureSec >= PRESSURE_STABLE_REQUIRED_SEC;

  const sendSocketMessage = useCallback(
    (message: { type: string; measurementId?: string }) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== 1) return;
      try {
        socket.send(JSON.stringify(message));
      } catch {
        // The capture UI must stay alive even if the relay link drops.
      }
    },
    [],
  );

  // Computed metrics
  const cleanDurationSec = frames
    .filter((f) => !f.isArtifact)
    .reduce((acc) => acc + 0.1, 0);

  const artifactFrames = frames.filter((f) => f.isArtifact).length;
  const artifactPct = frames.length > 0 ? (artifactFrames / frames.length) * 100 : 0;

  const currentRms = useFixture ? 0.142 : result?.rmsG ?? null;
  const currentFreq = useFixture ? 68 : result?.peakFreqHz ?? null;

  const metrics: QualityMetrics = {
    cleanDurationSec: Math.min(targetDurationSec, +cleanDurationSec.toFixed(1)),
    targetDurationSec,
    rmsG: currentRms,
    peakFreqHz: currentFreq,
    artifactPct: +artifactPct.toFixed(1),
    meanPressureKpa: pressureKpa,
  };

  const artifactIntervals = computeArtifactIntervals(frames);

  // Finish capture and compute result (used only in explicit demo/fixture mode)
  const finishCapture = useCallback(
    (collectedFrames: CaptureFrame[]) => {
      setStatus("analyzing");
      if (timerRef.current) clearInterval(timerRef.current);

      setTimeout(() => {
        const cleanSec = collectedFrames.filter((f) => !f.isArtifact).length * 0.1;
        const isRejected = cleanSec < 12.0;

        if (isRejected) {
          const finalResult: CaptureResult = {
            status: "REJECTED_QUALITY",
            idPseudo,
            cleanDurationSec: +cleanSec.toFixed(1),
            artifactPct: 24.5,
            meanPressureKpa: pressureKpa,
            rmsG: 0.098,
            peakFreqHz: 65,
            attemptsCount,
            maxAttempts: 3,
            rejectionReason: "mouvement du bras",
            demo: true,
          };
          setResult(finalResult);
          setStatus("rejected");
        } else {
          // Check patient baseline status
          const isBaselineBuilding = idPseudo === "PT-CAS-6603";
          const isHeroUnusual = idPseudo === "PT-CAS-8841";

          let finalResult: CaptureResult;
          if (isBaselineBuilding) {
            finalResult = {
              status: "BASELINE_BUILDING",
              idPseudo,
              cleanDurationSec: 23.0,
              artifactPct: 8.0,
              meanPressureKpa: 4.8,
              rmsG: 0.142,
              peakFreqHz: 68,
              stftPreview: DEMO_STFT_PREVIEW,
              baselineStep: 2,
              totalBaselineSteps: 3,
              attemptsCount,
              demo: true,
            };
          } else if (isHeroUnusual) {
            finalResult = {
              status: "UNUSUAL_EVOLUTION",
              idPseudo,
              cleanDurationSec: 22.9,
              artifactPct: 8.2,
              meanPressureKpa: 4.6,
              rmsG: 0.089,
              peakFreqHz: 184,
              stenosisRatio: 1.44,
              deviationScore: 3.8,
              threshold: 3.4,
              deltaRmsPct: -38,
              historyRmsBaseline: 0.145,
              baselinePeakFreqHz: 68,
              baselineStenosisRatio: 0.32,
              stftPreview: DEMO_STFT_PREVIEW,
              attemptsCount,
              explanation:
                "Par rapport à la référence : RMS −38 %, fréquence dominante de 68 Hz à 184 Hz, rapport haute/basse fréquence ×4,5. Deux séances de suite au-dessus du seuil.",
              demo: true,
            };
          } else {
            finalResult = {
              status: "NORMAL",
              idPseudo,
              cleanDurationSec: 23.5,
              artifactPct: 6.0,
              meanPressureKpa: 4.8,
              rmsG: 0.142,
              peakFreqHz: 68,
              deviationScore: 0.2,
              threshold: 3.4,
              historyRmsBaseline: 0.145,
              baselinePeakFreqHz: 68,
              baselineStenosisRatio: 0.32,
              stftPreview: DEMO_STFT_PREVIEW,
              attemptsCount,
              demo: true,
            };
          }

          setResult(finalResult);
          setStatus("completed");
        }
      }, 500);
    },
    [attemptsCount, idPseudo, pressureKpa],
  );

  // Playback timer for capture
  useEffect(() => {
    if (displayStatus !== "capturing" || isFrozen) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const timerId = setInterval(() => {
      elapsedRef.current = +(elapsedRef.current + 0.1).toFixed(1);
      const nextTime = elapsedRef.current;

      if (nextTime >= targetDurationSec) {
        clearInterval(timerId);
        timerRef.current = null;
        setElapsedSec(targetDurationSec);

        if (useFixture) {
          finishCapture(framesRef.current);
        } else {
          sendSocketMessage({
            type: "captureDone",
            measurementId: activeMeasurementIdRef.current ?? undefined,
          });
          setStatus("analyzing");
        }
        return;
      }

      // Add frame from fixture in demo mode
      if (useFixture) {
        const fixtureFrame = recordedFixture[fixtureIdxRef.current % recordedFixture.length];
        fixtureIdxRef.current += 1;

        if (fixtureFrame) {
          const newFrame: CaptureFrame = {
            timestampSec: nextTime,
            thrillValue: fixtureFrame.thrillValue,
            motionValue: fixtureFrame.motionValue,
            pressureKpa: fixtureFrame.pressureKpa,
            isArtifact: fixtureFrame.isArtifact,
          };
          framesRef.current = [...framesRef.current, newFrame];
          setFrames(framesRef.current);
        }
      }

      setElapsedSec(nextTime);
    }, useFixture ? 30 : 100);

    timerRef.current = timerId;

    return () => clearInterval(timerId);
  }, [displayStatus, finishCapture, isFrozen, sendSocketMessage, targetDurationSec, useFixture]);

  const socketUrl = activeMeasurementId
    ? `${url.replace(/\/+$/, "")}/${activeMeasurementId}`
    : null;

  // WebSocket connection management with reconnect backoff
  useEffect(() => {
    if (useFixture || !socketUrl) return;
    const targetUrl: string = socketUrl;

    let reconnectTimeout: NodeJS.Timeout | null = null;
    let delay = 1000;

    function connect() {
      try {
        const ws = new WebSocket(targetUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setIsOnline(true);
          delay = 1000;
          const pendingId = pendingStartIdRef.current;
          if (pendingId) {
            pendingStartIdRef.current = null;
            try {
              ws.send(JSON.stringify({ type: "captureStart", measurementId: pendingId }));
            } catch {
              // Relay link dropped; reconnect will retry.
            }
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "PRESSURE" && typeof data.kpa === "number") {
              setPressureKpa(data.kpa);
            }
            if (data.type === "FRAME" && data.frame) {
              setFrames((prev) => [...prev, data.frame]);
            }
            if (data.type === "RESULT" && data.result) {
              setResult(data.result);
              setStatus("completed");
              clearCaptureSession();
            }
            if (data.type === "error" && data.code === "UNAUTHORIZED") {
              authExpiredRef.current = true;
              setStartError(CAPTURE_SESSION_EXPIRED_ERROR);
              setStatus("idle");
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          setIsOnline(false);
          if (authExpiredRef.current) return;
          reconnectTimeout = setTimeout(() => {
            delay = Math.min(delay * 1.5, 10000);
            connect();
          }, delay);
        };

        ws.onerror = () => {
          setIsOnline(false);
          ws.close();
        };
      } catch {
        setIsOnline(false);
      }
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socketRef.current) socketRef.current.close();
    };
  }, [socketUrl, useFixture]);

  const startCapture = useCallback(() => {
    // Configurable pressure boundary plus the canonical 1.0 s stable-pressure gate
    if (pressureKpa < minKpa || pressureKpa > maxKpa) {
      return;
    }
    if (stablePressureSec < PRESSURE_STABLE_REQUIRED_SEC) {
      return;
    }
    setStartError(null);

    const beginCapture = (id: string | null) => {
      elapsedRef.current = 0;
      framesRef.current = [];
      setElapsedSec(0);
      setFrames([]);
      fixtureIdxRef.current = 0;
      setResult(null);
      setStatus("capturing");

      if (!id) return;
      if (deviceId) {
        saveCaptureSession({
          measurementId: id,
          idPseudo,
          deviceId,
          startedAt: new Date().toISOString(),
          lastState: "capturing",
        });
      }
      const socket = socketRef.current;
      if (socket && socket.readyState === 1) {
        try {
          socket.send(JSON.stringify({ type: "captureStart", measurementId: id }));
        } catch {
          // The capture UI must stay alive even if the relay link drops.
        }
      } else {
        pendingStartIdRef.current = id;
      }
    };

    if (useFixture) {
      beginCapture(null);
      return;
    }

    if (activeMeasurementIdRef.current) {
      beginCapture(activeMeasurementIdRef.current);
      return;
    }

    if (!deviceId) {
      setStartError(CAPTURE_START_ERROR);
      return;
    }

    void (async () => {
      try {
        const body: CreateMeasurementBody = {
          idPseudo: idPseudo || null,
          deviceId,
        };
        const created = await fetchJson<CreateMeasurementResponse>(
          `${apiUrl.replace(/\/+$/, "")}/measurements`,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        );
        if (!created?.measurementId) throw new Error("measurementId missing");
        activeMeasurementIdRef.current = created.measurementId;
        setCreatedMeasurementId(created.measurementId);
        if (deviceId) {
          saveCaptureSession({
            measurementId: created.measurementId,
            idPseudo,
            deviceId,
            startedAt: new Date().toISOString(),
            lastState: "capturing",
          });
        }
        beginCapture(created.measurementId);
      } catch {
        pendingStartIdRef.current = null;
        setStartError(CAPTURE_START_ERROR);
        setStatus("idle");
      }
    })();
  }, [apiUrl, deviceId, idPseudo, maxKpa, minKpa, pressureKpa, stablePressureSec, useFixture]);

  const stopCapture = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (displayStatus === "capturing") {
      sendSocketMessage({
        type: "captureDone",
        measurementId: activeMeasurementIdRef.current ?? undefined,
      });
    }
    setStatus("idle");
  }, [displayStatus, sendSocketMessage]);

  const retryCapture = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (displayStatus === "capturing") {
      sendSocketMessage({
        type: "captureDone",
        measurementId: activeMeasurementIdRef.current ?? undefined,
      });
    }
    setStartError(null);
    elapsedRef.current = 0;
    framesRef.current = [];
    setAttemptsCount((prev) => prev + 1);
    setElapsedSec(0);
    setFrames([]);
    fixtureIdxRef.current = 0;
    setResult(null);
    setStatus("idle");
  }, [displayStatus, sendSocketMessage]);

  const resetCapture = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (displayStatus === "capturing") {
      sendSocketMessage({
        type: "captureDone",
        measurementId: activeMeasurementIdRef.current ?? undefined,
      });
    }
    pendingStartIdRef.current = null;
    clearCaptureSession();
    setStartError(null);
    setCreatedMeasurementId(null);
    activeMeasurementIdRef.current = measurementId ?? null;
    elapsedRef.current = 0;
    framesRef.current = [];
    setStatus("idle");
    setElapsedSec(0);
    setFrames([]);
    setResult(null);
  }, [displayStatus, measurementId, sendSocketMessage]);

  const setSimulatedPressure = useCallback((kpa: number) => {
    setPressureKpa(kpa);
  }, []);

  return {
    status: displayStatus,
    pressureKpa,
    stablePressureSec,
    isPressureStable,
    elapsedSec,
    targetDurationSec,
    metrics,
    frames,
    artifactIntervals,
    attemptsCount,
    result,
    startError,
    resumeMeasurementId,
    isFrozen,
    setIsFrozen,
    startCapture,
    stopCapture,
    retryCapture,
    resetCapture,
    setSimulatedPressure,
    isOnline,
  };
}
