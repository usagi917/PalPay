import {
  toolDeclarations,
  type JsonObject,
  type AgentHistoryContent,
  flattenParts,
} from "./toolDeclarations";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-nano";
const OPENAI_API_BASE_URL =
  process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";

// ---------- Type definitions for Responses API ----------

type ResponseInputItem =
  | { type: "message"; role: "user" | "system" | "developer"; content: string }
  | {
      type: "function_call";
      id: string;
      call_id: string;
      name: string;
      arguments: string;
    }
  | {
      type: "function_call_output";
      call_id: string;
      output: string;
    };

export type ResponseInput = ResponseInputItem;

type ResponseTool = {
  type: "function";
  name: string;
  description: string;
  parameters: JsonObject;
  strict: false;
};

// Events we emit from the parser (subset of all OpenAI SSE events)
export type ResponseStreamEvent =
  | { type: "response.output_text.delta"; delta: string }
  | {
      type: "response.function_call_arguments.done";
      item_id: string;
      call_id: string;
      name: string;
      arguments: string;
    }
  | {
      type: "response.output_item.done";
      item: {
        type: string;
        id: string;
        call_id?: string;
        name?: string;
        arguments?: string;
        content?: Array<{ type: string; text: string }>;
      };
    }
  | {
      type: "response.completed";
      response: {
        id: string;
        output: Array<{
          type: string;
          id: string;
          call_id?: string;
          name?: string;
          arguments?: string;
          content?: Array<{ type: string; text: string }>;
        }>;
      };
    }
  | { type: "error"; message: string };

// ---------- Tool format conversion ----------

const responsesTools: ResponseTool[] = toolDeclarations.map((tool) => ({
  type: "function",
  name: tool.name,
  description: tool.description,
  parameters: tool.parametersJsonSchema,
  strict: false,
}));

// ---------- History conversion ----------

export function historyToInput(history: AgentHistoryContent[]): ResponseInput[] {
  const items: ResponseInput[] = [];
  for (const entry of history) {
    const text = flattenParts(entry.parts);
    if (!text) continue;
    const role = entry.role === "model" || entry.role === "assistant" ? "user" : entry.role;
    // Responses API only accepts "user", "system", "developer" for message items.
    // Model/assistant turns are excluded — tracked by previous_response_id chain.
    if (role === "user" || role === "system") {
      items.push({ type: "message", role, content: text });
    }
  }
  return items;
}

// ---------- Config check ----------

export function getAgentProviderConfigError(): string | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return "OPENAI_API_KEY is not set";
  }
  return null;
}

// ---------- SSE stream parser ----------

// Internal type for tracking function call items as they stream
type FunctionCallItem = {
  id: string;
  call_id: string;
  name: string;
  arguments: string;
};

async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ResponseStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Track function call items by item_id so we can enrich later events
  const functionCallItems = new Map<string, FunctionCallItem>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentData = "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          currentData += (currentData ? "\n" : "") + line.slice(6);
        } else if (line === "" && currentData) {
          // Empty line = end of SSE event block
          try {
            const parsed = JSON.parse(currentData) as Record<string, unknown>;
            const eventType = parsed.type as string;

            switch (eventType) {
              // --- Text deltas ---
              case "response.output_text.delta": {
                yield {
                  type: "response.output_text.delta",
                  delta: (parsed.delta as string) || "",
                };
                break;
              }

              // --- Function call: item added (contains call_id & name) ---
              case "response.output_item.added": {
                const item = parsed.item as Record<string, unknown> | undefined;
                if (item && item.type === "function_call") {
                  functionCallItems.set(item.id as string, {
                    id: item.id as string,
                    call_id: (item.call_id as string) || "",
                    name: (item.name as string) || "",
                    arguments: "",
                  });
                }
                break;
              }

              // --- Function call: arguments building (delta) ---
              case "response.function_call_arguments.delta": {
                const itemId = parsed.item_id as string;
                const tracked = functionCallItems.get(itemId);
                if (tracked) {
                  tracked.arguments += (parsed.delta as string) || "";
                }
                break;
              }

              // --- Function call: arguments complete ---
              case "response.function_call_arguments.done": {
                const itemId = parsed.item_id as string;
                const tracked = functionCallItems.get(itemId);
                const finalArgs = (parsed.arguments as string) || "{}";
                if (tracked) {
                  tracked.arguments = finalArgs;
                }
                yield {
                  type: "response.function_call_arguments.done",
                  item_id: itemId,
                  call_id: tracked?.call_id || "",
                  name: tracked?.name || "",
                  arguments: finalArgs,
                };
                break;
              }

              // --- Output item done ---
              case "response.output_item.done": {
                const item = parsed.item as Record<string, unknown> | undefined;
                if (item) {
                  yield {
                    type: "response.output_item.done",
                    item: {
                      type: (item.type as string) || "",
                      id: (item.id as string) || "",
                      call_id: item.call_id as string | undefined,
                      name: item.name as string | undefined,
                      arguments: item.arguments as string | undefined,
                      content: item.content as Array<{ type: string; text: string }> | undefined,
                    },
                  };
                }
                break;
              }

              // --- Response completed ---
              case "response.completed": {
                const resp = parsed.response as Record<string, unknown> | undefined;
                if (resp) {
                  yield {
                    type: "response.completed",
                    response: {
                      id: (resp.id as string) || "",
                      output: (resp.output as Array<Record<string, unknown>> || []).map((o) => ({
                        type: (o.type as string) || "",
                        id: (o.id as string) || "",
                        call_id: o.call_id as string | undefined,
                        name: o.name as string | undefined,
                        arguments: o.arguments as string | undefined,
                        content: o.content as Array<{ type: string; text: string }> | undefined,
                      })),
                    },
                  };
                }
                break;
              }

              // --- Errors ---
              case "error": {
                yield {
                  type: "error",
                  message: (parsed.message as string) || JSON.stringify(parsed),
                };
                break;
              }

              // All other event types (response.created, response.in_progress, etc.) are ignored
            }
          } catch {
            // Skip unparseable data lines
          }
          currentData = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------- Main streaming function ----------

export async function* streamResponse(opts: {
  instructions: string;
  input: ResponseInput[];
  previousResponseId?: string;
}): AsyncGenerator<ResponseStreamEvent> {
  const configError = getAgentProviderConfigError();
  if (configError) {
    throw new Error(configError);
  }
  const apiKey = process.env.OPENAI_API_KEY!;

  const requestBody: Record<string, unknown> = {
    model: OPENAI_MODEL,
    instructions: opts.instructions,
    input: opts.input,
    tools: responsesTools,
    stream: true,
    store: true,
  };

  if (opts.previousResponseId) {
    requestBody.previous_response_id = opts.previousResponseId;
  }

  const response = await fetch(`${OPENAI_API_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Responses API error (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error("OpenAI Responses API returned no body");
  }

  yield* parseSSEStream(response.body);
}

// ---------- Helper: continue with function call outputs ----------

export async function* continueWithToolOutputs(opts: {
  instructions: string;
  previousResponseId: string;
  toolOutputs: Array<{ call_id: string; output: string }>;
}): AsyncGenerator<ResponseStreamEvent> {
  const input: ResponseInput[] = opts.toolOutputs.map((o) => ({
    type: "function_call_output" as const,
    call_id: o.call_id,
    output: o.output,
  }));

  yield* streamResponse({
    instructions: opts.instructions,
    input,
    previousResponseId: opts.previousResponseId,
  });
}

export const AGENT_MODEL = OPENAI_MODEL;
