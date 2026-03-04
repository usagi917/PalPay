"use client";

import { useCallback, useMemo } from "react";
import { Box, Paper, Typography, IconButton, Tooltip } from "@mui/material";
import { motion } from "framer-motion";
import RefreshIcon from "@mui/icons-material/Refresh";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useI18n } from "@/lib/i18n";
import { CATEGORY_TYPE_MAP } from "@/lib/agent/types";
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
  const { locale, t } = useI18n();
  const {
    messages,
    state,
    draft,
    txPrepare,
    isLoading,
    isStreaming,
    streamingText,
    streamingToolCalls,
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
      sendMessage(content, locale, userAddress);
    },
    [locale, sendMessage, userAddress]
  );

  const getSuccessMessage = useCallback((action: string): string => {
    switch (action) {
      case "createListing":
        return t("agentSuccessCreateListing");
      case "lock":
        return t("agentSuccessLock");
      case "approve":
        return t("agentSuccessApprove");
      case "cancel":
        return t("agentSuccessCancel");
      case "confirmDelivery":
        return t("agentSuccessConfirmDelivery");
      default:
        return t("agentSuccessDefault");
    }
  }, [t]);

  const handleTxConfirm = useCallback(async () => {
    if (!txPrepare) return;
    try {
      let executionParams: Record<string, unknown> | undefined = txPrepare.params
        ? { ...txPrepare.params }
        : undefined;

      // Some model responses call prepare_transaction(createListing) without full draft params.
      // Fill missing fields from the latest draft kept in session state.
      if (txPrepare.action === "createListing" && draft) {
        executionParams ??= {};

        if (executionParams.categoryType === undefined) {
          executionParams.categoryType = CATEGORY_TYPE_MAP[draft.category];
        }

        if (typeof executionParams.title !== "string" || !executionParams.title.trim()) {
          executionParams.title = draft.title;
        }

        if (typeof executionParams.description !== "string") {
          executionParams.description = draft.description;
        }

        if (typeof executionParams.totalAmount === "number") {
          executionParams.totalAmount = String(executionParams.totalAmount);
        }
        if (typeof executionParams.totalAmount !== "string" || !executionParams.totalAmount.trim()) {
          executionParams.totalAmount = draft.totalAmount;
        }

        if (typeof executionParams.imageURI !== "string") {
          executionParams.imageURI = draft.imageURI || "";
        }
      }

      if (txPrepare.escrowAddress && !executionParams?.escrowAddress) {
        (executionParams ??= {}).escrowAddress = txPrepare.escrowAddress;
      }

      await onExecuteTx(txPrepare.action, executionParams);
      clearTxPrepare();
      appendMessage(getSuccessMessage(txPrepare.action), "assistant", "completed");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t("agentProcessFailed");
      appendMessage(`${t("agentErrorPrefix")} ${errorMessage}`, "system");
      throw err;
    }
  }, [txPrepare, draft, onExecuteTx, clearTxPrepare, appendMessage, getSuccessMessage, t]);

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
            {t("agentTitle")}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
            }}
          >
            {walletConnected
              ? `${t("agentIdLabel")}: ${userAddress?.slice(0, 6)}...${userAddress?.slice(-4)}`
              : t("agentNotLoggedIn")}
          </Typography>
        </Box>
        <Tooltip title={t("agentResetConversation")}>
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
            isStreaming={isStreaming}
            streamingText={streamingText}
            streamingToolCalls={streamingToolCalls}
            walletConnected={walletConnected}
            onConfirmTx={handleTxConfirm}
            onCancelTx={clearTxPrepare}
            fallbackTxPrepare={txPrepare}
            fallbackDraft={draft}
          />
          <MessageInput
            onSend={handleSend}
            disabled={isLoading || isStreaming || !walletConnected}
            placeholder={
              !walletConnected
                ? t("agentPleaseLogin")
                : `${t("agentMessageInputPlaceholder")} (${t("agentExampleLabel")}: ${nextInputHint || t("agentDefaultInputHint")})`
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
          <ThinkingPanel
            state={state}
            isLoading={isLoading}
            isStreaming={isStreaming}
            toolCalls={allToolCalls}
            streamingToolCalls={streamingToolCalls}
          />

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
                  {t("agentEmptyTitle")}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {t("agentEmptyDescriptionLine1")}
                  <br />
                  {t("agentEmptyDescriptionLine2")}
                </Typography>
              </Paper>
            </motion.div>
          )}
        </Box>
      </Box>
    </Box>
  );
}
