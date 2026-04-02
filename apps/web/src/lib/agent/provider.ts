import * as openaiProvider from "./openai";
import * as openaiResponsesProvider from "./openaiResponses";
export type { AgentHistoryContent } from "./toolDeclarations";

export const AGENT_PROVIDER = "openai-responses";
export const createChat = openaiProvider.createChat;
export const getAgentProviderConfigError = openaiResponsesProvider.getAgentProviderConfigError;

export {
  streamResponse,
  historyToInput,
} from "./openaiResponses";
export type { ResponseInput, ResponseStreamEvent } from "./openaiResponses";
