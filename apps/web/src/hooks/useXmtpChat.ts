"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Client, Conversation } from "@xmtp/browser-sdk";
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
} from "@/lib/xmtp";
import { getMetaMaskProvider } from "@/lib/config";

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

  const clientRef = useRef<Client | null>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const selfAddressRef = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamRef = useRef<any>(null);

  const closeStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.return?.();
      streamRef.current = null;
    }
  }, []);

  const getWalletContext = useCallback(async () => {
    const provider = getMetaMaskProvider();
    if (!provider) {
      throw new Error("MetaMaskが接続されていません");
    }

    const accounts = await provider.request({
      method: "eth_accounts",
    }) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("ログインが必要です");
    }

    const address = accounts[0];
    const signMessage = async (message: string): Promise<string> => {
      return await provider.request({
        method: "personal_sign",
        params: [message, address],
      }) as string;
    };

    return { address, signMessage };
  }, []);

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
      closeStream();

      try {
        const { address, signMessage } = await getWalletContext();
        if (!isMounted) return;

        selfAddressRef.current = address;

        // Create XMTP client
        const client = await createXmtpClient(address, signMessage);

        if (!isMounted) return;

        clientRef.current = client;

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

        // Load existing messages
        setIsLoading(true);
        const existingMessages = await conversation.messages();

        if (!isMounted) return;

        setMessages(
          existingMessages
            .filter(isTextMessage)
            .map((msg) => formatMessage(msg, address))
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
            return [...prev, formatMessage(message, selfAddressRef.current)];
          });
        }
      } catch (err) {
        if (isMounted) {
          const installationLimit = isInstallationLimitError(err);
          console.error("XMTP initialization error:", err, {
            errorKind: installationLimit ? "installation_limit" : "unknown",
            escrowAddress,
            peerAddress,
            selfAddress: selfAddressRef.current || null,
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
    if (!conversationRef.current || !content.trim()) {
      return;
    }

    setIsSending(true);
    setError(null);
    setErrorKind(null);

    try {
      await conversationRef.current.send(content.trim());
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
      const { address, signMessage } = await getWalletContext();
      const result = await revokeAllInstallationsByAddress(address, signMessage);

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
