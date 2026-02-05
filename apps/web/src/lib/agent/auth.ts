export interface AgentAuthPayload {
  sessionId: string;
  nonce: string;
  timestamp: number;
}

export const AGENT_AUTH_MESSAGE_PREFIX = "Wagyu Escrow Agent Authentication";

export function buildAgentAuthMessage({
  sessionId,
  nonce,
  timestamp,
}: AgentAuthPayload): string {
  return [
    AGENT_AUTH_MESSAGE_PREFIX,
    `Session: ${sessionId}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}
