"use client";

import { useMemo } from "react";
import { type Address } from "viem";
import { useListingSummaries } from "./useFactory";
import { type StablecoinSymbol } from "../config";

export function useMyListings(address: Address | null) {
  const { summaries, isLoading, error, refetch } = useListingSummaries();

  const myListings = useMemo(() => {
    if (!address) return { asProducer: [], asBuyer: [] };
    const lower = address.toLowerCase();
    return {
      asProducer: summaries.filter((s) => s.producer.toLowerCase() === lower),
      asBuyer: summaries.filter(
        (s) => s.buyer.toLowerCase() === lower && s.buyer !== "0x0000000000000000000000000000000000000000"
      ),
    };
  }, [summaries, address]);

  const stats = useMemo(() => {
    const producer = myListings.asProducer;
    const buyer = myListings.asBuyer;

    const totalByCurrency = (items: typeof summaries, field: "totalAmount" | "releasedAmount") =>
      items.reduce(
        (totals, listing) => {
          totals[listing.currency] += listing[field];
          return totals;
        },
        { JPYC: 0n, USDC: 0n } satisfies Record<StablecoinSymbol, bigint>,
      );

    return {
      totalProduced: producer.length,
      producerOpen: producer.filter((s) => s.status === "open").length,
      producerLocked: producer.filter((s) => s.status === "locked").length,
      producerActive: producer.filter((s) => s.status === "active").length,
      producerCompleted: producer.filter((s) => s.status === "completed").length,
      totalBought: buyer.length,
      buyerLocked: buyer.filter((s) => s.status === "locked").length,
      buyerActive: buyer.filter((s) => s.status === "active").length,
      buyerCompleted: buyer.filter((s) => s.status === "completed").length,
      totalEarnedByCurrency: totalByCurrency(producer, "releasedAmount"),
      totalSpentByCurrency: totalByCurrency(buyer, "totalAmount"),
    };
  }, [myListings]);

  return {
    asProducer: myListings.asProducer,
    asBuyer: myListings.asBuyer,
    stats,
    isLoading,
    error,
    refetch,
  };
}
