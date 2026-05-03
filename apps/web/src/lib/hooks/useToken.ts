"use client";

import { useState, useEffect, useCallback } from "react";
import { type Address } from "viem";
import { createClient, getDefaultStablecoin, getStablecoinConfig, type StablecoinSymbol } from "../config";
import { ERC20_ABI } from "../abi";

type TokenReadError = "missing-token-contract" | "read-failed";

const getTokenReadError = (error: unknown): TokenReadError => {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("does not have any code")
    ? "missing-token-contract"
    : "read-failed";
};

export function useTokenInfo(currency?: StablecoinSymbol) {
  const token = currency ? getStablecoinConfig(currency) : getDefaultStablecoin();
  return { symbol: token.symbol, decimals: token.decimals, tokenAddress: token.tokenAddress, isLoading: false };
}

function useTokenBalance(address: Address | null, tokenAddress: Address | null) {
  const [balance, setBalance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TokenReadError | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!address || !tokenAddress) {
      setBalance(0n);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const client = createClient();
      const result = await client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      setBalance(result as bigint);
    } catch (err) {
      setBalance(0n);
      setError(getTokenReadError(err));
    } finally {
      setIsLoading(false);
    }
  }, [address, tokenAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, isLoading, error, refetch: fetchBalance };
}

function useTokenAllowance(owner: Address | null, spender: Address | null, tokenAddress: Address | null) {
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TokenReadError | null>(null);

  const fetchAllowance = useCallback(async () => {
    if (!owner || !spender || !tokenAddress) {
      setAllowance(0n);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const client = createClient();
      const result = await client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner, spender],
      });
      setAllowance(result as bigint);
    } catch (err) {
      setAllowance(0n);
      setError(getTokenReadError(err));
    } finally {
      setIsLoading(false);
    }
  }, [owner, spender, tokenAddress]);

  useEffect(() => {
    fetchAllowance();
  }, [fetchAllowance]);

  return { allowance, isLoading, error, refetch: fetchAllowance };
}

// Pre-purchase validation hook
export function usePurchaseValidation(
  userAddress: Address | null,
  escrowAddress: Address | null,
  tokenAddress: Address | null,
  totalAmount: bigint
) {
  const {
    balance,
    isLoading: isBalanceLoading,
    error: balanceError,
    refetch: refetchBalance,
  } = useTokenBalance(userAddress, tokenAddress);
  const {
    allowance,
    isLoading: isAllowanceLoading,
    error: allowanceError,
    refetch: refetchAllowance,
  } = useTokenAllowance(userAddress, escrowAddress, tokenAddress);

  const hasEnoughBalance = !balanceError && balance >= totalAmount;
  const hasEnoughAllowance = !allowanceError && allowance >= totalAmount;
  const needsApproval = !hasEnoughAllowance;

  const refetch = useCallback(() => {
    refetchBalance();
    refetchAllowance();
  }, [refetchBalance, refetchAllowance]);

  return {
    balance,
    allowance,
    isLoading: isBalanceLoading || isAllowanceLoading,
    balanceIsLoading: isBalanceLoading,
    allowanceIsLoading: isAllowanceLoading,
    balanceError,
    allowanceError,
    hasEnoughBalance,
    hasEnoughAllowance,
    needsApproval,
    refetch,
  };
}
