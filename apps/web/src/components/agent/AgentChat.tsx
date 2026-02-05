"use client";

import { useCallback, useMemo } from "react";
import { Box, Paper, Typography, IconButton, Tooltip } from "@mui/material";
import { motion } from "framer-motion";
import RefreshIcon from "@mui/icons-material/Refresh";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useAgentSession } from "@/hooks/useAgentSession";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ThinkingPanel } from "./ThinkingPanel";
import type { Address } from "viem";
import type { ToolCall } from "@/lib/agent/types";

interface AgentChatProps {
  userAddress?: Address;
  walletConnected: boolean;
  onExecuteTx: (action: string, params?: Record<string, unknown>) => Promise<void>;
}

export function AgentChat({ userAddress, walletConnected, onExecuteTx }: AgentChatProps) {
  const authRequired = process.env.NEXT_PUBLIC_AGENT_AUTH_REQUIRED !== "false";
  const {
    messages,
    state,
    draft,
    txPrepare,
    isLoading,
    nextInputHint,
    nextQuickActions,
    sendMessage,
    appendMessage,
    clearSession,
    clearTxPrepare,
  } = useAgentSession();

  // Collect all tool calls from messages
  const allToolCalls = useMemo(() => {
    return messages.reduce<ToolCall[]>((acc, msg) => {
      if (msg.toolCalls) {
        return [...acc, ...msg.toolCalls];
      }
      return acc;
    }, []);
  }, [messages]);

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content, userAddress);
    },
    [sendMessage, userAddress]
  );

  const getSuccessMessage = useCallback((action: string): string => {
    switch (action) {
      case "createListing":
        return "出品が完了しました。";
      case "lock":
        return "購入ロックが完了しました。";
      case "approve":
        return "承認が完了しました。";
      case "cancel":
        return "キャンセルが完了しました。";
      case "confirmDelivery":
        return "納品確認が完了しました。";
      default:
        return "トランザクションが完了しました。";
    }
  }, []);

  const handleTxConfirm = useCallback(async () => {
    if (!txPrepare) return;
    try {
      await onExecuteTx(txPrepare.action, txPrepare.params);
      clearTxPrepare();
      appendMessage(getSuccessMessage(txPrepare.action), "assistant", "completed");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "トランザクションに失敗しました";
      appendMessage(`エラーが発生しました: ${errorMessage}`, "system");
      throw err;
    }
  }, [txPrepare, onExecuteTx, clearTxPrepare, appendMessage, getSuccessMessage]);

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "rgba(10, 22, 40, 0.95)",
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid var(--color-border)",
          background: "rgba(30, 41, 59, 0.6)",
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, var(--color-primary) 0%, #c49660 100%)",
            color: "#fff",
          }}
        >
          <SmartToyIcon sx={{ fontSize: 24 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--color-text)",
            }}
          >
            B2B Escrow Agent
          </Typography>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
            }}
          >
            {walletConnected
              ? `接続中: ${userAddress?.slice(0, 6)}...${userAddress?.slice(-4)}`
              : "ウォレット未接続"}
          </Typography>
        </Box>
        <Tooltip title="会話をリセット">
          <IconButton
            onClick={clearSession}
            size="small"
            sx={{
              color: "var(--color-text-secondary)",
              "&:hover": {
                color: "var(--color-primary)",
                background: "rgba(212, 165, 116, 0.1)",
              },
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Main content area */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Chat area */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <MessageList
            messages={messages}
            isLoading={isLoading}
            walletConnected={walletConnected}
            onConfirmTx={handleTxConfirm}
            onCancelTx={clearTxPrepare}
            fallbackTxPrepare={txPrepare}
            fallbackDraft={draft}
          />
          <MessageInput
            onSend={handleSend}
            disabled={isLoading || (authRequired && !walletConnected)}
            placeholder={
              !walletConnected
                ? "ウォレットを接続してください"
                : `メッセージを入力...（例：${nextInputHint || "和牛を売りたい"}）`
            }
            quickActions={nextQuickActions.length > 0 ? nextQuickActions : undefined}
          />
        </Box>

        {/* Side panel */}
        <Box
          sx={{
            width: { xs: 0, md: 380 },
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            borderLeft: "1px solid var(--color-border)",
            background: "rgba(30, 41, 59, 0.3)",
            overflow: "auto",
            p: 2,
          }}
        >
          {/* Thinking panel */}
          <ThinkingPanel state={state} isLoading={isLoading} toolCalls={allToolCalls} />

          {/* Empty state */}
          {!draft && !txPrepare && state === "idle" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  background: "rgba(30, 41, 59, 0.5)",
                  border: "1px dashed var(--color-border)",
                  borderRadius: 2,
                  textAlign: "center",
                }}
              >
                <SmartToyIcon
                  sx={{
                    fontSize: 48,
                    color: "var(--color-text-muted)",
                    mb: 1,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: "0.9rem",
                    color: "var(--color-text-secondary)",
                    mb: 1,
                  }}
                >
                  AIアシスタントにお任せください
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  「和牛を売りたい」「出品を見せて」など
                  自然な言葉で話しかけてください
                </Typography>
              </Paper>
            </motion.div>
          )}
        </Box>
      </Box>
    </Box>
  );
}
