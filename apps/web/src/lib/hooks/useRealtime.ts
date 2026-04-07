"use client";

import { useEffect, useCallback, useMemo, useRef } from "react";
import { type Address } from "viem";
import { useEscrowInfo, useEscrowEvents } from "./useEscrow";
import { useMilestones } from "./useEscrow";
import { useListingSummaries } from "./useFactory";

/**
 * Polls escrow info, milestones, and events at a fixed interval.
 * @warning Mount once per escrow address. Mounting per-row in a list will fan out
 * into N * 3 concurrent RPC calls per tick, hitting provider rate limits quickly.
 */
export function useRealtimeEscrow(
  escrowAddress: Address | null,
  options: { interval?: number; enabled?: boolean } = {}
) {
  const { interval = 10000, enabled = true } = options;

  const { info, isLoading: infoLoading, error: infoError, refetch: refetchInfo } = useEscrowInfo(escrowAddress);
  const { milestones, isLoading: milestonesLoading, error: milestonesError, refetch: refetchMilestones } = useMilestones(escrowAddress);
  const { events, isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useEscrowEvents(escrowAddress);
  const inFlightRef = useRef(false);

  const refetchAll = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      await Promise.all([refetchInfo(), refetchMilestones(), refetchEvents()]);
    } finally {
      inFlightRef.current = false;
    }
  }, [refetchInfo, refetchMilestones, refetchEvents]);

  useEffect(() => {
    if (!escrowAddress || !enabled) return;

    const timer = setInterval(() => {
      void refetchAll();
    }, interval);

    return () => clearInterval(timer);
  }, [escrowAddress, interval, enabled, refetchAll]);

  return {
    info,
    milestones,
    events,
    isLoading: infoLoading || milestonesLoading || eventsLoading,
    error: infoError ?? milestonesError ?? eventsError,
    refetch: refetchAll,
  };
}

/**
 * Polls all listing summaries at a fixed interval.
 * @warning Mount a single instance at the page/layout level. Each additional mount
 * starts an independent poller doing 3 contract reads per listing per tick.
 */
export function useRealtimeListingSummaries(options: { interval?: number; enabled?: boolean } = {}) {
  const { interval = 15000, enabled = true } = options;
  const { summaries, isLoading, error, refetch } = useListingSummaries();
  const inFlightRef = useRef(false);

  const refetchSafe = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      await refetch();
    } finally {
      inFlightRef.current = false;
    }
  }, [refetch]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      void refetchSafe();
    }, interval);

    return () => clearInterval(timer);
  }, [interval, enabled, refetchSafe]);

  return { summaries, isLoading, error, refetch: refetchSafe };
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
        .reduce((sum, s) => sum + s.releasedAmount, 0n),
      totalSpent: buyer.reduce((sum, s) => sum + s.releasedAmount, 0n),
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
