import { randomUUID } from "crypto";
import {
  toolDeclarations,
  flattenParts,
  type JsonObject,
  type AgentHistoryContent,
  type ToolMessage,
  type SendMessageResult,
} from "./toolDeclarations";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type OpenAIMessage =
  | { role: "system" | "user" | "assistant"; content: string; tool_calls?: OpenAIToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
};

type OpenAIMessageContent = string | Array<{ type?: string; text?: string }> | null | undefined;

function toOpenAIRole(role: AgentHistoryContent["role"]): "system" | "user" | "assistant" {
  if (role === "model" || role === "assistant") return "assistant";
  if (role === "system") return "system";
  return "user";
}

function parseTextContent(content: OpenAIMessageContent): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (!item || typeof item.text !== "string") return "";
      // Some model variants return part types like "output_text".
      if (item.type === "text" || item.type === "output_text" || !item.type) return item.text;
      return "";
    })
    .join("");
}

function parseToolArguments(argumentsText: string): JsonObject {
  try {
    const parsed = JSON.parse(argumentsText) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
}

export function getAgentProviderConfigError(): string | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return "OPENAI_API_KEY is not set";
  }
  return null;
}

async function callOpenAI(messages: OpenAIMessage[], tools: Array<{ type: "function"; function: { name: string; description: string; parameters: JsonObject } }>): Promise<{
  text: string;
  toolCalls: OpenAIToolCall[];
}> {
  const configError = getAgentProviderConfigError();
  if (configError) {
    throw new Error(configError);
  }
  const apiKey = process.env.OPENAI_API_KEY!;

  const response = await fetch(`${OPENAI_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      tools,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse;
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("OpenAI API returned no choices");
  }

  const text = parseTextContent(message.content);
  const toolCalls: OpenAIToolCall[] = (message.tool_calls ?? [])
    .filter((toolCall) => toolCall.type === "function" && toolCall.function?.name)
    .map((toolCall) => {
      const id = toolCall.id || `call_${randomUUID()}`;
      return {
        id,
        type: "function",
        function: {
          name: toolCall.function?.name || "",
          arguments: typeof toolCall.function?.arguments === "string" ? toolCall.function.arguments : "{}",
        },
      };
    });

  return { text, toolCalls };
}

const openAITools = toolDeclarations.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parametersJsonSchema,
  },
}));

export function createChat(systemInstruction: string, history?: AgentHistoryContent[]): { sendMessage: (payload: { message: string | ToolMessage[] }) => Promise<SendMessageResult> } {
  const messages: OpenAIMessage[] = [{ role: "system", content: systemInstruction }];

  for (const item of history ?? []) {
    const content = flattenParts(item.parts);
    if (!content) continue;
    messages.push({
      role: toOpenAIRole(item.role),
      content,
    });
  }

  return {
    async sendMessage(payload: { message: string | ToolMessage[] }): Promise<SendMessageResult> {
      if (typeof payload.message === "string") {
        messages.push({ role: "user", content: payload.message });
      } else {
        for (const item of payload.message) {
          const toolCallId = item.functionResponse.id || `call_${randomUUID()}`;
          messages.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: JSON.stringify(item.functionResponse.response ?? {}),
          });
        }
      }

      const { text, toolCalls } = await callOpenAI(messages, openAITools);

      if (toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: text,
          tool_calls: toolCalls,
        });

        return {
          text,
          functionCalls: toolCalls.map((toolCall) => ({
            id: toolCall.id,
            name: toolCall.function.name,
            args: parseToolArguments(toolCall.function.arguments),
          })),
        };
      }

      messages.push({ role: "assistant", content: text });
      return { text };
    },
  };
}

export const AGENT_MODEL = OPENAI_MODEL;
