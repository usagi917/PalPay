"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { type Address, type Hash } from "viem";
import { createClient, createWallet, config, ensureWalletChain, getMetaMaskProvider } from "../config";
import { ESCROW_ABI, ERC20_ABI } from "../abi";
import { getMilestoneName } from "../constants";
import { formatTxError, writeContractWithGasFallback } from "../tx";
import type { EscrowInfo, Milestone, TimelineEvent } from "../types";

export function useEscrowInfo(escrowAddress: Address | null) {
  const [info, setInfo] = useState<EscrowInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchInfo = useCallback(async () => {
    if (!escrowAddress) {
      requestIdRef.current += 1;
      setInfo(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const client = createClient();
      const [
        core,
        meta,
        lockedAt,
        finalRequestedAt,
        finalEvidenceHash,
        lockTimeout,
        finalConfirmTimeout,
      ] = await Promise.all([
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
          functionName: "lockedAt",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "finalRequestedAt",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "finalEvidenceHash",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "LOCK_TIMEOUT",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "FINAL_CONFIRM_TIMEOUT",
        }),
      ]) as [
        [Address, Address, Address, Address, bigint, bigint, bigint, number, bigint],
        [string, string, string, string, string],
        bigint,
        bigint,
        `0x${string}`,
        bigint,
        bigint
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
        cancelCount,
      ] = core;
      const [category, title, description, imageURI, status] = meta;
      const lockDeadline = lockedAt > 0n ? lockedAt + lockTimeout : null;
      const finalConfirmationDeadline = finalRequestedAt > 0n ? finalRequestedAt + finalConfirmTimeout : null;

      if (requestIdRef.current !== requestId) {
        return;
      }
      setInfo({
        factory,
        tokenAddress,
        producer,
        buyer,
        tokenId,
        totalAmount,
        releasedAmount,
        cancelCount,
        lockedAt,
        finalRequestedAt,
        finalEvidenceHash,
        lockTimeout,
        finalConfirmTimeout,
        lockDeadline,
        finalConfirmationDeadline,
        locked: statusEnum >= 1,
        category,
        title,
        description,
        imageURI,
        status: status as "open" | "locked" | "active" | "completed",
      });
    } catch (err) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch escrow info");
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
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
  const requestIdRef = useRef(0);

  const fetchMilestones = useCallback(async () => {
    if (!escrowAddress) {
      requestIdRef.current += 1;
      setMilestones([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
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
      if (requestIdRef.current !== requestId) {
        return;
      }
      setMilestones(
        milestoneData.map((m, index) => ({
          code: index,
          bps: typeof m.bps === "bigint" ? m.bps : BigInt(m.bps),
          completed: m.completed,
          name: getMilestoneName(catType!, index),
        }))
      );
    } catch (err) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch milestones");
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
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

const TX_FALLBACK_GAS = {
  tokenApprove: 200_000n,
  lock: 1_200_000n,
  submit: 500_000n,
  approve: 350_000n,
  activateAfterTimeout: 350_000n,
  cancel: 700_000n,
  requestFinalDelivery: 400_000n,
  confirmDelivery: 500_000n,
  finalizeAfterTimeout: 500_000n,
} as const;

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
          const hash1 = await writeContractWithGasFallback(
            wallet,
            {
              address: config.tokenAddress,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [escrowAddress, totalAmount],
              account,
            },
            TX_FALLBACK_GAS.tokenApprove,
          );

          setTxStep("approve-confirming");
          const approveReceipt = await client.waitForTransactionReceipt({ hash: hash1 });
          if (approveReceipt.status !== "success") {
            throw new Error("支払い準備に失敗しました");
          }
        }

        // Then lock
        setTxStep("signing");
        const hash2 = await writeContractWithGasFallback(
          wallet,
          {
            address: escrowAddress,
            abi: ESCROW_ABI,
            functionName: "lock",
            args: [],
            account,
          },
          TX_FALLBACK_GAS.lock,
        );

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
        setError(
          formatTxError(
            err,
            "お支払いに失敗しました",
            "お支払い処理をキャンセルしました。MetaMaskで承認すると再実行できます。",
          ),
        );
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

        const hash = await writeContractWithGasFallback(
          wallet,
          {
            address: escrowAddress,
            abi: ESCROW_ABI,
            functionName: "submit",
            args: [BigInt(index), evidenceBytes32 as `0x${string}`],
            account,
          },
          TX_FALLBACK_GAS.submit,
        );

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
        setError(
          formatTxError(
            err,
            "完了報告に失敗しました",
            "処理をキャンセルしました。MetaMaskで承認すると再実行できます。",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [escrowAddress, onSuccess]
  );

  const makeAction = useCallback(
    (
      functionName:
        | "approve"
        | "activateAfterTimeout"
        | "cancel"
        | "requestFinalDelivery"
        | "confirmDelivery"
        | "finalizeAfterTimeout",
      args: unknown[],
      errorMsg: string,
    ) => async () => {
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
        const fallbackGas = TX_FALLBACK_GAS[functionName];
        const hash = await writeContractWithGasFallback(wallet, {
          address: escrowAddress, abi: ESCROW_ABI, functionName, args: args as never, account,
        }, fallbackGas);
        setTxStep("confirming"); setTxHash(hash);
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(errorMsg);
        setTxStep("success"); onSuccess?.();
      } catch (err) {
        setTxStep("error");
        setError(
          formatTxError(
            err,
            errorMsg,
            "処理をキャンセルしました。MetaMaskで承認すると再実行できます。",
          ),
        );
      } finally { setIsLoading(false); }
    }, [escrowAddress, onSuccess]
  );

  const approve = useMemo(() => makeAction("approve", [], "取引開始に失敗しました"), [makeAction]);
  const activateAfterTimeout = useMemo(
    () => makeAction("activateAfterTimeout", [], "期限後の取引開始に失敗しました"),
    [makeAction]
  );
  const cancel = useMemo(() => makeAction("cancel", [], "キャンセルに失敗しました"), [makeAction]);

  const requestFinalDelivery = useCallback(
    async (evidenceHash?: string) => {
      const evidenceBytes32 = evidenceHash
        ? (evidenceHash.startsWith("0x") ? evidenceHash : `0x${evidenceHash}`)
        : "0x0000000000000000000000000000000000000000000000000000000000000000";
      await makeAction(
        "requestFinalDelivery",
        [evidenceBytes32 as `0x${string}`],
        "最終納品申請に失敗しました",
      )();
    },
    [makeAction]
  );

  const confirmDelivery = useMemo(
    () => makeAction("confirmDelivery", [], "受取確認に失敗しました"),
    [makeAction]
  );
  const finalizeAfterTimeout = useMemo(
    () => makeAction("finalizeAfterTimeout", [], "期限後の最終確定に失敗しました"),
    [makeAction]
  );

  return {
    lock,
    submit,
    approve,
    activateAfterTimeout,
    cancel,
    requestFinalDelivery,
    confirmDelivery,
    finalizeAfterTimeout,
    isLoading,
    error,
    txHash,
    txStep,
    resetState,
  };
}

export function useEscrowEvents(escrowAddress: Address | null) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromBlock, setFromBlock] = useState<bigint | null>(null);
  const requestIdRef = useRef(0);

  // escrowAddressが変更されたときのみfromBlockをリセット
  useEffect(() => {
    requestIdRef.current += 1;
    setFromBlock(null);
  }, [escrowAddress]);

  const fetchEvents = useCallback(async () => {
    if (!escrowAddress) {
      requestIdRef.current += 1;
      setEvents([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
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

      const [
        lockedLogs,
        approvedLogs,
        cancelledLogs,
        completedLogs,
        deliveryConfirmedLogs,
        activatedAfterTimeoutLogs,
        finalDeliveryRequestedLogs,
        finalizedAfterTimeoutLogs,
      ] = await Promise.all([
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
              { name: "evidenceHash", type: "bytes32", indexed: false },
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
        client.getLogs({
          address: escrowAddress,
          event: {
            type: "event",
            name: "ActivatedAfterTimeout",
            inputs: [
              { name: "caller", type: "address", indexed: true },
              { name: "activatedAt", type: "uint256", indexed: false },
            ],
          },
          fromBlock: effectiveFromBlock,
          toBlock: "latest",
        }),
        client.getLogs({
          address: escrowAddress,
          event: {
            type: "event",
            name: "FinalDeliveryRequested",
            inputs: [
              { name: "evidenceHash", type: "bytes32", indexed: false },
              { name: "deadline", type: "uint256", indexed: false },
            ],
          },
          fromBlock: effectiveFromBlock,
          toBlock: "latest",
        }),
        client.getLogs({
          address: escrowAddress,
          event: {
            type: "event",
            name: "FinalizedAfterTimeout",
            inputs: [
              { name: "caller", type: "address", indexed: true },
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
          transactionIndex: log.transactionIndex ?? undefined,
          logIndex: log.logIndex ?? undefined,
          amount: log.args.amount,
        });
      }

      for (const log of approvedLogs) {
        allEvents.push({
          type: "Approved",
          buyer: log.args.buyer!,
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          transactionIndex: log.transactionIndex ?? undefined,
          logIndex: log.logIndex ?? undefined,
        });
      }

      for (const log of cancelledLogs) {
        allEvents.push({
          type: "Cancelled",
          buyer: log.args.buyer!,
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          transactionIndex: log.transactionIndex ?? undefined,
          logIndex: log.logIndex ?? undefined,
          amount: log.args.refundAmount,
        });
      }

      for (const log of completedLogs) {
        allEvents.push({
          type: "Completed",
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          transactionIndex: log.transactionIndex ?? undefined,
          logIndex: log.logIndex ?? undefined,
          index: log.args.index,
          amount: log.args.amount,
          evidenceHash: log.args.evidenceHash,
        });
      }

      for (const log of deliveryConfirmedLogs) {
        allEvents.push({
          type: "DeliveryConfirmed",
          buyer: log.args.buyer!,
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          transactionIndex: log.transactionIndex ?? undefined,
          logIndex: log.logIndex ?? undefined,
          amount: log.args.amount,
        });
      }

      for (const log of activatedAfterTimeoutLogs) {
        allEvents.push({
          type: "ActivatedAfterTimeout",
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          transactionIndex: log.transactionIndex ?? undefined,
          logIndex: log.logIndex ?? undefined,
          caller: log.args.caller!,
        });
      }

      for (const log of finalDeliveryRequestedLogs) {
        allEvents.push({
          type: "FinalDeliveryRequested",
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          transactionIndex: log.transactionIndex ?? undefined,
          logIndex: log.logIndex ?? undefined,
          deadline: log.args.deadline,
          evidenceHash: log.args.evidenceHash,
        });
      }

      for (const log of finalizedAfterTimeoutLogs) {
        allEvents.push({
          type: "FinalizedAfterTimeout",
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
          transactionIndex: log.transactionIndex ?? undefined,
          logIndex: log.logIndex ?? undefined,
          amount: log.args.amount,
          caller: log.args.caller!,
        });
      }

      // Sort by chain order for stable timeline rendering.
      allEvents.sort((a, b) => {
        if (a.blockNumber < b.blockNumber) return -1;
        if (a.blockNumber > b.blockNumber) return 1;
        const txA = a.transactionIndex ?? Number.MAX_SAFE_INTEGER;
        const txB = b.transactionIndex ?? Number.MAX_SAFE_INTEGER;
        if (txA !== txB) return txA - txB;
        const logA = a.logIndex ?? Number.MAX_SAFE_INTEGER;
        const logB = b.logIndex ?? Number.MAX_SAFE_INTEGER;
        return logA - logB;
      });

      if (requestIdRef.current !== requestId) {
        return;
      }
      setEvents(allEvents);
    } catch (err) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setError(err instanceof Error ? err.message : "イベント取得エラー");
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [escrowAddress, fromBlock]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, isLoading, error, refetch: fetchEvents };
}
