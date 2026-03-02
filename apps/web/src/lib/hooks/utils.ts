import { type Address } from "viem";
import type { EscrowInfo, UserRole } from "../types";

export function formatAmount(amount: bigint, decimals: number, symbol: string): string {
  if (decimals <= 0) {
    return `${amount.toString()} ${symbol}`;
  }
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === 0n) {
    return `${whole.toString()} ${symbol}`;
  }
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole}.${fractionStr} ${symbol}`;
}

export function getUserRole(userAddress: Address | null, info: EscrowInfo | null): UserRole {
  if (!userAddress || !info) return "none";
  const lower = userAddress.toLowerCase();
  if (lower === info.buyer.toLowerCase()) return "buyer";
  if (lower === info.producer.toLowerCase()) return "producer";
  return "none";
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Check if user can access chat for an escrow
 * Returns true if:
 * - Escrow is not OPEN (payment made)
 * - User is the producer OR the current NFT owner
 */
export function canAccessChat(
  userAddress: Address | null,
  info: EscrowInfo | null,
  nftOwner: Address | null
): boolean {
  if (!userAddress || !info) return false;

  // Must be paid (not OPEN, not CANCELLED)
  if (info.status === "open" || info.status === "cancelled") return false;

  const lower = userAddress.toLowerCase();

  // Producer can always chat
  if (lower === info.producer.toLowerCase()) return true;

  // Current NFT owner can chat
  if (nftOwner && lower === nftOwner.toLowerCase()) return true;

  return false;
}
