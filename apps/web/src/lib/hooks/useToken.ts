"use client";

import { useState, useEffect, useCallback } from "react";
import { type Address } from "viem";
import { createClient, getDefaultStablecoin, getStablecoinConfig, type StablecoinSymbol } from "../config";
import { ERC20_ABI } from "../abi";

export function useTokenInfo(currency?: StablecoinSymbol) {
  const token = currency ? getStablecoinConfig(currency) : getDefaultStablecoin();
  return { symbol: token.symbol, decimals: token.decimals, tokenAddress: token.tokenAddress, isLoading: false };
}

function useTokenBalance(address: Address | null, tokenAddress: Address | null) {
  const [balance, setBalance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address || !tokenAddress) {
      setBalance(0n);
      return;
    }

    setIsLoading(true);
    try {
      const client = createClient();
      const result = await client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      setBalance(result as bigint);
    } catch {
      setBalance(0n);
    } finally {
      setIsLoading(false);
    }
  }, [address, tokenAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, isLoading, refetch: fetchBalance };
}

function useTokenAllowance(owner: Address | null, spender: Address | null, tokenAddress: Address | null) {
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllowance = useCallback(async () => {
    if (!owner || !spender || !tokenAddress) {
      setAllowance(0n);
      return;
    }

    setIsLoading(true);
    try {
      const client = createClient();
      const result = await client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner, spender],
      });
      setAllowance(result as bigint);
    } catch {
      setAllowance(0n);
    } finally {
      setIsLoading(false);
    }
  }, [owner, spender, tokenAddress]);

  useEffect(() => {
    fetchAllowance();
  }, [fetchAllowance]);

  return { allowance, isLoading, refetch: fetchAllowance };
}

// Pre-purchase validation hook
export function usePurchaseValidation(
  userAddress: Address | null,
  escrowAddress: Address | null,
  tokenAddress: Address | null,
  totalAmount: bigint
) {
  const { balance, refetch: refetchBalance } = useTokenBalance(userAddress, tokenAddress);
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(userAddress, escrowAddress, tokenAddress);

  const hasEnoughBalance = balance >= totalAmount;
  const hasEnoughAllowance = allowance >= totalAmount;
  const needsApproval = !hasEnoughAllowance;

  const refetch = useCallback(() => {
    refetchBalance();
    refetchAllowance();
  }, [refetchBalance, refetchAllowance]);

  return {
    balance,
    allowance,
    hasEnoughBalance,
    hasEnoughAllowance,
    needsApproval,
    refetch,
  };
}
