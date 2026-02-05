import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage, type Address } from "viem";
import { getGeminiModel } from "@/lib/agent/gemini";
import { executeTool } from "@/lib/agent/tools";
import { SYSTEM_PROMPT } from "@/lib/agent/prompts";
import { buildAgentAuthMessage } from "@/lib/agent/auth";
import { checkRateLimit, consumeNonce, isValidSessionId } from "@/lib/server/agentSecurity";
import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  AgentState,
  ToolCall,
  ListingDraft,
  TxPrepareResult,
} from "@/lib/agent/types";
import type { Content } from "@google/generative-ai";

// In-memory session store (for demo purposes)
const sessions = new Map<string, {
  history: Content[];
  state: AgentState;
  draft?: ListingDraft;
  txPrepare?: TxPrepareResult;
  userAddress?: Address;
  authToken?: string;
  authTokenExpiresAt?: number;
}>();

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const MAX_BODY_BYTES = Number(process.env.AGENT_MAX_BODY_BYTES || 16_000);
const MAX_MESSAGE_CHARS = Number(process.env.AGENT_MAX_MESSAGE_CHARS || 2_000);
const RATE_LIMIT_MAX = Number(process.env.AGENT_RATE_LIMIT_MAX || 20);
const RATE_LIMIT_WINDOW_MS = Number(process.env.AGENT_RATE_LIMIT_WINDOW_MS || 60_000);
const AUTH_DISABLED = process.env.AGENT_AUTH_DISABLED === "true";
const AUTH_TIMESTAMP_SKEW_MS = Number(process.env.AGENT_AUTH_SKEW_MS || 5 * 60_000);
const AUTH_TOKEN_TTL_MS = Number(process.env.AGENT_AUTH_TOKEN_TTL_MS || 30 * 60_000);

function getClientKey(request: NextRequest, sessionId?: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  return `${ip}:${sessionId || "no-session"}`;
}

function jsonError(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return jsonError("Request too large", 413);
    }

    let body: ChatRequest;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    const { message, sessionId, userAddress, auth } = body;

    if (typeof message !== "string" || typeof sessionId !== "string" || !message || !sessionId) {
      return jsonError("message and sessionId are required", 400);
    }

    if (!isValidSessionId(sessionId)) {
      return jsonError("Invalid sessionId", 400);
    }

    if (message.length > MAX_MESSAGE_CHARS) {
      return jsonError("Message too long", 413);
    }

    if (userAddress && (typeof userAddress !== "string" || !isAddress(userAddress))) {
      return jsonError("Invalid userAddress", 400);
    }

    const rateKey = getClientKey(request, sessionId);
    const rate = checkRateLimit(rateKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!rate.allowed) {
      const retryAfter = Math.ceil((rate.resetAt - Date.now()) / 1000);
      return jsonError("Rate limit exceeded", 429, {
        "Retry-After": String(Math.max(1, retryAfter)),
      });
    }

    // Get or create session
    let session = sessions.get(sessionId);
    if (!session) {
      session = {
        history: [],
        state: "idle",
      };
      sessions.set(sessionId, session);
    }

    const now = Date.now();
    if (!AUTH_DISABLED) {
      if (session.authToken && session.authTokenExpiresAt && session.authTokenExpiresAt > now) {
        const tokenHeader = request.headers.get("x-session-token") || "";
        if (!tokenHeader || tokenHeader !== session.authToken) {
          return jsonError("Unauthorized", 401);
        }
      } else {
        if (!auth || !auth.address || !auth.signature || !auth.nonce || auth.timestamp === undefined) {
          return jsonError("Unauthorized", 401);
        }

        if (typeof auth.address !== "string" || !isAddress(auth.address)) {
          return jsonError("Invalid auth address", 400);
        }

        if (typeof auth.signature !== "string" || typeof auth.nonce !== "string") {
          return jsonError("Invalid auth payload", 400);
        }

        if (userAddress && auth.address.toLowerCase() !== userAddress.toLowerCase()) {
          return jsonError("Auth address mismatch", 401);
        }

        const timestamp = Number(auth.timestamp);
        if (!Number.isFinite(timestamp)) {
          return jsonError("Invalid auth timestamp", 400);
        }

        if (Math.abs(now - timestamp) > AUTH_TIMESTAMP_SKEW_MS) {
          return jsonError("Auth expired", 401);
        }

        if (!consumeNonce(sessionId, auth.nonce)) {
          return jsonError("Invalid nonce", 401);
        }

        const authMessage = buildAgentAuthMessage({
          sessionId,
          nonce: auth.nonce,
          timestamp,
        });

        const validSignature = await verifyMessage({
          address: auth.address as Address,
          message: authMessage,
          signature: auth.signature as `0x${string}`,
        });

        if (!validSignature) {
          return jsonError("Invalid signature", 401);
        }

        session.userAddress = auth.address as Address;
        session.authToken = randomUUID();
        session.authTokenExpiresAt = now + AUTH_TOKEN_TTL_MS;
      }

      if (session.userAddress && userAddress && session.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return jsonError("Session address mismatch", 403);
      }

      if (session.authToken) {
        session.authTokenExpiresAt = now + AUTH_TOKEN_TTL_MS;
      }
    }

    // Initialize Gemini model
    const model = getGeminiModel();

    // Build conversation history for Gemini
    const systemHistory: Content[] = [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: "model",
        parts: [{ text: "了解しました。B2Bエスクロー決済プラットフォームのアシスタントとして、出品者と購入者のサポートを行います。何かお手伝いできることはありますか？" }],
      },
    ];

    const chat = model.startChat({
      history: [...systemHistory, ...session.history],
    });

    // Send user message
    const effectiveUserAddress = session.userAddress || userAddress;
    const userContext = effectiveUserAddress
      ? `\n\n[ユーザーウォレット: ${effectiveUserAddress}]`
      : "";
    const fullMessage = message + userContext;

    let result = await chat.sendMessage(fullMessage);
    let response = result.response;

    // Collect tool calls
    const toolCalls: ToolCall[] = [];

    // Process function calls (tool use)
    let functionCalls = response.functionCalls?.();
    while (functionCalls && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        const toolName = fc.name;
        const toolArgs = fc.args as Record<string, unknown>;

        console.log(`[Agent] Tool call: ${toolName}`, toolArgs);

        try {
          const toolResult = await executeTool(toolName, toolArgs);

          toolCalls.push({
            name: toolName,
            args: toolArgs,
            result: toolResult,
          });

          // Update session state based on tool calls
          if (toolName === "prepare_listing_draft") {
            session.draft = toolResult as ListingDraft;
            session.state = "draft_ready";
          } else if (toolName === "prepare_transaction") {
            session.txPrepare = toolResult as TxPrepareResult;
            session.state = "tx_prepared";
          } else if (toolName === "get_listings" || toolName === "get_listing_detail") {
            session.state = "gathering_info";
          }

          // Send tool result back to Gemini
          result = await chat.sendMessage([
            {
              functionResponse: {
                name: toolName,
                response: { result: toolResult },
              },
            },
          ]);
          response = result.response;
        } catch (error) {
          console.error(`[Agent] Tool error:`, error);

          toolCalls.push({
            name: toolName,
            args: toolArgs,
            result: { error: String(error) },
          });

          result = await chat.sendMessage([
            {
              functionResponse: {
                name: toolName,
                response: { error: String(error) },
              },
            },
          ]);
          response = result.response;
        }
      }

      // Check for more function calls
      functionCalls = response.functionCalls?.();
    }

    // Get final text response
    const responseText = response.text();

    // Update history
    session.history.push(
      { role: "user", parts: [{ text: fullMessage }] },
      { role: "model", parts: [{ text: responseText }] }
    );

    // Build response message
    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: responseText,
      timestamp: Date.now(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      draft: session.draft,
      txPrepare: session.txPrepare,
    };

    const chatResponse: ChatResponse = {
      message: assistantMessage,
      state: session.state,
      draft: session.draft,
      txPrepare: session.txPrepare,
      sessionToken: session.authToken,
    };

    return NextResponse.json(chatResponse);
  } catch (error) {
    console.error("[Agent] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check session state
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") || "";

  if (!sessionId || !isValidSessionId(sessionId)) {
    return jsonError("sessionId is required", 400);
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return NextResponse.json({
      state: "idle",
      messageCount: 0,
    });
  }

  const now = Date.now();
  if (!AUTH_DISABLED && session.authToken && session.authTokenExpiresAt && session.authTokenExpiresAt > now) {
    const tokenHeader = request.headers.get("x-session-token") || "";
    if (!tokenHeader || tokenHeader !== session.authToken) {
      return jsonError("Unauthorized", 401);
    }
  }

  return NextResponse.json({
    state: session.state,
    messageCount: session.history.length / 2,
    hasDraft: !!session.draft,
    hasTxPrepare: !!session.txPrepare,
  });
}

// DELETE endpoint to clear session
export async function DELETE(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") || "";

  if (!sessionId || !isValidSessionId(sessionId)) {
    return jsonError("sessionId is required", 400);
  }

  const session = sessions.get(sessionId);
  if (!AUTH_DISABLED && session?.authToken && session.authTokenExpiresAt && session.authTokenExpiresAt > Date.now()) {
    const tokenHeader = request.headers.get("x-session-token") || "";
    if (!tokenHeader || tokenHeader !== session.authToken) {
      return jsonError("Unauthorized", 401);
    }
  }

  sessions.delete(sessionId);

  return NextResponse.json({ success: true });
}
