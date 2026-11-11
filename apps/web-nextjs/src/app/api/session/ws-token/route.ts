import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  signWsToken,
  verifySessionToken,
} from "@/libs/auth/session";
import { proxyToBackend } from "@/libs/http/backend-proxy";

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return NextResponse.json({ error: "Session absente ou expirée." }, { status: 401 });
  }

  const user = verifySessionToken(sessionToken);
  if (!user) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  // Attempt backend ws-token endpoint
  try {
    const backendRes = await proxyToBackend("/auth/ws-token", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data);
    }
  } catch {
    // Backend unreachable
  }

  // Fallback strictly limited to development environment
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Service de capture temporairement indisponible." },
      { status: 503 },
    );
  }

  // 60-second verified signed JWT generation for capture WebSocket in development
  const wsToken = signWsToken(user);

  return NextResponse.json({
    token: wsToken,
    expiresIn: 60,
  });
}
