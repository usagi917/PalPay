"use client";

import { useState, useCallback, useRef } from "react";
import { getMetaMaskProvider } from "@/lib/config";
import { buildAgentAuthMessage } from "@/lib/agent/auth";
import type { Locale } from "@/lib/locale";
import { formatTxError } from "@/lib/tx";
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
  sendMessage: (content: string, locale: Locale, userAddress?: string) => Promise<void>;
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
  const requestIdRef = useRef(0);

  const sendMessage = useCallback(async (content: string, locale: Locale, userAddress?: string) => {
    if (!content.trim()) return;

    const labels = locale === "ja"
      ? {
          loginRequired: "ログインが必要です",
          metamaskNotFound: "MetaMaskが見つかりません",
          nonceFailed: "Nonce取得に失敗しました",
          authFailed: "認証に失敗しました。ログイン状態を確認してください。",
          serviceUnavailable: "Agentサーバー設定が不足しています。管理者にお問い合わせください。",
          errorPrefix: "エラーが発生しました: ",
          walletRequestCancelled: "ウォレットで署名がキャンセルされました。承認すると続行できます。",
          unknownError: "不明なエラーが発生しました",
        }
      : {
          loginRequired: "Login is required.",
          metamaskNotFound: "MetaMask was not found.",
          nonceFailed: "Failed to fetch nonce",
          authFailed: "Authentication failed. Please check your login status.",
          serviceUnavailable: "Agent service is not configured correctly. Please contact the administrator.",
          errorPrefix: "An error occurred: ",
          walletRequestCancelled: "The wallet request was cancelled. Approve it in MetaMask to continue.",
          unknownError: "Unknown error",
        };

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const requestId = ++requestIdRef.current;
    const isLatestRequest = () =>
      requestIdRef.current === requestId && abortControllerRef.current === abortController;

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
      const buildAuthPayload = async (): Promise<ChatRequest["auth"]> => {
        if (!userAddress) {
          throw new Error(labels.loginRequired);
        }
        const provider = getMetaMaskProvider();
        if (!provider) {
          throw new Error(labels.metamaskNotFound);
        }

        const nonceResponse = await fetch(`/api/agent/nonce?sessionId=${encodeURIComponent(sessionId)}`, {
          method: "GET",
          signal: abortController.signal,
        });

        if (!nonceResponse.ok) {
          const errorData = await nonceResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `${labels.nonceFailed} (HTTP ${nonceResponse.status})`);
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

        return {
          address: userAddress,
          signature,
          nonce: nonceData.nonce,
          timestamp,
        };
      };

      const postChat = async (params: { auth?: ChatRequest["auth"]; token?: string | null }) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (params.token) {
          headers["X-Session-Token"] = params.token;
        }
        return fetch("/api/agent/chat", {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: content.trim(),
            sessionId,
            locale,
            userAddress,
            auth: params.auth,
          }),
          signal: abortController.signal,
        });
      };

      let auth: ChatRequest["auth"] | undefined;
      let token = sessionToken;

      if (authRequired && !token) {
        auth = await buildAuthPayload();
      }

      let response = await postChat({ auth, token });

      if (!response.ok) {
        const isAuthError = response.status === 401 || response.status === 403;
        if (isAuthError && authRequired && (token || auth)) {
          // Token expired: re-auth and retry once transparently
          if (isLatestRequest()) {
            setSessionToken(null);
          }
          token = null;
          auth = await buildAuthPayload();
          response = await postChat({ auth, token });
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const fallback = response.status === 401 || response.status === 403
          ? labels.authFailed
          : response.status === 503
            ? labels.serviceUnavailable
            : `HTTP ${response.status}`;
        const errorMessage = typeof errorData.error === "string"
          ? errorData.error
          : typeof errorData.details === "string"
            ? errorData.details
            : fallback;
        throw new Error(errorMessage);
      }

      const data: ChatResponse = await response.json();
      if (!isLatestRequest()) {
        return;
      }

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
      if (!isLatestRequest()) {
        return;
      }
      const errorMessage = formatTxError(err, labels.unknownError, labels.walletRequestCancelled);
      setError(errorMessage);

      // Add error message
      const errorMsg: ChatMessage = {
        id: generateMessageId(),
        role: "system",
        content: `${labels.errorPrefix}${errorMessage}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      if (isLatestRequest()) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
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
      abortControllerRef.current = null;
    }
    requestIdRef.current += 1;

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
