"use client";

import { useState, useEffect, useCallback } from "react";
import { type Address } from "viem";
import { getMetaMaskProvider, ensureWalletChain, isMobile, openMetaMaskDeepLink } from "../config";

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

      await ensureWalletChain(provider);
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

      if (typeof provider.on !== "function") {
        return;
      }

      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);

      return () => {
        if (typeof provider.removeListener === "function") {
          provider.removeListener("accountsChanged", handleAccountsChanged);
          provider.removeListener("chainChanged", handleChainChanged);
        }
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
