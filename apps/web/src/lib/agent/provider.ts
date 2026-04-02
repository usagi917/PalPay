import * as openaiResponsesProvider from "./openaiResponses";
export type { AgentHistoryContent } from "./toolDeclarations";

export const AGENT_PROVIDER = "openai-responses";
export const getAgentProviderConfigError = openaiResponsesProvider.getAgentProviderConfigError;
export const AGENT_MODEL = openaiResponsesProvider.AGENT_MODEL;

// Re-export streaming functions for openai-responses
export {
  streamResponse,
  continueWithToolOutputs,
  historyToInput,
} from "./openaiResponses";
export type { ResponseInput, ResponseStreamEvent } from "./openaiResponses";
