import type { Address, Hash } from "viem";
import type { StablecoinSymbol } from "./config";

export type EscrowStatus = "open" | "locked" | "active" | "completed";

// v2: Milestone (code-based for contract size optimization)
export interface Milestone {
  code: number;
  bps: bigint;
  completed: boolean;
  name: string;
}

// v2: Escrow Info (from getInfo())
export interface EscrowInfo {
  currency: StablecoinSymbol;
  symbol: StablecoinSymbol;
  decimals: number;
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
  title: string;
  description: string;
  imageURI: string;
  status: EscrowStatus;
}

// V6: Listing summary (for list display)
export interface ListingSummary {
  escrowAddress: Address;
  factoryAddress: Address;
  currency: StablecoinSymbol;
  symbol: StablecoinSymbol;
  decimals: number;
  tokenAddress: Address;
  tokenId: bigint;
  producer: Address;
  buyer: Address;
  totalAmount: bigint;
  releasedAmount: bigint;
  cancelCount: bigint;
  locked: boolean;
  title: string;
  description: string;
  imageURI: string;
  status: EscrowStatus;
  progress: {
    completed: number;
    total: number;
  };
}

// V6: Event types
type EventType =
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
