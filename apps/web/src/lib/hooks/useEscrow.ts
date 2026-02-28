"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { type Address, type Hash } from "viem";
import { createClient, createWallet, config, ensureWalletChain, getMetaMaskProvider } from "../config";
import { ESCROW_ABI, ERC20_ABI } from "../abi";
import { getMilestoneName } from "../constants";
import type { EscrowInfo, Milestone, TimelineEvent } from "../types";

export function useEscrowInfo(escrowAddress: Address | null) {
  const [info, setInfo] = useState<EscrowInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    if (!escrowAddress) {
      setInfo(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createClient();
      const [core, meta] = await Promise.all([
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
      ]) as [
        [Address, Address, Address, Address, bigint, bigint, bigint, number],
        [string, string, string, string, string]
      ];

      const [
        factory,
        tokenAddress,
        producer,
        buyer,
        tokenId,
        totalAmount,
        releasedAmount,
        statusEnum,
      ] = core;
      const [category, title, description, imageURI, status] = meta;

      setInfo({
        factory,
        tokenAddress,
        producer,
        buyer,
        tokenId,
        totalAmount,
        releasedAmount,
        locked: statusEnum >= 1,
        category,
        title,
        description,
        imageURI,
        status: status as "open" | "locked" | "active" | "completed" | "cancelled",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch escrow info");
    } finally {
      setIsLoading(false);
    }
  }, [escrowAddress]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  return { info, isLoading, error, refetch: fetchInfo };
}

export function useMilestones(escrowAddress: Address | null, categoryType?: number) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMilestones = useCallback(async () => {
    if (!escrowAddress) {
      setMilestones([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createClient();

      // Get categoryType if not provided
      let catType = categoryType;
      if (catType === undefined) {
        catType = await client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "categoryType",
        }) as number;
      }

      const result = await client.readContract({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "getMilestones",
      });

      const milestoneData = result as Array<{ bps: bigint | number; completed: boolean }>;
      setMilestones(
        milestoneData.map((m, index) => ({
          code: index,
          bps: typeof m.bps === "bigint" ? m.bps : BigInt(m.bps),
          completed: m.completed,
          name: getMilestoneName(catType!, index),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch milestones");
    } finally {
      setIsLoading(false);
    }
  }, [escrowAddress, categoryType]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  return { milestones, isLoading, error, refetch: fetchMilestones };
}

// Transaction step types for progress display
export type TxStep =
  | "idle"
  | "checking"
  | "approving"
  | "approve-confirming"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export function useEscrowActions(escrowAddress: Address | null, onSuccess?: () => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [txStep, setTxStep] = useState<TxStep>("idle");

  const resetState = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setTxHash(null);
    setTxStep("idle");
  }, []);

  const lock = useCallback(
    async (totalAmount: bigint, skipApprovalCheck = false) => {
      if (!escrowAddress) return;

      setIsLoading(true);
      setError(null);
      setTxHash(null);
      setTxStep("checking");

      try {
        const provider = getMetaMaskProvider();
        if (!provider) throw new Error("ログインが必要です");
        await ensureWalletChain(provider);
        const wallet = createWallet(provider);
        const client = createClient();
        if (!wallet) throw new Error("ログインが必要です");

        const [account] = await wallet.getAddresses();

        // Check balance first
        const balance = await client.readContract({
          address: config.tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account],
        }) as bigint;

        if (balance < totalAmount) {
          throw new Error("お支払い可能額が不足しています");
        }

        // Check allowance and skip approve if already approved
        let needsApproval = true;
        if (!skipApprovalCheck) {
          const currentAllowance = await client.readContract({
            address: config.tokenAddress,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [account, escrowAddress],
          }) as bigint;
          needsApproval = currentAllowance < totalAmount;
        }

        if (needsApproval) {
          setTxStep("approving");
          const hash1 = await wallet.writeContract({
            address: config.tokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [escrowAddress, totalAmount],
            account,
          });

          setTxStep("approve-confirming");
          const approveReceipt = await client.waitForTransactionReceipt({ hash: hash1 });
          if (approveReceipt.status !== "success") {
            throw new Error("支払い準備に失敗しました");
          }
        }

        // Then lock
        setTxStep("signing");
        const hash2 = await wallet.writeContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "lock",
          args: [],
          account,
        });

        setTxStep("confirming");
        setTxHash(hash2);
        const lockReceipt = await client.waitForTransactionReceipt({ hash: hash2 });
        if (lockReceipt.status !== "success") {
          throw new Error("お支払い処理に失敗しました");
        }
        setTxStep("success");
        onSuccess?.();
      } catch (err) {
        setTxStep("error");
        setError(err instanceof Error ? err.message : "お支払いに失敗しました");
      } finally {
        setIsLoading(false);
      }
    },
    [escrowAddress, onSuccess]
  );

  const submit = useCallback(
    async (index: number, evidenceHash?: string) => {
      if (!escrowAddress) return;

      setIsLoading(true);
      setError(null);
      setTxHash(null);
      setTxStep("signing");

      try {
        const provider = getMetaMaskProvider();
        if (!provider) throw new Error("ログインが必要です");
        await ensureWalletChain(provider);
        const wallet = createWallet(provider);
        const client = createClient();
        if (!wallet) throw new Error("ログインが必要です");

        const [account] = await wallet.getAddresses();

        // V4: Pass evidenceHash (bytes32) - use 0x0 if not provided
        const evidenceBytes32 = evidenceHash
          ? (evidenceHash.startsWith("0x") ? evidenceHash : `0x${evidenceHash}`)
          : "0x0000000000000000000000000000000000000000000000000000000000000000";

        const hash = await wallet.writeContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "submit",
          args: [BigInt(index), evidenceBytes32 as `0x${string}`],
          account,
        });

        setTxStep("confirming");
        setTxHash(hash);
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          throw new Error("完了報告の処理に失敗しました");
        }
        setTxStep("success");
        onSuccess?.();
      } catch (err) {
        setTxStep("error");
        setError(err instanceof Error ? err.message : "完了報告に失敗しました");
      } finally {
        setIsLoading(false);
      }
    },
    [escrowAddress, onSuccess]
  );

  const makeAction = useCallback(
    (functionName: "approve" | "cancel" | "confirmDelivery", args: unknown[], errorMsg: string) => async () => {
      if (!escrowAddress) return;
      setIsLoading(true); setError(null); setTxHash(null); setTxStep("signing");
      try {
        const provider = getMetaMaskProvider();
        if (!provider) throw new Error("ログインが必要です");
        await ensureWalletChain(provider);
        const wallet = createWallet(provider);
        const client = createClient();
        if (!wallet) throw new Error("ログインが必要です");
        const [account] = await wallet.getAddresses();
        const hash = await wallet.writeContract({
          address: escrowAddress, abi: ESCROW_ABI, functionName, args: args as never, account,
        });
        setTxStep("confirming"); setTxHash(hash);
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(errorMsg);
        setTxStep("success"); onSuccess?.();
      } catch (err) {
        setTxStep("error");
        setError(err instanceof Error ? err.message : errorMsg);
      } finally { setIsLoading(false); }
    }, [escrowAddress, onSuccess]
  );

  const approve = useMemo(() => makeAction("approve", [], "取引開始に失敗しました"), [makeAction]);
  const cancel = useMemo(() => makeAction("cancel", [], "キャンセルに失敗しました"), [makeAction]);

  // confirmDelivery has unique evidenceHash logic
  const confirmDelivery = useCallback(
    async (evidenceHash?: string) => {
      const evidenceBytes32 = evidenceHash
        ? (evidenceHash.startsWith("0x") ? evidenceHash : `0x${evidenceHash}`)
        : "0x0000000000000000000000000000000000000000000000000000000000000000";
      await makeAction("confirmDelivery", [evidenceBytes32 as `0x${string}`], "受取確認に失敗しました")();
    },
    [makeAction]
  );

  return { lock, submit, approve, cancel, confirmDelivery, isLoading, error, txHash, txStep, resetState };
}

export function useEscrowEvents(escrowAddress: Address | null) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromBlock, setFromBlock] = useState<bigint | null>(null);

  // escrowAddressが変更されたときのみfromBlockをリセット
  useEffect(() => {
    setFromBlock(null);
  }, [escrowAddress]);

  const fetchEvents = useCallback(async () => {
    if (!escrowAddress) {
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createClient();
      let effectiveFromBlock = fromBlock ?? 0n;
      if (fromBlock === null) {
        try {
          const factoryAddress = await client.readContract({
            address: escrowAddress,
            abi: ESCROW_ABI,
            functionName: "factory",
          }) as Address;

          const listingCreatedLogs = await client.getLogs({
            address: factoryAddress,
            event: {
              type: "event",
              name: "ListingCreated",
              inputs: [
                { name: "tokenId", type: "uint256", indexed: true },
                { name: "escrow", type: "address", indexed: true },
                { name: "producer", type: "address", indexed: true },
                { name: "categoryType", type: "uint8", indexed: false },
                { name: "totalAmount", type: "uint256", indexed: false },
              ],
            },
            args: { escrow: escrowAddress },
            fromBlock: 0n,
            toBlock: "latest",
          });

          if (listingCreatedLogs.length > 0) {
            effectiveFromBlock = listingCreatedLogs.reduce(
              (min, log) => (log.blockNumber < min ? log.blockNumber : min),
              listingCreatedLogs[0].blockNumber
            );
          }
        } catch {
          effectiveFromBlock = 0n;
        }
        setFromBlock(effectiveFromBlock);
      }

      const [lockedLogs, approvedLogs, cancelledLogs, completedLogs, deliveryConfirmedLogs] = await Promise.all([
        client.getLogs({
          address: escrowAddress,
          event: {
            type: "event",
            name: "Locked",
            inputs: [
              { name: "buyer", type: "address", indexed: true },
              { name: "amount", type: "uint256", indexed: false },
            ],
          },
          fromBlock: effectiveFromBlock,
          toBlock: "latest",
        }),
        client.getLogs({
          address: escrowAddress,
          event: {
            type: "event",
            name: "Approved",
            inputs: [
              { name: "buyer", type: "address", indexed: true },
            ],
          },
          fromBlock: effectiveFromBlock,
          toBlock: "latest",
        }),
        client.getLogs({
          address: escrowAddress,
          event: {
            type: "event",
            name: "Cancelled",
            inputs: [
              { name: "buyer", type: "address", indexed: true },
              { name: "refundAmount", type: "uint256", indexed: false },
            ],
          },
          fromBlock: effectiveFromBlock,
          toBlock: "latest",
        }),
        client.getLogs({
          address: escrowAddress,
          event: {
            type: "event",
            name: "Completed",
            inputs: [
              { name: "index", type: "uint256", indexed: true },
              { name: "amount", type: "uint256", indexed: false },
            ],
          },
          fromBlock: effectiveFromBlock,
          toBlock: "latest",
        }),
        client.getLogs({
          address: escrowAddress,
          event: {
            type: "event",
            name: "DeliveryConfirmed",
            inputs: [
              { name: "buyer", type: "address", indexed: true },
              { name: "amount", type: "uint256", indexed: false },
            ],
          },
          fromBlock: effectiveFromBlock,
          toBlock: "latest",
        }),
      ]);

      const allEvents: TimelineEvent[] = [];

      for (const log of lockedLogs) {
        allEvents.push({
          type: "Locked",
          buyer: log.args.buyer!,
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          amount: log.args.amount,
        });
      }

      for (const log of approvedLogs) {
        allEvents.push({
          type: "Approved",
          buyer: log.args.buyer!,
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
        });
      }

      for (const log of cancelledLogs) {
        allEvents.push({
          type: "Cancelled",
          buyer: log.args.buyer!,
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          amount: log.args.refundAmount,
        });
      }

      for (const log of completedLogs) {
        allEvents.push({
          type: "Completed",
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          index: log.args.index,
          amount: log.args.amount,
        });
      }

      for (const log of deliveryConfirmedLogs) {
        allEvents.push({
          type: "DeliveryConfirmed",
          buyer: log.args.buyer!,
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          amount: log.args.amount,
        });
      }

      // Sort by block number
      allEvents.sort((a, b) => Number(a.blockNumber - b.blockNumber));

      setEvents(allEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "イベント取得エラー");
    } finally {
      setIsLoading(false);
    }
  }, [escrowAddress, fromBlock]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, isLoading, error, refetch: fetchEvents };
}
