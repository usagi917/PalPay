"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Client, Conversation } from "@xmtp/browser-sdk";
import { useAccount, useConfig } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import {
  createXmtpClient,
  getEscrowConversation,
  canMessage,
  formatMessage,
  isTextMessage,
  formatXmtpError,
  isInstallationLimitError,
  revokeAllInstallationsByAddress,
  type XmtpMessage,
  type XmtpErrorKind,
  type XmtpSignerOptions,
} from "@/lib/xmtp";

const SMART_CONTRACT_WALLET_CONNECTOR_IDS = new Set<string>([
  "baseAccount",
  "coinbaseWalletSDK",
]);

interface UseXmtpChatProps {
  escrowAddress: string;
  peerAddress: string;
  enabled?: boolean;
}

interface UseXmtpChatReturn {
  messages: XmtpMessage[];
  sendMessage: (content: string) => Promise<void>;
  recoverInstallationLimit: () => Promise<void>;
  isLoading: boolean;
  isConnecting: boolean;
  isSending: boolean;
  isRecovering: boolean;
  error: string | null;
  errorKind: XmtpErrorKind | null;
  canMessagePeer: boolean;
  isReady: boolean;
}

export function useXmtpChat({
  escrowAddress,
  peerAddress,
  enabled = true,
}: UseXmtpChatProps): UseXmtpChatReturn {
  const [messages, setMessages] = useState<XmtpMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<XmtpErrorKind | null>(null);
  const [canMessagePeer, setCanMessagePeer] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const wagmiConfig = useConfig();
  const { address: connectedAddress, connector, chainId } = useAccount();

  const clientRef = useRef<Client | null>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const selfInboxIdRef = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamRef = useRef<any>(null);

  const closeStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.return?.();
      streamRef.current = null;
    }
  }, []);

  const getWalletContext = useCallback(async () => {
    const wallet = await getWalletClient(wagmiConfig);
    if (!wallet) {
      throw new Error("ログインが必要です");
    }
    const [primary] = await wallet.getAddresses();
    if (!primary) {
      throw new Error("ログインが必要です");
    }
    const address = primary;
    const signMessage = (message: string): Promise<string> =>
      wallet.signMessage({ account: address, message });
    const isSmartWallet = connector?.id
      ? SMART_CONTRACT_WALLET_CONNECTOR_IDS.has(connector.id)
      : false;
    const signerOptions: XmtpSignerOptions = isSmartWallet
      ? {
          type: "SCW",
          chainId:
            chainId ?? wallet.chain?.id ?? Number(await wallet.getChainId()),
        }
      : { type: "EOA" };
    return { address, signMessage, signerOptions };
  }, [wagmiConfig, connector, chainId]);

  // Re-initialise XMTP whenever the connected wallet changes
  useEffect(() => {
    setRetryNonce((prev) => prev + 1);
  }, [connectedAddress]);

  // Initialize XMTP client and conversation
  useEffect(() => {
    if (!enabled || !escrowAddress || !peerAddress) {
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      setIsConnecting(true);
      setIsReady(false);
      setError(null);
      setErrorKind(null);
      setCanMessagePeer(false);
      setMessages([]);
      closeStream();

      try {
        const { address, signMessage, signerOptions } = await getWalletContext();
        if (!isMounted) return;

        // Create XMTP client (signerOptions select EOA vs SCW path)
        const client = await createXmtpClient(address, signMessage, signerOptions);

        if (!isMounted) return;

        clientRef.current = client;
        selfInboxIdRef.current = client.inboxId || "";

        // Check if peer can receive messages
        const canMsg = await canMessage(client, peerAddress);
        setCanMessagePeer(canMsg);

        if (!canMsg) {
          setErrorKind(null);
          setError("相手がまだXMTPを有効にしていません");
          setIsConnecting(false);
          return;
        }

        // Get or create conversation
        const conversation = await getEscrowConversation(client, peerAddress, escrowAddress);

        if (!isMounted) return;

        conversationRef.current = conversation;

        // Sync messages from network, then load
        setIsLoading(true);
        try {
          await conversation.sync();
        } catch (syncErr) {
          console.warn("XMTP conversation sync failed, loading cached messages:", syncErr);
        }
        const existingMessages = await conversation.messages();

        if (!isMounted) return;

        setMessages(
          existingMessages
            .filter(isTextMessage)
            .map((msg) => formatMessage(msg, selfInboxIdRef.current))
        );

        setIsReady(true);
        setIsLoading(false);
        setIsConnecting(false);

        // Start streaming new messages
        const stream = await conversation.stream();
        streamRef.current = stream;

        for await (const message of stream) {
          if (!isMounted) break;
          // Skip non-text messages (membership changes, metadata, etc.)
          if (!isTextMessage(message)) continue;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === message.id)) {
              return prev;
            }
            return [...prev, formatMessage(message, selfInboxIdRef.current)];
          });
        }
      } catch (err) {
        if (isMounted) {
          const installationLimit = isInstallationLimitError(err);
          console.error("XMTP initialization error:", err, {
            errorKind: installationLimit ? "installation_limit" : "unknown",
            escrowAddress,
            peerAddress,
            selfInboxId: selfInboxIdRef.current || null,
          });
          setErrorKind(installationLimit ? "installation_limit" : null);
          setError(formatXmtpError(err) || "XMTPの初期化に失敗しました");
        }
      } finally {
        if (isMounted) {
          setIsConnecting(false);
          setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      closeStream();
    };
  }, [escrowAddress, peerAddress, enabled, retryNonce, closeStream, getWalletContext]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) {
      return;
    }
    if (!conversationRef.current) {
      setError("チャットの準備ができていません。接続完了後に再度お試しください。");
      return;
    }

    setIsSending(true);
    setError(null);
    setErrorKind(null);

    try {
      await conversationRef.current.send(content.trim());

      // Keep UI in sync even if stream delivery is delayed or temporarily interrupted.
      const refreshedMessages = await conversationRef.current.messages();
      setMessages(
        refreshedMessages
          .filter(isTextMessage)
          .map((msg) => formatMessage(msg, selfInboxIdRef.current))
      );
    } catch (err) {
      console.error("Send message error:", err);
      setError(err instanceof Error ? err.message : "メッセージの送信に失敗しました");
    } finally {
      setIsSending(false);
    }
  }, []);

  const recoverInstallationLimit = useCallback(async () => {
    if (errorKind !== "installation_limit") {
      return;
    }

    setIsRecovering(true);
    setError(null);

    try {
      const { address, signMessage, signerOptions } = await getWalletContext();
      const result = await revokeAllInstallationsByAddress(address, signMessage, signerOptions);

      console.info("XMTP installations revoked", {
        inboxId: result.inboxId,
        installationCount: result.installationCount,
        revokedCount: result.revokedCount,
      });

      setError(null);
      setErrorKind(null);
      setRetryNonce((prev) => prev + 1);
    } catch (err) {
      console.error("XMTP installation recovery failed:", err);
      setError(err instanceof Error ? err.message : "XMTP接続の復旧に失敗しました");
    } finally {
      setIsRecovering(false);
    }
  }, [errorKind, getWalletContext]);

  return {
    messages,
    sendMessage,
    recoverInstallationLimit,
    isLoading,
    isConnecting,
    isSending,
    isRecovering,
    error,
    errorKind,
    canMessagePeer,
    isReady,
  };
}
