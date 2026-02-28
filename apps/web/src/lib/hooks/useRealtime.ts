"use client";

import { useEffect, useCallback, useMemo } from "react";
import { type Address } from "viem";
import { useEscrowInfo, useEscrowEvents } from "./useEscrow";
import { useMilestones } from "./useEscrow";
import { useListingSummaries } from "./useFactory";

export function useRealtimeEscrow(
  escrowAddress: Address | null,
  options: { interval?: number; enabled?: boolean } = {}
) {
  const { interval = 10000, enabled = true } = options;

  const { info, isLoading: infoLoading, error: infoError, refetch: refetchInfo } = useEscrowInfo(escrowAddress);
  const { milestones, isLoading: milestonesLoading, refetch: refetchMilestones } = useMilestones(escrowAddress);
  const { events, refetch: refetchEvents } = useEscrowEvents(escrowAddress);

  const refetchAll = useCallback(() => {
    refetchInfo();
    refetchMilestones();
    refetchEvents();
  }, [refetchInfo, refetchMilestones, refetchEvents]);

  useEffect(() => {
    if (!escrowAddress || !enabled) return;

    const timer = setInterval(() => {
      refetchAll();
    }, interval);

    return () => clearInterval(timer);
  }, [escrowAddress, interval, enabled, refetchAll]);

  return {
    info,
    milestones,
    events,
    isLoading: infoLoading || milestonesLoading,
    error: infoError,
    refetch: refetchAll,
  };
}

// Real-time listing summaries with polling
export function useRealtimeListingSummaries(options: { interval?: number; enabled?: boolean } = {}) {
  const { interval = 15000, enabled = true } = options;
  const { summaries, isLoading, error, refetch } = useListingSummaries();

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      refetch();
    }, interval);

    return () => clearInterval(timer);
  }, [interval, enabled, refetch]);

  return { summaries, isLoading, error, refetch };
}

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
      totalEarned: producer
        .filter((s) => s.status !== "open" && s.status !== "locked")
        .reduce((sum, s) => sum + s.releasedAmount, 0n),
      totalSpent: buyer
        .filter((s) => s.status !== "cancelled")
        .reduce((sum, s) => sum + s.totalAmount, 0n),
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
