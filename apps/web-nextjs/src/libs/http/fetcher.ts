import type { paths } from "@dsfav/shared-types";

export class HttpError extends Error {
  readonly status: number;
  readonly data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.data = data;
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let errorData: unknown;
    try {
      errorData = await res.json();
    } catch {
      // ignore non-json response
    }
    throw new HttpError(res.status, `HTTP ${res.status} on ${url}`, errorData);
  }
  return (await res.json()) as T;
}

export type ApiPaths = paths;
