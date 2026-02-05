import type { Address } from "viem";

// Agent state machine
export type AgentState =
  | "idle"
  | "gathering_info"
  | "draft_ready"
  | "awaiting_confirm"
  | "tx_prepared"
  | "completed";

// User role determined by wallet address
export type UserRole = "producer" | "buyer" | "none";

// Category types matching contract
export type CategoryType = "wagyu" | "sake" | "craft";
export const CATEGORY_TYPE_MAP: Record<CategoryType, number> = {
  wagyu: 0,
  sake: 1,
  craft: 2,
};

// Milestone preview for draft
export interface MilestonePreview {
  name: string;
  bps: number; // basis points (e.g., 1000 = 10%)
  description?: string;
}

// Listing draft (before contract creation)
export interface ListingDraft {
  category: CategoryType;
  title: string;
  description: string;
  totalAmount: string; // in JPYC (human readable)
  imageURI?: string;
  milestones: MilestonePreview[];
}

// Transaction preparation result
export interface TxPrepareResult {
  action: "createListing" | "lock" | "approve" | "cancel" | "confirmDelivery";
  escrowAddress?: Address;
  params?: Record<string, unknown>;
  estimatedGas?: string;
  requiresApproval?: boolean; // ERC20 approval needed
  approvalAmount?: string;
}

// Chat message types
export type MessageRole = "user" | "assistant" | "system";

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  draft?: ListingDraft;
  txPrepare?: TxPrepareResult;
}

// Session state
export interface AgentSession {
  id: string;
  state: AgentState;
  messages: ChatMessage[];
  draft?: ListingDraft;
  txPrepare?: TxPrepareResult;
  userAddress?: Address;
  userRole?: UserRole;
}

// API request/response types
export interface ChatRequest {
  message: string;
  sessionId: string;
  userAddress?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  state: AgentState;
  draft?: ListingDraft;
  txPrepare?: TxPrepareResult;
}

// Listing summary from blockchain
export interface ListingSummaryForAgent {
  escrowAddress: Address;
  tokenId: string;
  producer: Address;
  buyer: Address;
  totalAmount: string;
  status: string;
  category: string;
  title: string;
  description: string;
  imageURI: string;
  progress: {
    completed: number;
    total: number;
  };
}
