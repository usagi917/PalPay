import { randomUUID } from "crypto";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";

type JsonObject = Record<string, unknown>;

export type AgentHistoryContent = {
  role: "user" | "model" | "assistant" | "system";
  parts: Array<{ text?: string }>;
};

type FunctionDeclaration = {
  name: string;
  description: string;
  parametersJsonSchema: JsonObject;
};

type ToolMessage = {
  functionResponse: {
    id: string;
    name: string;
    response: JsonObject;
  };
};

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
  if (role === "model") return "assistant";
  if (role === "assistant") return "assistant";
  if (role === "system") return "system";
  return "user";
}

function flattenParts(parts: Array<{ text?: string }>): string {
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
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

// Tool declarations using JSON Schema format
const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_listings",
    description: "出品一覧を取得します。カテゴリや状態でフィルタリングできます。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "カテゴリでフィルタ (wagyu, sake, craft)",
        },
        status: {
          type: "string",
          description: "状態でフィルタ (open, locked, active, completed, cancelled)",
        },
        limit: {
          type: "number",
          description: "取得件数の上限（デフォルト: 10）",
        },
      },
    },
  },
  {
    name: "get_listing_detail",
    description: "特定の出品の詳細情報を取得します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        escrowAddress: {
          type: "string",
          description: "出品（取引管理）のアドレス",
        },
        tokenId: {
          type: "string",
          description: "トークンID",
        },
      },
      required: ["escrowAddress"],
    },
  },
  {
    name: "prepare_listing_draft",
    description: "出品ドラフトを生成します。ユーザーの説明から出品情報を構造化します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "カテゴリ (wagyu, sake, craft)",
        },
        title: {
          type: "string",
          description: "出品タイトル（例: 神戸牛A5ランク）",
        },
        description: {
          type: "string",
          description: "出品の詳細説明",
        },
        totalAmount: {
          type: "string",
          description: "総額（JPYC単位、例: 500000）",
        },
        imageURI: {
          type: "string",
          description: "画像URI（オプション）",
        },
      },
      required: ["category", "title", "description", "totalAmount"],
    },
  },
  {
    name: "get_milestones_for_category",
    description: "指定カテゴリのマイルストーン（進捗ベース支払い条件）を取得します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "カテゴリ (wagyu, sake, craft)",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "prepare_transaction",
    description: "操作を準備し、確認UIを表示します。実際の確認はユーザーが行います。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "操作の種類 (createListing, lock, approve, cancel, confirmDelivery)",
        },
        escrowAddress: {
          type: "string",
          description: "対象の取引アドレス（createListing以外で必要）",
        },
        amount: {
          type: "string",
          description: "lock時に必要なJPYC金額（例: 500000）。省略時は出品情報から補完されます。",
        },
        draft: {
          type: "object",
          description: "出品ドラフト（createListingの場合）",
          properties: {
            category: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            totalAmount: { type: "string" },
            imageURI: { type: "string" },
          },
        },
      },
      required: ["action"],
    },
  },
  {
    name: "analyze_market",
    description: "カテゴリ別の市場分析・価格提案を行います。出品数、平均価格、中央値、最高値、最低値を算出します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "分析対象のカテゴリ (wagyu, sake, craft)。省略時は全カテゴリ。",
        },
      },
    },
  },
  {
    name: "assess_risk",
    description: "特定の出品または出品者の購入リスクを評価します。出品者の過去実績（完了率、キャンセル率）を分析しリスクスコアを返します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        escrowAddress: {
          type: "string",
          description: "評価対象の出品アドレス",
        },
        producerAddress: {
          type: "string",
          description: "評価対象の出品者アドレス（escrowAddressがない場合に使用）",
        },
      },
    },
  },
  {
    name: "suggest_next_action",
    description: "ユーザーの現在の状況を分析し、次に取るべきアクションを提案します。Producer/Buyer両方の役割で保有リスティングの状態を確認します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        userAddress: {
          type: "string",
          description: "ユーザーのアカウントアドレス",
        },
      },
      required: ["userAddress"],
    },
  },
];

const openAITools = toolDeclarations.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parametersJsonSchema,
  },
}));

// Create a chat session wrapper compatible with the previous provider interface.
export function createChat(systemInstruction: string, history?: AgentHistoryContent[]) {
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
    async sendMessage(payload: { message: string | ToolMessage[] }): Promise<{
      text?: string;
      functionCalls?: Array<{ id?: string; name?: string; args?: JsonObject }>;
    }> {
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
// Backward-compatible export name.
export const GEMINI_MODEL = OPENAI_MODEL;
export { OPENAI_MODEL };
