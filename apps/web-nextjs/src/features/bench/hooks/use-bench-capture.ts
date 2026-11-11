"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientEnv } from "@/libs/env/client";
import { createBenchMeasurement } from "../data/bench-api";
import {
  BENCH_CAPTURE_REJECTED_FALLBACK,
  BENCH_CAPTURE_START_ERROR,
  BENCH_DEVICE_CONFIG_ERROR,
  BENCH_GENERIC_ERROR,
} from "../model/constants";
import type { BenchCaptureResult, BenchObjectiveData } from "../model/types";

export type BenchCaptureStatus =
  | "idle"
  | "creating"
  | "capturing"
  | "completed"
  | "rejected"
  | "error";

export interface UseBenchCaptureOptions {
  deviceId?: string | null;
  apiUrl?: string;
  wsUrl?: string;
}

export interface UseBenchCaptureReturn {
  status: BenchCaptureStatus;
  measurementId: string | null;
  objective: BenchObjectiveData | null;
  startError: string | null;
  rejectionMessage: string | null;
  startCapture: () => void;
  retryStart: () => void;
  resetCapture: () => void;
}

function captureSocketBase(apiUrl: string): string {
  return `${apiUrl.replace(/^http/i, "ws").replace(/\/+$/, "")}/ws/capture`;
}

function toObjective(result: BenchCaptureResult): BenchObjectiveData {
  return {
    rmsG: typeof result.rmsG === "number" ? result.rmsG : null,
    peakFreqHz: typeof result.peakFreqHz === "number" ? result.peakFreqHz : null,
    ratioHighLow: typeof result.ratioHighLow === "number" ? result.ratioHighLow : null,
  };
}

export function useBenchCapture({
  deviceId,
  apiUrl = clientEnv.NEXT_PUBLIC_API_URL,
  wsUrl,
}: UseBenchCaptureOptions = {}): UseBenchCaptureReturn {
  const [status, setStatus] = useState<BenchCaptureStatus>("idle");
  const [measurementId, setMeasurementId] = useState<string | null>(null);
  const [objective, setObjective] = useState<BenchObjectiveData | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const socketBase = wsUrl ?? captureSocketBase(apiUrl);

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      try {
        socket.close();
      } catch {
        // Closing a dead relay link must not break the screen.
      }
    }
  }, []);

  useEffect(() => closeSocket, [closeSocket]);

  const resetCapture = useCallback(() => {
    closeSocket();
    setStatus("idle");
    setMeasurementId(null);
    setObjective(null);
    setStartError(null);
    setRejectionMessage(null);
  }, [closeSocket]);

  const startCapture = useCallback(() => {
    if (!deviceId) {
      setStartError(BENCH_DEVICE_CONFIG_ERROR);
      setStatus("error");
      return;
    }

    closeSocket();
    setStatus("creating");
    setMeasurementId(null);
    setObjective(null);
    setStartError(null);
    setRejectionMessage(null);

    void (async () => {
      let created: string;
      try {
        created = await createBenchMeasurement(deviceId);
      } catch {
        setStartError(BENCH_CAPTURE_START_ERROR);
        setStatus("error");
        return;
      }

      setMeasurementId(created);
      setStatus("capturing");

      let socket: WebSocket;
      try {
        socket = new WebSocket(`${socketBase}/${created}`);
      } catch {
        setStartError(BENCH_GENERIC_ERROR);
        setStatus("error");
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        try {
          socket.send(JSON.stringify({ type: "captureStart", measurementId: created }));
        } catch {
          // The relay reconnect is handled by the protocol, not by this screen.
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as {
            type?: string;
            result?: BenchCaptureResult;
          };
          if (data.type !== "RESULT" || !data.result) return;
          if (data.result.status === "REJECTED_QUALITY" || data.result.rejectionReason) {
            setRejectionMessage(BENCH_CAPTURE_REJECTED_FALLBACK);
            setStatus("rejected");
          } else {
            setObjective(toObjective(data.result));
            setStatus("completed");
          }
          closeSocket();
        } catch {
          // Ignore malformed relay frames; the capture keeps waiting.
        }
      };

      socket.onerror = () => {
        if (socketRef.current !== socket) return;
        setStartError(BENCH_GENERIC_ERROR);
        setStatus("error");
      };
    })();
  }, [closeSocket, deviceId, socketBase]);

  const retryStart = useCallback(() => {
    closeSocket();
    setStartError(null);
    startCapture();
  }, [closeSocket, startCapture]);

  return {
    status,
    measurementId,
    objective,
    startError,
    rejectionMessage,
    startCapture,
    retryStart,
    resetCapture,
  };
}
