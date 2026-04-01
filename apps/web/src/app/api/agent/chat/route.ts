import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage, type Address } from "viem";
import {
  getAgentProviderConfigError,
  streamResponse,
  historyToInput,
  type AgentHistoryContent,
  type ResponseInput,
  type ResponseStreamEvent,
} from "@/lib/agent/provider";
import { executeTool } from "@/lib/agent/tools";
import { SYSTEM_PROMPTS } from "@/lib/agent/prompts";
import { buildAgentAuthMessage } from "@/lib/agent/auth";
import { checkRateLimit, consumeNonce, isValidSessionId } from "@/lib/server/agentSecurity";
import type { Locale } from "@/lib/locale";
import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  AgentState,
  AgentStreamEvent,
  ToolCall,
  ListingDraft,
  TxPrepareResult,
} from "@/lib/agent/types";

// In-memory session store (globalThis to survive HMR/webpack chunk splits)
type SessionRecord = {
  history: AgentHistoryContent[];
  state: AgentState;
  draft?: ListingDraft;
  txPrepare?: TxPrepareResult;
  userAddress?: Address;
  authToken?: string;
  authTokenExpiresAt?: number;
  createdAt?: number;
  lastAccessAt?: number;
};
const gSessions = globalThis as unknown as { __agentSessions?: Map<string, SessionRecord> };
const sessions = (gSessions.__agentSessions ??= new Map<string, SessionRecord>());

function generateId(): string {
  return `msg_${randomUUID()}`;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

const MAX_BODY_BYTES = envInt("AGENT_MAX_BODY_BYTES", 16_000);
const MAX_MESSAGE_CHARS = envInt("AGENT_MAX_MESSAGE_CHARS", 2_000);
const RATE_LIMIT_MAX = envInt("AGENT_RATE_LIMIT_MAX", 20);
const RATE_LIMIT_WINDOW_MS = envInt("AGENT_RATE_LIMIT_WINDOW_MS", 60_000);
const SESSION_IDLE_TTL_MS = envInt("AGENT_SESSION_IDLE_TTL_MS", 60 * 60_000);
const AUTH_TIMESTAMP_SKEW_MS = envInt("AGENT_AUTH_SKEW_MS", 5 * 60_000);
const AUTH_TOKEN_TTL_MS = envInt("AGENT_AUTH_TOKEN_TTL_MS", 30 * 60_000);
const MAX_HISTORY_ENTRIES = 40; // 20 round-trips (user + model)
const MAX_TOOL_ROUNDS = 10;
const DEFAULT_INPUT_HINT: Record<Locale, string> = {
  ja: "和牛を売りたい",
  en: "I want to sell wagyu",
};
const DEFAULT_QUICK_ACTIONS: Record<Locale, Array<{ label: string; message: string }>> = {
  ja: [
    { label: "和牛を売りたい", message: "神戸牛A5ランクを50万円で売りたいです" },
    { label: "出品を見る", message: "現在の出品一覧を見せてください" },
    { label: "日本酒を売りたい", message: "純米大吟醸を10万円で売りたいです" },
  ],
  en: [
    { label: "Sell wagyu", message: "I want to sell Kobe A5 wagyu for 500,000 JPYC." },
    { label: "View listings", message: "Show me the current listings." },
    { label: "Sell sake", message: "I want to sell junmai daiginjo for 100,000 JPYC." },
  ],
};
const GATHERING_KEYWORDS: Record<Locale, { amount: string[]; title: string[]; description: string[]; category: string[] }> = {
  ja: {
    amount: ["金額", "価格", "いくら"],
    title: ["商品名", "タイトル", "品名"],
    description: ["説明", "詳細"],
    category: ["カテゴリ", "カテゴリー"],
  },
  en: {
    amount: ["amount", "price", "how much"],
    title: ["title", "product name", "item name"],
    description: ["description", "details"],
    category: ["category", "type"],
  },
};

function includesAny(text: string, keywords: string[]): boolean {
  const lowered = text.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

function deriveNextInputHint(params: {
  locale: Locale;
  state: AgentState;
  draft?: ListingDraft;
  txPrepare?: TxPrepareResult;
  toolCalls: ToolCall[];
  responseText: string;
}): string {
  const { locale, state, draft, txPrepare, toolCalls, responseText } = params;
  const keys = GATHERING_KEYWORDS[locale];

  if (state === "tx_prepared" && txPrepare) {
    if (locale === "ja") {
      switch (txPrepare.action) {
        case "createListing":
          return "確認して出品する";
        case "lock":
          return "支払いを確定する";
        case "approve":
          return "取引を開始する";
        case "activateAfterTimeout":
          return "期限後に取引開始する";
        case "cancel":
          return "キャンセルする";
        case "requestFinalDelivery":
          return "最終納品を申請する";
        case "confirmDelivery":
          return "受取りを確認する";
        case "finalizeAfterTimeout":
          return "期限後に最終確定する";
        default:
          return "確認して実行する";
      }
    }
    switch (txPrepare.action) {
      case "createListing":
        return "Confirm and create listing";
      case "lock":
        return "Confirm payment deposit";
      case "approve":
        return "Start this transaction";
      case "activateAfterTimeout":
        return "Activate after timeout";
      case "cancel":
        return "Cancel this transaction";
      case "requestFinalDelivery":
        return "Request final delivery";
      case "confirmDelivery":
        return "Confirm delivery receipt";
      case "finalizeAfterTimeout":
        return "Finalize after timeout";
      default:
        return "Confirm and execute";
    }
  }

  if (state === "draft_ready" && draft) {
    return locale === "ja" ? "この内容で出品して" : "Create this listing";
  }

  if (toolCalls.some((call) => call.name === "get_listing_detail")) {
    return locale === "ja" ? "この出品を購入したい" : "I want to buy this listing";
  }

  if (toolCalls.some((call) => call.name === "get_listings")) {
    return locale === "ja" ? "この出品の詳細を見たい" : "Show me details for this listing";
  }

  if (state === "gathering_info") {
    if (includesAny(responseText, keys.amount)) {
      return locale === "ja" ? "金額は50万円" : "The amount is 500,000 JPYC";
    }
    if (includesAny(responseText, keys.title)) {
      return locale === "ja" ? "商品名は神戸牛A5ランク" : "The product title is Kobe A5 wagyu";
    }
    if (includesAny(responseText, keys.description)) {
      return locale === "ja" ? "説明文は◯◯です" : "The description is: ...";
    }
    if (includesAny(responseText, keys.category)) {
      return locale === "ja" ? "カテゴリは和牛" : "The category is wagyu";
    }
    return locale === "ja" ? "商品名は神戸牛A5ランク" : "The product title is Kobe A5 wagyu";
  }

  if (state === "awaiting_confirm") {
    return locale === "ja" ? "はい" : "Yes";
  }

  if (state === "completed") {
    return locale === "ja" ? "別の出品を作りたい" : "I want to create another listing";
  }

  return DEFAULT_INPUT_HINT[locale];
}

function deriveNextQuickActions(params: {
  locale: Locale;
  state: AgentState;
  draft?: ListingDraft;
  txPrepare?: TxPrepareResult;
  toolCalls: ToolCall[];
  responseText: string;
}): Array<{ label: string; message: string }> {
  const { locale, state, draft, txPrepare, toolCalls, responseText } = params;
  const keys = GATHERING_KEYWORDS[locale];

  if (state === "tx_prepared" && txPrepare) {
    if (locale === "ja") {
      switch (txPrepare.action) {
        case "createListing":
          return [
            { label: "確認して出品", message: "確認して出品を実行して" },
            { label: "修正したい", message: "内容を修正したいです" },
          ];
        case "lock":
          return [
            { label: "支払いを確定", message: "支払いを確定して" },
            { label: "もう一度見る", message: "出品詳細をもう一度見せて" },
          ];
        case "approve":
          return [
            { label: "取引を開始", message: "取引を開始して" },
            { label: "やめる", message: "一旦やめたい" },
          ];
        case "activateAfterTimeout":
          return [
            { label: "期限後に開始", message: "期限後に取引開始して" },
            { label: "やめる", message: "一旦やめたい" },
          ];
        case "cancel":
          return [
            { label: "キャンセル", message: "キャンセルして" },
            { label: "やめる", message: "一旦やめたい" },
          ];
        case "requestFinalDelivery":
          return [
            { label: "最終納品を申請", message: "最終納品を申請して" },
            { label: "やめる", message: "一旦やめたい" },
          ];
        case "confirmDelivery":
          return [
            { label: "受取確認", message: "受取りを確認して" },
            { label: "やめる", message: "一旦やめたい" },
          ];
        case "finalizeAfterTimeout":
          return [
            { label: "期限後に最終確定", message: "期限後に最終確定して" },
            { label: "やめる", message: "一旦やめたい" },
          ];
        default:
          return [
            { label: "確認する", message: "確認して実行して" },
            { label: "やめる", message: "一旦やめたい" },
          ];
      }
    }
    switch (txPrepare.action) {
      case "createListing":
        return [
          { label: "Confirm listing", message: "Confirm and create this listing." },
          { label: "Edit draft", message: "I want to revise the draft." },
        ];
      case "lock":
        return [
          { label: "Confirm payment", message: "Confirm the payment deposit." },
          { label: "Review again", message: "Show the listing details again." },
        ];
      case "approve":
        return [
          { label: "Start transaction", message: "Start this transaction." },
          { label: "Not now", message: "I want to pause for now." },
        ];
      case "activateAfterTimeout":
        return [
          { label: "Activate now", message: "Activate this transaction after timeout." },
          { label: "Not now", message: "I want to pause for now." },
        ];
      case "cancel":
        return [
          { label: "Cancel", message: "Cancel this transaction." },
          { label: "Not now", message: "I want to pause for now." },
        ];
      case "requestFinalDelivery":
        return [
          { label: "Request final delivery", message: "Request final delivery." },
          { label: "Not now", message: "I want to pause for now." },
        ];
      case "confirmDelivery":
        return [
          { label: "Confirm receipt", message: "Confirm delivery receipt." },
          { label: "Not now", message: "I want to pause for now." },
        ];
      case "finalizeAfterTimeout":
        return [
          { label: "Finalize now", message: "Finalize this transaction after timeout." },
          { label: "Not now", message: "I want to pause for now." },
        ];
      default:
        return [
          { label: "Confirm", message: "Confirm and execute this action." },
          { label: "Not now", message: "I want to pause for now." },
        ];
    }
  }

  if (state === "draft_ready" && draft) {
    return locale === "ja"
      ? [
          { label: "この内容で出品", message: "この内容で出品して" },
          { label: "修正したい", message: "修正したい点があります" },
        ]
      : [
          { label: "Create listing", message: "Create this listing." },
          { label: "Edit draft", message: "I want to revise this draft." },
        ];
  }

  if (toolCalls.some((call) => call.name === "get_listing_detail")) {
    return locale === "ja"
      ? [
          { label: "購入したい", message: "この出品を購入したい" },
          { label: "他も見る", message: "他の出品も見たい" },
        ]
      : [
          { label: "Buy this", message: "I want to buy this listing." },
          { label: "View more", message: "Show me other listings too." },
        ];
  }

  if (toolCalls.some((call) => call.name === "get_listings")) {
    return locale === "ja"
      ? [
          { label: "詳細を見る", message: "この出品の詳細を見たい" },
          { label: "購入したい", message: "この出品を購入したい" },
        ]
      : [
          { label: "View details", message: "Show me details for this listing." },
          { label: "I want to buy", message: "I want to buy this listing." },
        ];
  }

  if (state === "gathering_info") {
    if (includesAny(responseText, keys.amount)) {
      return locale === "ja"
        ? [
            { label: "金額を伝える", message: "金額は50万円です" },
            { label: "相談したい", message: "価格について相談したい" },
          ]
        : [
            { label: "Share amount", message: "The amount is 500,000 JPYC." },
            { label: "Need advice", message: "I want pricing advice." },
          ];
    }
    if (includesAny(responseText, keys.title)) {
      return locale === "ja"
        ? [
            { label: "商品名を伝える", message: "商品名は神戸牛A5ランクです" },
            { label: "相談したい", message: "商品名の付け方を相談したい" },
          ]
        : [
            { label: "Share title", message: "The title is Kobe A5 wagyu." },
            { label: "Need advice", message: "I want help naming the product." },
          ];
    }
    if (includesAny(responseText, keys.description)) {
      return locale === "ja"
        ? [
            { label: "説明を伝える", message: "説明文は◯◯です" },
            { label: "相談したい", message: "説明文を相談したい" },
          ]
        : [
            { label: "Share description", message: "The description is: ..." },
            { label: "Need advice", message: "Help me improve the description." },
          ];
    }
    if (includesAny(responseText, keys.category)) {
      return locale === "ja"
        ? [
            { label: "和牛", message: "カテゴリは和牛" },
            { label: "日本酒", message: "カテゴリは日本酒" },
          ]
        : [
            { label: "Wagyu", message: "The category is wagyu." },
            { label: "Sake", message: "The category is sake." },
          ];
    }
    return locale === "ja"
      ? [
          { label: "商品名を伝える", message: "商品名は神戸牛A5ランクです" },
          { label: "金額を伝える", message: "金額は50万円です" },
        ]
      : [
          { label: "Share title", message: "The title is Kobe A5 wagyu." },
          { label: "Share amount", message: "The amount is 500,000 JPYC." },
        ];
  }

  if (state === "awaiting_confirm") {
    return locale === "ja"
      ? [
          { label: "はい", message: "はい" },
          { label: "修正したい", message: "修正したい点があります" },
        ]
      : [
          { label: "Yes", message: "Yes" },
          { label: "Needs changes", message: "I want to revise some details." },
        ];
  }

  if (state === "completed") {
    return locale === "ja"
      ? [
          { label: "別の出品", message: "別の出品を作りたい" },
          { label: "出品を見る", message: "出品一覧を見せてください" },
        ]
      : [
          { label: "New listing", message: "I want to create another listing." },
          { label: "View listings", message: "Show me the listing catalog." },
        ];
  }

  return DEFAULT_QUICK_ACTIONS[locale];
}

function isLocale(value: unknown): value is Locale {
  return value === "ja" || value === "en";
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-vercel-forwarded-for")
    || request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim()
    || request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || "unknown";
}

const SAFE_ERROR_PREFIXES = [
  "Factory address not configured",
  "Invalid transaction action",
  "Listing not found",
  "Producer address required",
  "Unknown tool",
];

function sanitizeToolError(error: unknown): string {
  if (
    error instanceof Error
    && SAFE_ERROR_PREFIXES.some((p) => error.message.startsWith(p))
  ) {
    return error.message.slice(0, 200);
  }
  return "Tool execution failed";
}

function jsonError(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

function touchSession(session: SessionRecord, now = Date.now()) {
  if (!session.createdAt) {
    session.createdAt = now;
  }
  session.lastAccessAt = now;
}

function pruneSessions(now = Date.now()) {
  for (const [sessionId, session] of sessions.entries()) {
    const lastAccess = session.lastAccessAt ?? session.createdAt ?? 0;
    if (lastAccess > 0 && now - lastAccess > SESSION_IDLE_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}

function ensureSessionAuthorized(request: NextRequest, session: SessionRecord): NextResponse | null {
  const tokenHeader = request.headers.get("x-session-token") || "";
  if (!session.authToken || !tokenHeader || tokenHeader !== session.authToken) {
    return jsonError("Unauthorized", 401);
  }
  return null;
}

// ---------- SSE helpers ----------

function sseEncode(event: AgentStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

// ---------- Streaming handler (openai-responses) ----------

async function handleStreamingPost(params: {
  session: SessionRecord;
  sessionId: string;
  fullMessage: string;
  locale: Locale;
  systemInstruction: string;
  effectiveUserAddress?: string;
}): Promise<Response> {
  const { session, fullMessage, locale, systemInstruction } = params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: AgentStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(sseEncode(event)));
        } catch (e) {
          // Controller may be closed if client disconnected
          if (e instanceof TypeError && /enqueue|closed/i.test(e.message)) {
            // Expected: client disconnected
          } else {
            console.warn("[Agent/SSE] Unexpected enqueue error:", e);
          }
        }
      };

      try {
        // Build input from history + new user message
        const turnInput: ResponseInput[] = historyToInput(session.history);
        turnInput.push({ type: "message", role: "user", content: fullMessage });

        const toolCalls: ToolCall[] = [];
        let fullText = "";

        // Streaming loop: keep going until we get a final text response
        let pendingFunctionCalls: Array<{
          item_id: string;
          call_id: string;
          name: string;
          args: Record<string, unknown>;
        }> = [];
        const processStream = async (
          streamGen: AsyncGenerator<ResponseStreamEvent>,
        ) => {
          pendingFunctionCalls = [];
          for await (const event of streamGen) {
            switch (event.type) {
              case "response.output_text.delta":
                fullText += event.delta;
                enqueue({ type: "text_delta", delta: event.delta });
                break;

              case "response.function_call_arguments.done": {
                let parsedArgs: Record<string, unknown> = {};
                try {
                  parsedArgs = JSON.parse(event.arguments) as Record<string, unknown>;
                } catch (e) {
                  console.warn(`[Agent/Stream] Failed to parse tool args for ${event.name}, using empty args:`, e);
                }
                pendingFunctionCalls.push({
                  item_id: event.item_id,
                  call_id: event.call_id,
                  name: event.name,
                  args: parsedArgs,
                });
                enqueue({
                  type: "tool_call_start",
                  callId: event.call_id,
                  name: event.name,
                  args: parsedArgs,
                });
                break;
              }
            }
          }
        };

        // First stream
        const firstStream = streamResponse({
          instructions: systemInstruction,
          input: turnInput,
        });
        await processStream(firstStream);

        // Tool execution loop
        let toolRound = 0;
        while (pendingFunctionCalls.length > 0 && toolRound < MAX_TOOL_ROUNDS) {
          toolRound++;
          for (const fc of pendingFunctionCalls) {
            const effectiveArgs = { ...fc.args };
            if (fc.name === "prepare_transaction") {
              const action = typeof fc.args.action === "string" ? fc.args.action : "";
              if (action === "createListing" && session.draft) {
                const incomingDraft = fc.args.draft;
                if (incomingDraft && typeof incomingDraft === "object") {
                  effectiveArgs.draft = {
                    ...session.draft,
                    ...(incomingDraft as Record<string, unknown>),
                  };
                } else {
                  effectiveArgs.draft = session.draft;
                }
              }
            }

            if (process.env.NODE_ENV === "development") {
              console.log(`[Agent/Stream] Tool call: ${fc.name}`, effectiveArgs);
            } else {
              console.log(`[Agent/Stream] Tool call: ${fc.name}`);
            }

            try {
              const toolResult = await executeTool(fc.name, effectiveArgs);

              toolCalls.push({
                name: fc.name,
                args: effectiveArgs,
                result: toolResult,
              });

              // Update session state
              if (fc.name === "prepare_listing_draft") {
                session.draft = toolResult as ListingDraft;
                session.state = "draft_ready";
                enqueue({ type: "draft_update", draft: session.draft });
                enqueue({ type: "state_change", state: session.state });
              } else if (fc.name === "prepare_transaction") {
                session.txPrepare = toolResult as TxPrepareResult;
                session.state = "tx_prepared";
                enqueue({ type: "tx_prepare", txPrepare: session.txPrepare });
                enqueue({ type: "state_change", state: session.state });
              } else if (fc.name === "get_listings" || fc.name === "get_listing_detail") {
                session.state = "gathering_info";
                enqueue({ type: "state_change", state: session.state });
              }

              enqueue({
                type: "tool_call_result",
                callId: fc.call_id,
                name: fc.name,
                result: toolResult,
              });

              turnInput.push(
                {
                  type: "function_call",
                  id: fc.item_id || `fc_${fc.call_id}`,
                  call_id: fc.call_id,
                  name: fc.name,
                  arguments: JSON.stringify(effectiveArgs),
                },
                {
                  type: "function_call_output",
                  call_id: fc.call_id,
                  output: JSON.stringify({ result: toolResult }),
                },
              );
            } catch (error) {
              console.error(`[Agent/Stream] Tool error (${fc.name}):`, error);
              const safeMessage = sanitizeToolError(error);

              toolCalls.push({
                name: fc.name,
                args: effectiveArgs,
                result: { error: safeMessage },
              });

              enqueue({
                type: "tool_call_result",
                callId: fc.call_id,
                name: fc.name,
                result: { error: safeMessage },
              });

              turnInput.push(
                {
                  type: "function_call",
                  id: fc.item_id || `fc_${fc.call_id}`,
                  call_id: fc.call_id,
                  name: fc.name,
                  arguments: JSON.stringify(effectiveArgs),
                },
                {
                  type: "function_call_output",
                  call_id: fc.call_id,
                  output: JSON.stringify({ error: safeMessage }),
                },
              );
            }
          }

          const nextStream = streamResponse({
            instructions: systemInstruction,
            input: turnInput,
          });
          await processStream(nextStream);
        }

        if (toolRound >= MAX_TOOL_ROUNDS) {
          console.warn("[Agent/Stream] Tool round limit reached");
          enqueue({ type: "error", error: "Tool execution limit reached" });
        }

        // Update history
        session.history.push(
          { role: "user", parts: [{ text: fullMessage }] },
          { role: "model", parts: [{ text: fullText }] },
        );
        if (session.history.length > MAX_HISTORY_ENTRIES) {
          session.history = session.history.slice(-MAX_HISTORY_ENTRIES);
        }

        // Derive hints
        const nextInputHint = deriveNextInputHint({
          locale,
          state: session.state,
          draft: session.draft,
          txPrepare: session.txPrepare,
          toolCalls,
          responseText: fullText,
        });
        const nextQuickActions = deriveNextQuickActions({
          locale,
          state: session.state,
          draft: session.draft,
          txPrepare: session.txPrepare,
          toolCalls,
          responseText: fullText,
        });

        // Build final message
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: fullText,
          timestamp: Date.now(),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          draft: session.draft,
          txPrepare: session.txPrepare,
        };

        enqueue({
          type: "done",
          message: assistantMessage,
          state: session.state,
          draft: session.draft,
          txPrepare: session.txPrepare,
          nextInputHint,
          nextQuickActions,
        });
      } catch (error) {
        console.error("[Agent/Stream] Error:", error);
        enqueue({ type: "error", error: "Internal server error" });
      } finally {
        controller.close();
      }
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
  if (session.authToken) {
    headers["X-Session-Token"] = session.authToken;
  }

  return new Response(stream, { headers });
}

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_AGENT !== 'true') {
    return NextResponse.json(
      { error: 'Agent is not available' },
      { status: 403 }
    );
  }

  try {
    pruneSessions();

    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return jsonError("Request too large", 413);
    }

    const rawBody = await request.text();
    const bodySize = new TextEncoder().encode(rawBody).length;
    if (bodySize > MAX_BODY_BYTES) {
      return jsonError("Request too large", 413);
    }

    let body: ChatRequest;
    try {
      body = JSON.parse(rawBody) as ChatRequest;
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    const { message, sessionId, locale, userAddress, auth } = body;
    const normalizedMessage = typeof message === "string" ? message.trim() : "";

    if (typeof sessionId !== "string" || !sessionId || !normalizedMessage || !isLocale(locale)) {
      return jsonError("message, sessionId and locale are required", 400);
    }

    if (!isValidSessionId(sessionId)) {
      return jsonError("Invalid sessionId", 400);
    }

    if (normalizedMessage.length > MAX_MESSAGE_CHARS) {
      return jsonError("Message too long", 413);
    }

    if (userAddress && (typeof userAddress !== "string" || !isAddress(userAddress))) {
      return jsonError("Invalid userAddress", 400);
    }

    const rateKey = getClientIp(request);
    const rate = checkRateLimit(rateKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!rate.allowed) {
      const retryAfter = Math.ceil((rate.resetAt - Date.now()) / 1000);
      return jsonError("Rate limit exceeded", 429, {
        "Retry-After": String(Math.max(1, retryAfter)),
      });
    }

    const now = Date.now();
    let session = sessions.get(sessionId);
    const tokenHeader = request.headers.get("x-session-token") || "";
    const hasMatchingToken = !!(
      session?.authToken
      && session.authTokenExpiresAt
      && session.authTokenExpiresAt > now
      && tokenHeader === session.authToken
    );

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

      if (session?.userAddress && session.userAddress.toLowerCase() !== auth.address.toLowerCase()) {
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

      if (!session) {
        session = {
          history: [],
          state: "idle",
          createdAt: now,
          lastAccessAt: now,
        };
        sessions.set(sessionId, session);
      }
      session.userAddress = auth.address as Address;
      session.authToken = randomUUID();
    }

    if (!session) {
      return jsonError("Unauthorized", 401);
    }

    if (session.userAddress && userAddress && session.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return jsonError("Session address mismatch", 403);
    }

    if (session.authToken) {
      session.authTokenExpiresAt = now + AUTH_TOKEN_TTL_MS;
    }

    touchSession(session, now);

    const providerConfigError = getAgentProviderConfigError();
    if (providerConfigError) {
      console.error(`[Agent] Provider config error: ${providerConfigError}`);
      return jsonError(
        locale === "ja"
          ? "Agentサービスが一時的に利用できません。しばらくしてから再度お試しください。"
          : "Agent service is temporarily unavailable. Please try again later.",
        503
      );
    }

    // Build system instruction with optional proactive context
    const effectiveUserAddress = session.userAddress || userAddress;
    let systemInstruction = SYSTEM_PROMPTS[locale];

    // Proactive context injection on first message
    if (session.history.length === 0 && effectiveUserAddress) {
      try {
        const userContext = await executeTool("suggest_next_action", {
          userAddress: effectiveUserAddress,
        });
        if (locale === "ja") {
          systemInstruction += `\n\n## 現在のユーザー状況（自動取得済み）\nアカウント: ${effectiveUserAddress}\n${JSON.stringify(userContext, null, 2)}\n\nこの情報を踏まえて、最初の応答からプロアクティブに提案してください。`;
        } else {
          systemInstruction += `\n\n## Current User Context (auto-fetched)\nAccount: ${effectiveUserAddress}\n${JSON.stringify(userContext, null, 2)}\n\nUse this context and start with proactive recommendations in your first response.`;
        }
      } catch (e) {
        console.error("[Agent] Failed to fetch proactive context:", e);
      }
    }

    // Build user message with account context
    const userContext = effectiveUserAddress
      ? locale === "ja"
        ? `\n\n[ユーザーアカウント: ${effectiveUserAddress}]`
        : `\n\n[User Account: ${effectiveUserAddress}]`
      : "";
    const fullMessage = normalizedMessage + userContext;

    return handleStreamingPost({
      session,
      sessionId,
      fullMessage,
      locale,
      systemInstruction,
      effectiveUserAddress: effectiveUserAddress as string | undefined,
    });
  } catch (error) {
    console.error("[Agent] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check session state
export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_AGENT !== 'true') {
    return jsonError('Agent is not available', 403);
  }

  pruneSessions();

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

  const unauthorized = ensureSessionAuthorized(request, session);
  if (unauthorized) {
    return unauthorized;
  }
  touchSession(session);

  return NextResponse.json({
    state: session.state,
    messageCount: session.history.length / 2,
    hasDraft: !!session.draft,
    hasTxPrepare: !!session.txPrepare,
  });
}

// DELETE endpoint to clear session
export async function DELETE(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_AGENT !== 'true') {
    return jsonError('Agent is not available', 403);
  }

  pruneSessions();

  const sessionId = request.nextUrl.searchParams.get("sessionId") || "";

  if (!sessionId || !isValidSessionId(sessionId)) {
    return jsonError("sessionId is required", 400);
  }

  const session = sessions.get(sessionId);
  if (session) {
    const unauthorized = ensureSessionAuthorized(request, session);
    if (unauthorized) {
      return unauthorized;
    }
    sessions.delete(sessionId);
  }

  return NextResponse.json({ success: true });
}
