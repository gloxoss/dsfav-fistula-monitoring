import { fetchJson, HttpError } from "@/libs/http/fetcher";
import { clientEnv } from "@/libs/env/client";
import type { operations } from "@dsfav/shared-types";
import { BENCH_GENERIC_ERROR } from "../model/constants";
import type {
  BenchSessionResult,
  BenchSessionSummary,
  BenchSetup,
  PalpationInput,
} from "../model/types";

type CreateMeasurementBody =
  operations["createMeasurement"]["requestBody"]["content"]["application/json"];
type CreateMeasurementResponse =
  operations["createMeasurement"]["responses"][201]["content"]["application/json"];

function benchBaseUrl(): string {
  return `${clientEnv.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")}/bench/sessions`;
}

export async function createBenchMeasurement(deviceId: string): Promise<string> {
  const body: CreateMeasurementBody = { deviceId, source: "BENCH" };
  const created = await fetchJson<CreateMeasurementResponse>(
    `${clientEnv.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")}/measurements`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  if (!created?.measurementId) {
    throw new Error("measurementId missing");
  }
  return created.measurementId;
}

export async function createBenchSession(setup: BenchSetup): Promise<BenchSessionSummary> {
  return fetchJson<BenchSessionSummary>(benchBaseUrl(), {
    method: "POST",
    body: JSON.stringify({
      pumpFlowMlMin: setup.pumpFlowMlMin,
      clampStenosisPct: setup.clampStenosisPct,
    }),
  });
}

export async function submitBenchPalpation(
  sessionId: string,
  input: PalpationInput,
): Promise<BenchSessionSummary> {
  return fetchJson<BenchSessionSummary>(
    `${benchBaseUrl()}/${encodeURIComponent(sessionId)}/palpation`,
    {
      method: "POST",
      body: JSON.stringify({
        perceivedThrill: input.perceivedThrill,
        perceivedIntensity: input.perceivedIntensity,
        internNotes: input.internNotes,
      }),
    },
  );
}

export async function revealBenchSession(
  sessionId: string,
  measurementId: string,
): Promise<BenchSessionResult> {
  return fetchJson<BenchSessionResult>(
    `${benchBaseUrl()}/${encodeURIComponent(sessionId)}/capture`,
    {
      method: "POST",
      body: JSON.stringify({ measurementId }),
    },
  );
}

export async function listBenchSessions(): Promise<BenchSessionSummary[]> {
  return fetchJson<BenchSessionSummary[]>(benchBaseUrl());
}

export function benchErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    const data = error.data as { message_fr?: unknown } | undefined;
    if (data && typeof data.message_fr === "string" && data.message_fr.trim().length > 0) {
      return data.message_fr;
    }
  }
  return BENCH_GENERIC_ERROR;
}

export function isCaptureRejection(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false;
  const data = error.data as { code?: unknown } | undefined;
  return data?.code === "MEASUREMENT_INVALID";
}
