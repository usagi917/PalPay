"use client";

import { useState, useEffect, useCallback } from "react";
import { type Address } from "viem";
import { createClient, config } from "../config";
import { FACTORY_ABI } from "../abi";

/**
 * Get current NFT owner from Factory contract
 * Used to determine chat access after NFT transfer
 */
export function useNftOwner(tokenId: bigint | null) {
  const [owner, setOwner] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (tokenId === null) {
      setOwner(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createClient();
      const result = await client.readContract({
        address: config.factoryAddress,
        abi: FACTORY_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      }) as Address;

      setOwner(result);
    } catch (err) {
      console.error("Failed to get NFT owner:", err);
      setError(err instanceof Error ? err.message : "NFT所有者の取得に失敗しました");
      setOwner(null);
    } finally {
      setIsLoading(false);
    }
  }, [tokenId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { owner, isLoading, error, refetch: fetch };
}
