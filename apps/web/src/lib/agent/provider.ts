import * as openaiProvider from "./openai";
import * as geminiProvider from "./gemini";
import * as openaiResponsesProvider from "./openaiResponses";
export type { AgentHistoryContent } from "./toolDeclarations";

type Provider = typeof openaiProvider;

export const AGENT_PROVIDER = (process.env.AGENT_PROVIDER || "openai-responses").toLowerCase();

function getProvider(): Provider {
  switch (AGENT_PROVIDER) {
    case "gemini":
      return geminiProvider;
    case "openai":
      return openaiProvider;
    case "openai-responses":
      // openai-responses provider exports streaming functions, not createChat.
      // For backward-compat non-streaming path, fall back to openai provider.
      return openaiProvider;
    default:
      console.warn(`Unknown AGENT_PROVIDER "${AGENT_PROVIDER}", falling back to openai`);
      return openaiProvider;
  }
}

const provider = getProvider();

export const createChat = provider.createChat;
export const getAgentProviderConfigError =
  AGENT_PROVIDER === "openai-responses"
    ? openaiResponsesProvider.getAgentProviderConfigError
    : provider.getAgentProviderConfigError;
export const AGENT_MODEL =
  AGENT_PROVIDER === "openai-responses"
    ? openaiResponsesProvider.AGENT_MODEL
    : provider.AGENT_MODEL;

// Re-export streaming functions for openai-responses
export {
  streamResponse,
  continueWithToolOutputs,
  historyToInput,
} from "./openaiResponses";
export type { ResponseInput, ResponseStreamEvent } from "./openaiResponses";
