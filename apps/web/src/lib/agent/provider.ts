import * as openaiProvider from "./openai";
import * as geminiProvider from "./gemini";
export type { AgentHistoryContent } from "./toolDeclarations";

type Provider = typeof openaiProvider;

const AGENT_PROVIDER = (process.env.AGENT_PROVIDER || "openai").toLowerCase();

function getProvider(): Provider {
  switch (AGENT_PROVIDER) {
    case "gemini":
      return geminiProvider;
    case "openai":
      return openaiProvider;
    default:
      console.warn(`Unknown AGENT_PROVIDER "${AGENT_PROVIDER}", falling back to openai`);
      return openaiProvider;
  }
}

const provider = getProvider();

export const createChat = provider.createChat;
export const getAgentProviderConfigError = provider.getAgentProviderConfigError;
export const AGENT_MODEL = provider.AGENT_MODEL;
