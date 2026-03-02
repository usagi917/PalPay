"use client";

import { useState, useEffect, useCallback } from "react";
import { type Address } from "viem";
import { createClient, config } from "../config";
import { ERC20_ABI } from "../abi";

export function useTokenInfo() {
  const [symbol, setSymbol] = useState<string>("");
  const [decimals, setDecimals] = useState<number>(18);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!config.tokenAddress) return;

      setIsLoading(true);
      try {
        const client = createClient();
        const [symbolResult, decimalsResult] = await Promise.all([
          client.readContract({
            address: config.tokenAddress,
            abi: ERC20_ABI,
            functionName: "symbol",
          }),
          client.readContract({
            address: config.tokenAddress,
            abi: ERC20_ABI,
            functionName: "decimals",
          }),
        ]);
        setSymbol(symbolResult as string);
        setDecimals(decimalsResult as number);
      } catch {
        // Use defaults
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokenInfo();
  }, []);

  return { symbol, decimals, isLoading };
}

export function useTokenBalance(address: Address | null) {
  const [balance, setBalance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address || !config.tokenAddress) {
      setBalance(0n);
      return;
    }

    setIsLoading(true);
    try {
      const client = createClient();
      const result = await client.readContract({
        address: config.tokenAddress,
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
  }, [address]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, isLoading, refetch: fetchBalance };
}

export function useTokenAllowance(owner: Address | null, spender: Address | null) {
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllowance = useCallback(async () => {
    if (!owner || !spender || !config.tokenAddress) {
      setAllowance(0n);
      return;
    }

    setIsLoading(true);
    try {
      const client = createClient();
      const result = await client.readContract({
        address: config.tokenAddress,
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
  }, [owner, spender]);

  useEffect(() => {
    fetchAllowance();
  }, [fetchAllowance]);

  return { allowance, isLoading, refetch: fetchAllowance };
}

// Pre-purchase validation hook
export function usePurchaseValidation(
  userAddress: Address | null,
  escrowAddress: Address | null,
  totalAmount: bigint
) {
  const { balance, refetch: refetchBalance } = useTokenBalance(userAddress);
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(userAddress, escrowAddress);

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
