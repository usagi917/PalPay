import { NextRequest, NextResponse } from "next/server";
import { issueNonce, isValidSessionId } from "@/lib/server/agentSecurity";

const NONCE_TTL_MS = Number(process.env.AGENT_NONCE_TTL_MS || 5 * 60 * 1000);

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") || "";

  if (!sessionId || !isValidSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
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
