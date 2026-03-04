import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, issueNonce, isValidSessionId } from "@/lib/server/agentSecurity";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

const NONCE_TTL_MS = envInt("AGENT_NONCE_TTL_MS", 5 * 60_000);

export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_AGENT !== 'true') {
    return NextResponse.json(
      { error: 'Agent is not available' },
      { status: 403 }
    );
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId") || "";

  if (!sessionId || !isValidSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  const rate = checkRateLimit(`nonce:${sessionId}`, 30, 60_000);
  if (!rate.allowed) {
    const retryAfter = Math.ceil((rate.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, retryAfter)),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const { nonce, expiresAt } = issueNonce(sessionId, NONCE_TTL_MS);

  return NextResponse.json(
    { nonce, expiresAt },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
