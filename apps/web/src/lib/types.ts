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
  cancelCount: bigint;
  lockedAt: bigint;
  finalRequestedAt: bigint;
  finalEvidenceHash: `0x${string}`;
  lockTimeout: bigint;
  finalConfirmTimeout: bigint;
  lockDeadline: bigint | null;
  finalConfirmationDeadline: bigint | null;
  locked: boolean;
  category: string;
  title: string;
  description: string;
  imageURI: string;
  status: "open" | "locked" | "active" | "completed";
}

// V6: Listing summary (for list display)
export interface ListingSummary {
  escrowAddress: Address;
  tokenId: bigint;
  producer: Address;
  buyer: Address;
  totalAmount: bigint;
  releasedAmount: bigint;
  cancelCount: bigint;
  locked: boolean;
  category: string;
  title: string;
  description: string;
  imageURI: string;
  status: "open" | "locked" | "active" | "completed";
  progress: {
    completed: number;
    total: number;
  };
}

// V6: Event types
export type EventType =
  | "Locked"
  | "Approved"
  | "Cancelled"
  | "Completed"
  | "DeliveryConfirmed"
  | "ActivatedAfterTimeout"
  | "FinalDeliveryRequested"
  | "FinalizedAfterTimeout";

export interface TimelineEvent {
  type: EventType;
  txHash: Hash;
  blockNumber: bigint;
  transactionIndex?: number;
  logIndex?: number;
  timestamp?: number;
  // Locked
  buyer?: Address;
  caller?: Address;
  amount?: bigint;
  // Completed
  index?: bigint;
  deadline?: bigint;
  evidenceHash?: Hash;
}

// v2: User role (no admin)
export type UserRole = "buyer" | "producer" | "none";
