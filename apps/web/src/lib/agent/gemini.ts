import { randomUUID } from "crypto";
import { GoogleGenAI } from "@google/genai";
import {
  toolDeclarations,
  flattenParts,
  type JsonObject,
  type AgentHistoryContent,
  type ToolMessage,
  type SendMessageResult,
} from "./toolDeclarations";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

export function getAgentProviderConfigError(): string | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return "GEMINI_API_KEY (or GOOGLE_API_KEY) is not set";
  }
  return null;
}

function toGeminiRole(role: AgentHistoryContent["role"]): "user" | "model" {
  if (role === "model" || role === "assistant") return "model";
  return "user";
}

export function createChat(systemInstruction: string, history?: AgentHistoryContent[]): { sendMessage: (payload: { message: string | ToolMessage[] }) => Promise<SendMessageResult> } {
  const ai = getAI();

  const geminiHistory: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  for (const item of history ?? []) {
    const content = flattenParts(item.parts);
    if (!content) continue;
    if (item.role === "system") continue;
    geminiHistory.push({
      role: toGeminiRole(item.role),
      parts: [{ text: content }],
    });
  }

  const chat = ai.chats.create({
    model: GEMINI_MODEL,
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: toolDeclarations }],
    },
    history: geminiHistory,
  });

  return {
    async sendMessage(payload: { message: string | ToolMessage[] }): Promise<SendMessageResult> {
      let response;

      if (typeof payload.message === "string") {
        response = await chat.sendMessage({ message: payload.message });
      } else {
        const parts = payload.message.map((item) => ({
          functionResponse: {
            name: item.functionResponse.name,
            response: item.functionResponse.response ?? {},
            id: item.functionResponse.id || randomUUID(),
          },
        }));
        response = await chat.sendMessage({ message: parts });
      }

      const text = response.text ?? "";
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        return {
          text,
          functionCalls: functionCalls.map((fc) => ({
            id: fc.id || randomUUID(),
            name: fc.name,
            args: (fc.args as JsonObject | undefined) ?? {},
          })),
        };
      }

      return { text };
    },
  };
}

export const AGENT_MODEL = GEMINI_MODEL;
