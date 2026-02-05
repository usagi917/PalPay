import { NextRequest, NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/agent/gemini";
import { executeTool } from "@/lib/agent/tools";
import { SYSTEM_PROMPT } from "@/lib/agent/prompts";
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
}>();

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, sessionId, userAddress } = body;

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: "message and sessionId are required" },
        { status: 400 }
      );
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
    const userContext = userAddress
      ? `\n\n[ユーザーウォレット: ${userAddress}]`
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
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return NextResponse.json({
      state: "idle",
      messageCount: 0,
    });
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
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  sessions.delete(sessionId);

  return NextResponse.json({ success: true });
}
