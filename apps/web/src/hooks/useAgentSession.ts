"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ChatMessage,
  AgentState,
  ListingDraft,
  TxPrepareResult,
  ChatResponse,
} from "@/lib/agent/types";

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export interface UseAgentSessionReturn {
  sessionId: string;
  messages: ChatMessage[];
  state: AgentState;
  draft: ListingDraft | undefined;
  txPrepare: TxPrepareResult | undefined;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, userAddress?: string) => Promise<void>;
  clearSession: () => void;
  clearTxPrepare: () => void;
}

export function useAgentSession(): UseAgentSessionReturn {
  const [sessionId] = useState<string>(() => generateSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<AgentState>("idle");
  const [draft, setDraft] = useState<ListingDraft | undefined>();
  const [txPrepare, setTxPrepare] = useState<TxPrepareResult | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, userAddress?: string) => {
    if (!content.trim()) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content.trim(),
          sessionId,
          userAddress,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      // Add assistant message
      setMessages((prev) => [...prev, data.message]);
      setState(data.state);

      if (data.draft) {
        setDraft(data.draft);
      }

      if (data.txPrepare) {
        setTxPrepare(data.txPrepare);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);

      // Add error message
      const errorMsg: ChatMessage = {
        id: generateMessageId(),
        role: "system",
        content: `エラーが発生しました: ${errorMessage}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const clearSession = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear server session
    try {
      await fetch(`/api/agent/chat?sessionId=${sessionId}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error("Failed to clear server session:", e);
    }

    // Reset local state
    setMessages([]);
    setState("idle");
    setDraft(undefined);
    setTxPrepare(undefined);
    setError(null);
    setIsLoading(false);
  }, [sessionId]);

  const clearTxPrepare = useCallback(() => {
    setTxPrepare(undefined);
    setState((prev) => (prev === "tx_prepared" ? "draft_ready" : prev));
  }, []);

  return {
    sessionId,
    messages,
    state,
    draft,
    txPrepare,
    isLoading,
    error,
    sendMessage,
    clearSession,
    clearTxPrepare,
  };
}
