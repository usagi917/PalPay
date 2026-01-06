"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { type Address, type Hash } from "viem";
import { createClient, createWallet, config, getChain, getMetaMaskProvider, isMobile, openMetaMaskDeepLink } from "./config";
import { FACTORY_ABI, ESCROW_ABI, ERC20_ABI } from "./abi";
import { getMilestoneName } from "./constants";
import type { EscrowInfo, Milestone, ListingSummary, TimelineEvent, UserRole } from "./types";

// ============ Wallet Connection ============

export function useWallet() {
  const [address, setAddress] = useState<Address | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    const provider = getMetaMaskProvider();

    // モバイルブラウザでMetaMaskプロバイダーがない場合、Deep Linkで開く
    if (!provider) {
      if (isMobile()) {
        openMetaMaskDeepLink();
        return;
      }
      setError("MetaMaskがインストールされていません");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      }) as Address[];

      if (accounts.length > 0) {
        setAddress(accounts[0]);
      }

      // Check chain
      const chainIdHex = await provider.request({
        method: "eth_chainId",
      }) as string;
      const currentChainId = parseInt(chainIdHex, 16);

      if (currentChainId !== config.chainId) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${config.chainId.toString(16)}` }],
          });
        } catch (switchError: unknown) {
          const err = switchError as { code?: number };
          if (err.code === 4902) {
            const chain = getChain();
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${config.chainId.toString(16)}`,
                  chainName: chain.name,
                  nativeCurrency: chain.nativeCurrency,
                  rpcUrls: [config.rpcUrl || chain.rpcUrls.default.http[0]],
                  blockExplorerUrls: chain.blockExplorers
                    ? [chain.blockExplorers.default.url]
                    : undefined,
                },
              ],
            });
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "接続エラー");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  useEffect(() => {
    const provider = getMetaMaskProvider();
    if (provider) {
      const handleAccountsChanged = (...args: unknown[]) => {
        const accounts = args[0] as Address[];
        if (accounts.length === 0) {
          setAddress(null);
        } else {
          setAddress(accounts[0]);
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);

      return () => {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  useEffect(() => {
    const provider = getMetaMaskProvider();
    if (!provider) return;
    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const typed = accounts as Address[];
        if (typed.length > 0) {
          setAddress(typed[0]);
        }
      })
      .catch(() => {
        // Silent: user may not have approved accounts yet.
      });
  }, []);

  return { address, isConnecting, error, connect, disconnect };
}

// ============ Factory Hooks ============

export function useListings() {
  const [listings, setListings] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    if (!config.factoryAddress) {
      setError("Factory address not configured");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createClient();
      const result = await client.readContract({
        address: config.factoryAddress,
        abi: FACTORY_ABI,
        functionName: "getListings",
      });
      setListings(result as Address[]);
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
        const summaryPromises = listings.map(async (escrowAddress) => {
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
              [Address, Address, Address, Address, bigint, bigint, bigint, number],
              [string, string, string, string, string],
              [bigint, bigint]
            ];

            const [, , producer, buyer, tokenId, totalAmount, releasedAmount, statusEnum] = core;
            const [category, title, description, imageURI, status] = meta;

            return {
              escrowAddress,
              tokenId,
              producer,
              buyer,
              totalAmount,
              releasedAmount,
              locked: statusEnum >= 1, // V6: locked if not OPEN
              category,
              title,
              description,
              imageURI,
              status: status as "open" | "locked" | "active" | "completed" | "cancelled",
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

// カテゴリ名からcategoryType (uint8) への変換
export function categoryToType(category: string): number {
  switch (category.toLowerCase()) {
    case "wagyu": return 0;
    case "sake": return 1;
    case "craft": return 2;
    default: return 3;
  }
}

// categoryType (uint8) からカテゴリ名への変換
export function typeToCategory(categoryType: number): string {
  switch (categoryType) {
    case 0: return "wagyu";
    case 1: return "sake";
    case 2: return "craft";
    default: return "other";
  }
}

// getMilestoneName is now imported from ./constants
export { getMilestoneName } from "./constants";

export function useCreateListing(onSuccess?: () => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);

  const createListing = useCallback(
    async (
      categoryType: number,
      title: string,
      description: string,
      totalAmount: bigint,
      imageURI: string
    ) => {
      setIsLoading(true);
      setError(null);
      setTxHash(null);

      try {
        const wallet = createWallet();
        const client = createClient();
        if (!wallet) throw new Error("Walletが接続されていません");

        const [account] = await wallet.getAddresses();

        const hash = await wallet.writeContract({
          address: config.factoryAddress,
          abi: FACTORY_ABI,
          functionName: "createListing",
          args: [categoryType, title, description, totalAmount, imageURI],
          account,
        });

        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          throw new Error("出品トランザクションが失敗しました");
        }
        setTxHash(hash);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "出品に失敗しました");
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess]
  );

  return { createListing, isLoading, error, txHash };
}

// ============ Escrow Hooks (per listing) ============

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
        locked: statusEnum >= 1, // V6: locked if not OPEN
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
  | "checking"      // Checking balance/allowance
  | "approving"     // Waiting for approve signature
  | "approve-confirming"  // Waiting for approve confirmation
  | "signing"       // Waiting for main tx signature
  | "confirming"    // Waiting for main tx confirmation
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
        const wallet = createWallet();
        const client = createClient();
        if (!wallet) throw new Error("Walletが接続されていません");

        const [account] = await wallet.getAddresses();

        // Check balance first
        const balance = await client.readContract({
          address: config.tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account],
        }) as bigint;

        if (balance < totalAmount) {
          throw new Error("残高が不足しています");
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
            throw new Error("承認トランザクションが失敗しました");
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
          throw new Error("購入トランザクションが失敗しました");
        }
        setTxStep("success");
        onSuccess?.();
      } catch (err) {
        setTxStep("error");
        setError(err instanceof Error ? err.message : "購入に失敗しました");
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
        const wallet = createWallet();
        const client = createClient();
        if (!wallet) throw new Error("Walletが接続されていません");

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
          throw new Error("完了報告トランザクションが失敗しました");
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

  // V6: Approve function (buyer approves to start milestones)
  const approve = useCallback(async () => {
    if (!escrowAddress) return;

    setIsLoading(true);
    setError(null);
    setTxHash(null);
    setTxStep("signing");

    try {
      const wallet = createWallet();
      const client = createClient();
      if (!wallet) throw new Error("Walletが接続されていません");

      const [account] = await wallet.getAddresses();

      const hash = await wallet.writeContract({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "approve",
        args: [],
        account,
      });

      setTxStep("confirming");
      setTxHash(hash);
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("承認トランザクションが失敗しました");
      }
      setTxStep("success");
      onSuccess?.();
    } catch (err) {
      setTxStep("error");
      setError(err instanceof Error ? err.message : "承認に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [escrowAddress, onSuccess]);

  // V6: Cancel function (buyer cancels with full refund, LOCKED only)
  const cancel = useCallback(async () => {
    if (!escrowAddress) return;

    setIsLoading(true);
    setError(null);
    setTxHash(null);
    setTxStep("signing");

    try {
      const wallet = createWallet();
      const client = createClient();
      if (!wallet) throw new Error("Walletが接続されていません");

      const [account] = await wallet.getAddresses();

      const hash = await wallet.writeContract({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "cancel",
        args: [],
        account,
      });

      setTxStep("confirming");
      setTxHash(hash);
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("キャンセルトランザクションが失敗しました");
      }
      setTxStep("success");
      onSuccess?.();
    } catch (err) {
      setTxStep("error");
      setError(err instanceof Error ? err.message : "キャンセルに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [escrowAddress, onSuccess]);

  // V6: Confirm Delivery function (buyer confirms final milestone)
  const confirmDelivery = useCallback(
    async (evidenceHash?: string) => {
      if (!escrowAddress) return;

      setIsLoading(true);
      setError(null);
      setTxHash(null);
      setTxStep("signing");

      try {
        const wallet = createWallet();
        const client = createClient();
        if (!wallet) throw new Error("Walletが接続されていません");

        const [account] = await wallet.getAddresses();

        const evidenceBytes32 = evidenceHash
          ? (evidenceHash.startsWith("0x") ? evidenceHash : `0x${evidenceHash}`)
          : "0x0000000000000000000000000000000000000000000000000000000000000000";

        const hash = await wallet.writeContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "confirmDelivery",
          args: [evidenceBytes32 as `0x${string}`],
          account,
        });

        setTxStep("confirming");
        setTxHash(hash);
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          throw new Error("納品確認トランザクションが失敗しました");
        }
        setTxStep("success");
        onSuccess?.();
      } catch (err) {
        setTxStep("error");
        setError(err instanceof Error ? err.message : "納品確認に失敗しました");
      } finally {
        setIsLoading(false);
      }
    },
    [escrowAddress, onSuccess]
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

// ============ Token Hooks ============

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

// ============ Real-time Updates ============

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

// ============ My Page Hooks ============

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
      producerLocked: producer.filter((s) => s.status === "locked").length, // V6
      producerActive: producer.filter((s) => s.status === "active").length,
      producerCompleted: producer.filter((s) => s.status === "completed").length,
      totalBought: buyer.length,
      buyerLocked: buyer.filter((s) => s.status === "locked").length, // V6
      buyerActive: buyer.filter((s) => s.status === "active").length,
      buyerCompleted: buyer.filter((s) => s.status === "completed").length,
      totalEarned: producer
        .filter((s) => s.status !== "open" && s.status !== "locked")
        .reduce((sum, s) => sum + s.releasedAmount, 0n),
      totalSpent: buyer
        .filter((s) => s.status !== "cancelled") // V6: exclude cancelled
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

// ============ Utility Functions ============

export function formatAmount(amount: bigint, decimals: number, symbol: string): string {
  if (decimals <= 0) {
    return `${amount.toString()} ${symbol}`;
  }
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === 0n) {
    return `${whole.toString()} ${symbol}`;
  }
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole}.${fractionStr} ${symbol}`;
}

export function getUserRole(userAddress: Address | null, info: EscrowInfo | null): UserRole {
  if (!userAddress || !info) return "none";
  const lower = userAddress.toLowerCase();
  if (lower === info.buyer.toLowerCase()) return "buyer";
  if (lower === info.producer.toLowerCase()) return "producer";
  return "none";
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============ NFT Owner ============

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

/**
 * Check if user can access chat for an escrow
 * Returns true if:
 * - Escrow is not OPEN (payment made)
 * - User is the producer OR the current NFT owner
 */
export function canAccessChat(
  userAddress: Address | null,
  info: EscrowInfo | null,
  nftOwner: Address | null
): boolean {
  if (!userAddress || !info) return false;

  // Must be paid (not OPEN, not CANCELLED)
  if (info.status === "open" || info.status === "cancelled") return false;

  const lower = userAddress.toLowerCase();

  // Producer can always chat
  if (lower === info.producer.toLowerCase()) return true;

  // Current NFT owner can chat
  if (nftOwner && lower === nftOwner.toLowerCase()) return true;

  return false;
}
