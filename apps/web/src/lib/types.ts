import type { Address, Hash } from "viem";

// v2: Milestone (code-based for contract size optimization)
export interface Milestone {
  code: number;
  bps: bigint;
  completed: boolean;
  name: string; // Generated from code + categoryType
}

// v2: Escrow Info (from getInfo())
export interface EscrowInfo {
  factory: Address;
  tokenAddress: Address;
  producer: Address;
  buyer: Address;
  tokenId: bigint;
  totalAmount: bigint;
  releasedAmount: bigint;
  locked: boolean;
  category: string;
  title: string;
  description: string;
  imageURI: string;
  status: "open" | "locked" | "active" | "completed" | "cancelled";
}

// V6: Listing summary (for list display)
export interface ListingSummary {
  escrowAddress: Address;
  tokenId: bigint;
  producer: Address;
  buyer: Address;
  totalAmount: bigint;
  releasedAmount: bigint;
  locked: boolean;
  category: string;
  title: string;
  description: string;
  imageURI: string;
  status: "open" | "locked" | "active" | "completed" | "cancelled";
  progress: {
    completed: number;
    total: number;
  };
}

// V6: Event types
export type EventType = "Locked" | "Approved" | "Cancelled" | "Completed" | "DeliveryConfirmed";

export interface TimelineEvent {
  type: EventType;
  txHash: Hash;
  blockNumber: bigint;
  timestamp?: number;
  // Locked
  buyer?: Address;
  amount?: bigint;
  // Completed
  index?: bigint;
}

// v2: User role (no admin)
export type UserRole = "buyer" | "producer" | "none";

// Legacy types for backward compatibility
export enum MilestoneState {
  PENDING = 0,
  COMPLETED = 1,
}

export interface LegacyMilestone {
  code: string;
  bps: bigint;
  state: MilestoneState;
  evidenceHash: Hash;
  evidenceText: string;
  completedAt: bigint;
  releasedAmount: bigint;
}

export interface ContractSummary {
  token: Address;
  buyer: Address;
  producer: Address;
  admin: Address;
  totalAmount: bigint;
  lockedAmount: bigint;
  releasedAmount: bigint;
  refundedAmount: bigint;
  cancelled: boolean;
  milestonesCount: bigint;
}
