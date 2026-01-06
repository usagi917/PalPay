"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Client, Conversation } from "@xmtp/browser-sdk";
import { createXmtpClient, getEscrowConversation, canMessage, formatMessage, isTextMessage, type XmtpMessage } from "@/lib/xmtp";
import { getMetaMaskProvider } from "@/lib/config";

interface UseXmtpChatProps {
  escrowAddress: string;
  peerAddress: string;
  enabled?: boolean;
}

interface UseXmtpChatReturn {
  messages: XmtpMessage[];
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  isConnecting: boolean;
  isSending: boolean;
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const [canMessagePeer, setCanMessagePeer] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const clientRef = useRef<Client | null>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const selfAddressRef = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamRef = useRef<any>(null);

  // Initialize XMTP client and conversation
  useEffect(() => {
    if (!enabled || !escrowAddress || !peerAddress) {
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      setIsConnecting(true);
      setError(null);

      try {
        const provider = getMetaMaskProvider();
        if (!provider) {
          throw new Error("MetaMaskが接続されていません");
        }

        // Get wallet address
        const accounts = await provider.request({
          method: "eth_accounts",
        }) as string[];

        if (!accounts || accounts.length === 0) {
          throw new Error("ウォレットが接続されていません");
        }

        const address = accounts[0];
        if (!isMounted) return;

        selfAddressRef.current = address;

        // Create sign message function
        const signMessage = async (message: string): Promise<string> => {
          return await provider.request({
            method: "personal_sign",
            params: [message, address],
          }) as string;
        };

        // Create XMTP client
        const client = await createXmtpClient(address, signMessage);

        if (!isMounted) return;

        clientRef.current = client;

        // Check if peer can receive messages
        const canMsg = await canMessage(client, peerAddress);
        setCanMessagePeer(canMsg);

        if (!canMsg) {
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
          console.error("XMTP initialization error:", err);
          setError(err instanceof Error ? err.message : "XMTPの初期化に失敗しました");
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
      // Clean up stream
      if (streamRef.current) {
        streamRef.current.return?.();
      }
    };
  }, [escrowAddress, peerAddress, enabled]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!conversationRef.current || !content.trim()) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await conversationRef.current.send(content.trim());
    } catch (err) {
      console.error("Send message error:", err);
      setError(err instanceof Error ? err.message : "メッセージの送信に失敗しました");
    } finally {
      setIsSending(false);
    }
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    isConnecting,
    isSending,
    error,
    canMessagePeer,
    isReady,
  };
}
