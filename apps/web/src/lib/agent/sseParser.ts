/**
 * Client-side SSE parser.
 * Consumes a ReadableStream<Uint8Array> (from fetch response.body)
 * and yields parsed SSE events.
 */
export interface SSEEvent {
  event: string;
  data: string;
}

export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      let currentData = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          currentData += (currentData ? "\n" : "") + line.slice(6);
        } else if (line === "" && currentData) {
          yield {
            event: currentEvent || "message",
            data: currentData,
          };
          currentEvent = "";
          currentData = "";
        }
      }
    }

    // Flush remaining
    if (buffer.trim()) {
      // Try to parse any remaining data
      const remaining = buffer.trim();
      if (remaining.startsWith("data: ")) {
        yield {
          event: "message",
          data: remaining.slice(6),
        };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
