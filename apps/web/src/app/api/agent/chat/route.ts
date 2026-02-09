import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage, type Address } from "viem";
import { createChat } from "@/lib/agent/gemini";
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
import type { Content } from "@google/genai";

// In-memory session store (globalThis to survive HMR/webpack chunk splits)
type SessionRecord = {
  history: Content[];
  state: AgentState;
  draft?: ListingDraft;
  txPrepare?: TxPrepareResult;
  userAddress?: Address;
  authToken?: string;
  authTokenExpiresAt?: number;
};
const gSessions = globalThis as unknown as { __agentSessions?: Map<string, SessionRecord> };
const sessions = (gSessions.__agentSessions ??= new Map<string, SessionRecord>());

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
const DEFAULT_INPUT_HINT = "和牛を売りたい";
const DEFAULT_QUICK_ACTIONS = [
  { label: "和牛を売りたい", message: "神戸牛A5ランクを50万円で売りたいです" },
  { label: "出品を見る", message: "現在の出品一覧を見せてください" },
  { label: "日本酒を売りたい", message: "純米大吟醸を10万円で売りたいです" },
];

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function deriveNextInputHint(params: {
  state: AgentState;
  draft?: ListingDraft;
  txPrepare?: TxPrepareResult;
  toolCalls: ToolCall[];
  responseText: string;
}): string {
  const { state, draft, txPrepare, toolCalls, responseText } = params;

  if (state === "tx_prepared" && txPrepare) {
    switch (txPrepare.action) {
      case "createListing":
        return "署名して出品する";
      case "lock":
        return "購入を確定する";
      case "approve":
        return "承認する";
      case "cancel":
        return "キャンセルする";
      case "confirmDelivery":
        return "納品を確認する";
      default:
        return "署名して実行する";
    }
  }

  if (state === "draft_ready" && draft) {
    return "この内容で出品して";
  }

  if (toolCalls.some((call) => call.name === "get_listing_detail")) {
    return "この出品を購入したい";
  }

  if (toolCalls.some((call) => call.name === "get_listings")) {
    return "この出品の詳細を見たい";
  }

  if (state === "gathering_info") {
    if (includesAny(responseText, ["金額", "価格", "いくら"])) {
      return "金額は50万円";
    }
    if (includesAny(responseText, ["商品名", "タイトル", "品名"])) {
      return "商品名は神戸牛A5ランク";
    }
    if (includesAny(responseText, ["説明", "詳細"])) {
      return "説明文は◯◯です";
    }
    if (includesAny(responseText, ["カテゴリ", "カテゴリー"])) {
      return "カテゴリは和牛";
    }
    return "商品名は神戸牛A5ランク";
  }

  if (state === "awaiting_confirm") {
    return "はい";
  }

  if (state === "completed") {
    return "別の出品を作りたい";
  }

  return DEFAULT_INPUT_HINT;
}

function deriveNextQuickActions(params: {
  state: AgentState;
  draft?: ListingDraft;
  txPrepare?: TxPrepareResult;
  toolCalls: ToolCall[];
  responseText: string;
}): Array<{ label: string; message: string }> {
  const { state, draft, txPrepare, toolCalls, responseText } = params;

  if (state === "tx_prepared" && txPrepare) {
    switch (txPrepare.action) {
      case "createListing":
        return [
          { label: "署名して出品", message: "署名して出品を実行して" },
          { label: "修正したい", message: "内容を修正したいです" },
        ];
      case "lock":
        return [
          { label: "購入を確定", message: "購入を確定して" },
          { label: "もう一度見る", message: "出品詳細をもう一度見せて" },
        ];
      case "approve":
        return [
          { label: "承認する", message: "承認して" },
          { label: "やめる", message: "一旦やめたい" },
        ];
      case "cancel":
        return [
          { label: "キャンセル", message: "キャンセルして" },
          { label: "やめる", message: "一旦やめたい" },
        ];
      case "confirmDelivery":
        return [
          { label: "納品確認", message: "納品を確認して" },
          { label: "やめる", message: "一旦やめたい" },
        ];
      default:
        return [
          { label: "署名する", message: "署名して実行して" },
          { label: "やめる", message: "一旦やめたい" },
        ];
    }
  }

  if (state === "draft_ready" && draft) {
    return [
      { label: "この内容で出品", message: "この内容で出品して" },
      { label: "修正したい", message: "修正したい点があります" },
    ];
  }

  if (toolCalls.some((call) => call.name === "get_listing_detail")) {
    return [
      { label: "購入したい", message: "この出品を購入したい" },
      { label: "他も見る", message: "他の出品も見たい" },
    ];
  }

  if (toolCalls.some((call) => call.name === "get_listings")) {
    return [
      { label: "詳細を見る", message: "この出品の詳細を見たい" },
      { label: "購入したい", message: "この出品を購入したい" },
    ];
  }

  if (state === "gathering_info") {
    if (includesAny(responseText, ["金額", "価格", "いくら"])) {
      return [
        { label: "金額を伝える", message: "金額は50万円です" },
        { label: "相談したい", message: "価格について相談したい" },
      ];
    }
    if (includesAny(responseText, ["商品名", "タイトル", "品名"])) {
      return [
        { label: "商品名を伝える", message: "商品名は神戸牛A5ランクです" },
        { label: "相談したい", message: "商品名の付け方を相談したい" },
      ];
    }
    if (includesAny(responseText, ["説明", "詳細"])) {
      return [
        { label: "説明を伝える", message: "説明文は◯◯です" },
        { label: "相談したい", message: "説明文を相談したい" },
      ];
    }
    if (includesAny(responseText, ["カテゴリ", "カテゴリー"])) {
      return [
        { label: "和牛", message: "カテゴリは和牛" },
        { label: "日本酒", message: "カテゴリは日本酒" },
      ];
    }
    return [
      { label: "商品名を伝える", message: "商品名は神戸牛A5ランクです" },
      { label: "金額を伝える", message: "金額は50万円です" },
    ];
  }

  if (state === "awaiting_confirm") {
    return [
      { label: "はい", message: "はい" },
      { label: "修正したい", message: "修正したい点があります" },
    ];
  }

  if (state === "completed") {
    return [
      { label: "別の出品", message: "別の出品を作りたい" },
      { label: "出品を見る", message: "出品一覧を見せてください" },
    ];
  }

  return DEFAULT_QUICK_ACTIONS;
}

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
      const tokenHeader = request.headers.get("x-session-token") || "";
      const hasValidSessionToken = !!(session.authToken && session.authTokenExpiresAt && session.authTokenExpiresAt > now);
      const hasMatchingToken = hasValidSessionToken && tokenHeader === session.authToken;

      // Token is the fast path; if token is missing (e.g. previous 500 before token reached client),
      // allow explicit signature auth to recover the session.
      if (!hasMatchingToken) {
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

        if (session.userAddress && session.userAddress.toLowerCase() !== auth.address.toLowerCase()) {
          return jsonError("Session address mismatch", 403);
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

        let validSignature = false;
        try {
          validSignature = await verifyMessage({
            address: auth.address as Address,
            message: authMessage,
            signature: auth.signature as `0x${string}`,
          });
        } catch (error) {
          console.warn("[Agent] Invalid signature payload:", error);
          return jsonError("Invalid signature", 401);
        }

        if (!validSignature) {
          return jsonError("Invalid signature", 401);
        }

        session.userAddress = auth.address as Address;
        session.authToken = randomUUID();
      }

      if (session.userAddress && userAddress && session.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return jsonError("Session address mismatch", 403);
      }

      if (session.authToken) {
        session.authTokenExpiresAt = now + AUTH_TOKEN_TTL_MS;
      }
    }

    // Build system instruction with optional proactive context
    const effectiveUserAddress = session.userAddress || userAddress;
    let systemInstruction = SYSTEM_PROMPT;

    // Proactive context injection on first message
    if (session.history.length === 0 && effectiveUserAddress) {
      try {
        const userContext = await executeTool("suggest_next_action", {
          userAddress: effectiveUserAddress,
        });
        systemInstruction += `\n\n## 現在のユーザー状況（自動取得済み）\nウォレット: ${effectiveUserAddress}\n${JSON.stringify(userContext, null, 2)}\n\nこの情報を踏まえて、最初の応答からプロアクティブに提案してください。`;
      } catch (e) {
        console.error("[Agent] Failed to fetch proactive context:", e);
      }
    }

    // Create chat session with @google/genai SDK
    const chat = createChat(systemInstruction, session.history as Array<{ role: string; parts: Array<{ text?: string }> }>);

    // Send user message
    const userContext = effectiveUserAddress
      ? `\n\n[ユーザーウォレット: ${effectiveUserAddress}]`
      : "";
    const fullMessage = message + userContext;

    let response = await chat.sendMessage({ message: fullMessage });

    // Collect tool calls
    const toolCalls: ToolCall[] = [];

    // Process function calls (tool use)
    let functionCalls = response.functionCalls;
    while (functionCalls && functionCalls.length > 0) {
      const functionResponses: Array<{ id: string; name: string; response: Record<string, unknown> }> = [];

      for (const fc of functionCalls) {
        const toolName = fc.name!;
        const toolArgs = (fc.args || {}) as Record<string, unknown>;

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

          functionResponses.push({
            id: fc.id || "",
            name: toolName,
            response: { result: toolResult },
          });
        } catch (error) {
          console.error(`[Agent] Tool error:`, error);

          toolCalls.push({
            name: toolName,
            args: toolArgs,
            result: { error: String(error) },
          });

          functionResponses.push({
            id: fc.id || "",
            name: toolName,
            response: { error: String(error) },
          });
        }
      }

      // Send all function responses back to Gemini
      response = await chat.sendMessage({
        message: functionResponses.map((fr) => ({
          functionResponse: fr,
        })),
      });

      // Check for more function calls
      functionCalls = response.functionCalls;
    }

    // Get final text response (property, not method)
    const responseText = response.text ?? "";
    const nextInputHint = deriveNextInputHint({
      state: session.state,
      draft: session.draft,
      txPrepare: session.txPrepare,
      toolCalls,
      responseText,
    });
    const nextQuickActions = deriveNextQuickActions({
      state: session.state,
      draft: session.draft,
      txPrepare: session.txPrepare,
      toolCalls,
      responseText,
    });

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
      nextInputHint,
      nextQuickActions,
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
