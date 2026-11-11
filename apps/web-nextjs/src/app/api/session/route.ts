import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SEEDED_ACCOUNTS,
  decodeSessionToken,
  getRoleHome,
  signSessionToken,
  verifySessionToken,
  type SessionUser,
} from "@/libs/auth/session";
import { proxyToBackend } from "@/libs/http/backend-proxy";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect" },
        { status: 400 },
      );
    }

    // Try backend authentication first
    const backendRes = await proxyToBackend("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: String(identifier).trim().toLowerCase(), password }),
    });

    let token: string | null = null;
    let user: SessionUser | null = null;

    if (backendRes.ok) {
      const data = await backendRes.json();
      token = data.token ?? data.accessToken;
      if (token) {
        user = data.user ?? decodeSessionToken(token);
      }
    } else if (backendRes.status === 401) {
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect" },
        { status: 401 },
      );
    } else if (backendRes.status === 503 && process.env.NODE_ENV === "development") {
      // Local development fallback strictly limited to development environment
      const cleanId = String(identifier).trim().toLowerCase();
      const matched = SEEDED_ACCOUNTS.find(
        (acc) =>
          acc.identifier.toLowerCase() === cleanId ||
          acc.role.toLowerCase() === cleanId ||
          acc.roleLabel.toLowerCase() === cleanId,
      );

      // Verify dev credentials (only accept dev seed password)
      if (matched && password === "demo1234") {
        user = {
          id: `usr-${matched.role.toLowerCase()}-01`,
          role: matched.role,
        };
        // Generate signed, verified session token
        token = signSessionToken(user);
      }
    }

    if (!token || !user) {
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect" },
        { status: 401 },
      );
    }

    const homeUrl = getRoleHome(user.role);
    const response = NextResponse.json({ ok: true, user, homeUrl });

    const cookieStore = await cookies();
    cookieStore.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 3600, // 8 hours
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Identifiant ou mot de passe incorrect" },
      { status: 401 },
    );
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const user = verifySessionToken(token);
  if (!user) {
    return NextResponse.json({ error: "Session invalide" }, { status: 401 });
  }

  return NextResponse.json({ user, homeUrl: getRoleHome(user.role) });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
