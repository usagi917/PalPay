"use client";

import { useCallback, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

export function useWallet() {
  const { address, isConnecting, isReconnecting } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    setError(null);
    if (openConnectModal) {
      openConnectModal();
      return;
    }
    setError("ログイン画面の準備中です。少し時間をおいて再度お試しください。");
  }, [openConnectModal]);

  const disconnect = useCallback(() => {
    setError(null);
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  return {
    address: address ?? null,
    isConnecting: isConnecting || isReconnecting || connectModalOpen,
    error,
    connect,
    disconnect,
  };
}
