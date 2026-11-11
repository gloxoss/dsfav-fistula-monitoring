import { NextResponse } from "next/server";

export function getApiBaseUrl(): string {
  return process.env.API_URL ?? "http://localhost:3101";
}

export async function proxyToBackend(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const targetUrl = `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

  try {
    return await fetch(targetUrl, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Impossible de joindre le serveur de la clinique. Aucun accès n'a été accordé." },
      { status: 503 },
    );
  }
}
