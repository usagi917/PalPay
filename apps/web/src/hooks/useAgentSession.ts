"use client";

import { useState, useCallback, useRef } from "react";
import { getMetaMaskProvider } from "@/lib/config";
import { buildAgentAuthMessage } from "@/lib/agent/auth";
import type {
  ChatMessage,
  AgentState,
  ListingDraft,
  TxPrepareResult,
  ChatResponse,
  ChatRequest,
  MessageRole,
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
  nextInputHint: string | null;
  nextQuickActions: Array<{ label: string; message: string }>;
  sendMessage: (content: string, userAddress?: string) => Promise<void>;
  appendMessage: (content: string, role?: MessageRole, nextState?: AgentState) => void;
  clearSession: () => void;
  clearTxPrepare: () => void;
}

export function useAgentSession(): UseAgentSessionReturn {
  const authRequired = process.env.NEXT_PUBLIC_AGENT_AUTH_REQUIRED !== "false";
  const [sessionId] = useState<string>(() => generateSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<AgentState>("idle");
  const [draft, setDraft] = useState<ListingDraft | undefined>();
  const [txPrepare, setTxPrepare] = useState<TxPrepareResult | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextInputHint, setNextInputHint] = useState<string | null>(null);
  const [nextQuickActions, setNextQuickActions] = useState<Array<{ label: string; message: string }>>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
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
      let auth: ChatRequest["auth"] | undefined;

      if (authRequired && !sessionToken) {
        if (!userAddress) {
          throw new Error("ウォレット接続が必要です");
        }
        const provider = getMetaMaskProvider();
        if (!provider) {
          throw new Error("MetaMaskが見つかりません");
        }

        const nonceResponse = await fetch(`/api/agent/nonce?sessionId=${encodeURIComponent(sessionId)}`, {
          method: "GET",
          signal: abortControllerRef.current.signal,
        });

        if (!nonceResponse.ok) {
          const errorData = await nonceResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Nonce取得に失敗しました (HTTP ${nonceResponse.status})`);
        }

        const nonceData = await nonceResponse.json() as { nonce: string };
        const timestamp = Date.now();
        const authMessage = buildAgentAuthMessage({
          sessionId,
          nonce: nonceData.nonce,
          timestamp,
        });

        const signature = await provider.request({
          method: "personal_sign",
          params: [authMessage, userAddress],
        }) as string;

        auth = {
          address: userAddress,
          signature,
          nonce: nonceData.nonce,
          timestamp,
        };
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (sessionToken) {
        headers["X-Session-Token"] = sessionToken;
      }

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: content.trim(),
          sessionId,
          userAddress,
          auth,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if ((response.status === 401 || response.status === 403) && sessionToken) {
          setSessionToken(null);
          throw new Error("セッション認証が切れました。もう一度送信してください。");
        }
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

      if (data.sessionToken) {
        setSessionToken(data.sessionToken);
      }

      setNextInputHint(data.nextInputHint ?? null);
      setNextQuickActions(Array.isArray(data.nextQuickActions) ? data.nextQuickActions : []);
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
  }, [authRequired, sessionId, sessionToken]);

  const appendMessage = useCallback(
    (content: string, role: MessageRole = "assistant", nextState?: AgentState) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const localMessage: ChatMessage = {
        id: generateMessageId(),
        role,
        content: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, localMessage]);
      if (nextState) {
        setState(nextState);
      }
    },
    []
  );

  const clearSession = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear server session
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers["X-Session-Token"] = sessionToken;
      }
      await fetch(`/api/agent/chat?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers,
      });
    } catch (e) {
      console.error("Failed to clear server session:", e);
    }

    // Reset local state
    setMessages([]);
    setState("idle");
    setDraft(undefined);
    setTxPrepare(undefined);
    setSessionToken(null);
    setError(null);
    setIsLoading(false);
    setNextInputHint(null);
    setNextQuickActions([]);
  }, [sessionId, sessionToken]);

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
    nextInputHint,
    nextQuickActions,
    sendMessage,
    appendMessage,
    clearSession,
    clearTxPrepare,
  };
}
