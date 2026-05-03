"use client";

import { useState, useEffect, useCallback } from "react";
import { type Address, type Hash } from "viem";
import {
  createClient,
  createWallet,
  ensureWalletChain,
  getConfiguredStablecoins,
  getMetaMaskProvider,
  getStablecoinConfig,
  type StablecoinConfig,
  type StablecoinSymbol,
} from "../config";
import { FACTORY_ABI, ESCROW_ABI } from "../abi";
import { formatTxError, getRecommendedGasFees, writeContractWithGasFallback } from "../tx";
import type { EscrowStatus, ListingSummary } from "../types";

type ListingPointer = {
  escrowAddress: Address;
  stablecoin: StablecoinConfig;
};

function useListings() {
  const [listings, setListings] = useState<ListingPointer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    const stablecoins = getConfiguredStablecoins();
    if (stablecoins.length === 0) {
      setListings([]);
      setError("JPYC/USDC factory addresses are not configured");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createClient();
      const results = await Promise.all(
        stablecoins.map(async (stablecoin) => {
          const addresses = (await client.readContract({
            address: stablecoin.factoryAddress,
            abi: FACTORY_ABI,
            functionName: "getListings",
          })) as Address[];

          return addresses.map((escrowAddress) => ({ escrowAddress, stablecoin }));
        }),
      );
      setListings(results.flat());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch listings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, isLoading, error, refetch: fetchListings };
}

export function useListingSummaries() {
  const { listings, isLoading: listingsLoading, error: listingsError, refetch } = useListings();
  const [summaries, setSummaries] = useState<ListingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummaries = async () => {
      if (listings.length === 0) {
        setSummaries([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const client = createClient();
        const summaryPromises = listings.map(async ({ escrowAddress, stablecoin }) => {
          try {
            const [core, meta, progress] = await Promise.all([
              client.readContract({
                address: escrowAddress,
                abi: ESCROW_ABI,
                functionName: "getCore",
              }),
              client.readContract({
                address: escrowAddress,
                abi: ESCROW_ABI,
                functionName: "getMeta",
              }),
              client.readContract({
                address: escrowAddress,
                abi: ESCROW_ABI,
                functionName: "getProgress",
              }),
            ]) as [
              [Address, Address, Address, Address, bigint, bigint, bigint, number, bigint],
              [string, string, string, string],
              [bigint, bigint]
            ];

            const [, , producer, buyer, tokenId, totalAmount, releasedAmount, statusEnum, cancelCount] = core;
            const [title, description, imageURI, status] = meta;

            return {
              escrowAddress,
              factoryAddress: stablecoin.factoryAddress,
              currency: stablecoin.currency,
              symbol: stablecoin.symbol,
              decimals: stablecoin.decimals,
              tokenAddress: stablecoin.tokenAddress,
              tokenId,
              producer,
              buyer,
              totalAmount,
              releasedAmount,
              cancelCount,
              locked: statusEnum >= 1,
              title,
              description,
              imageURI,
              status: status as EscrowStatus,
              progress: {
                completed: Number(progress[0]),
                total: Number(progress[1]),
              },
            };
          } catch {
            return null;
          }
        });

        const results = await Promise.all(summaryPromises);
        setSummaries(results.filter((s): s is ListingSummary => s !== null));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch summaries");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummaries();
  }, [listings]);

  return {
    summaries,
    isLoading: listingsLoading || isLoading,
    error: listingsError || error,
    refetch,
  };
}

export function useCreateListing(onSuccess?: () => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);

  const createListing = useCallback(
    async (
      title: string,
      description: string,
      totalAmount: bigint,
      imageURI: string,
      currency: StablecoinSymbol,
    ) => {
      setIsLoading(true);
      setError(null);
      setTxHash(null);

      try {
        const provider = getMetaMaskProvider();
        if (!provider) throw new Error("ログインが必要です");
        await ensureWalletChain(provider);
        const wallet = createWallet(provider);
        const client = createClient();
        if (!wallet) throw new Error("ログインが必要です");

        const [account] = await wallet.getAddresses();
        const stablecoin = getStablecoinConfig(currency);
        if (!stablecoin.factoryAddress) {
          throw new Error(`${currency} Factory address not configured`);
        }

        const gasFees = await getRecommendedGasFees(client);
        const hash = await writeContractWithGasFallback(wallet, {
          address: stablecoin.factoryAddress,
          abi: FACTORY_ABI,
          functionName: "createListing",
          args: [title, description, totalAmount, imageURI],
          account,
          ...gasFees,
        });

        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          throw new Error("出品登録に失敗しました");
        }
        setTxHash(hash);
        onSuccess?.();
      } catch (err) {
        setError(
          formatTxError(
            err,
            "出品に失敗しました",
            "出品処理をキャンセルしました。MetaMaskで承認すると実行されます。",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess]
  );

  return { createListing, isLoading, error, txHash };
}
