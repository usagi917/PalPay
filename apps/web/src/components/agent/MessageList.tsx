"use client";

import { useRef, useEffect, useMemo } from "react";
import { Box, Paper, Typography, Chip, Stack } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import ErrorIcon from "@mui/icons-material/Error";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CircularProgress from "@mui/material/CircularProgress";
import type { ChatMessage, ListingDraft, TxPrepareResult, StreamingToolCall } from "@/lib/agent/types";
import { TxConfirmPanel } from "./TxConfirmPanel";
import { DraftPreview } from "./DraftPreview";
import { useI18n } from "@/lib/i18n";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
  streamingText?: string;
  streamingToolCalls?: StreamingToolCall[];
  walletConnected: boolean;
  onConfirmTx: () => Promise<void>;
  onCancelTx: () => void;
  fallbackTxPrepare?: TxPrepareResult;
  fallbackDraft?: ListingDraft;
}

function ToolCallBadge({ name }: { name: string }) {
  const { t } = useI18n();
  const toolLabels: Record<string, string> = {
    get_listings: t("agentToolGetListings"),
    get_listing_detail: t("agentToolGetListingDetail"),
    prepare_listing_draft: t("agentToolPrepareListingDraft"),
    get_milestones_for_category: t("agentToolGetMilestones"),
    prepare_transaction: t("agentToolPrepareTransaction"),
  };

  return (
    <Chip
      icon={<BuildIcon sx={{ fontSize: 14 }} />}
      label={toolLabels[name] || name}
      size="small"
      sx={{
        fontSize: "0.7rem",
        height: 24,
        background: "rgba(212, 165, 116, 0.15)",
        color: "var(--color-primary)",
        border: "1px solid rgba(212, 165, 116, 0.3)",
        "& .MuiChip-icon": {
          color: "var(--color-primary)",
        },
      }}
    />
  );
}

function StreamingToolCallBadge({ tc }: { tc: StreamingToolCall }) {
  const { t } = useI18n();
  const toolLabels: Record<string, { label: string; icon: string }> = {
    get_listings: { label: t("agentToolGetListings"), icon: "📋" },
    get_listing_detail: { label: t("agentToolGetListingDetail"), icon: "🔍" },
    prepare_listing_draft: { label: t("agentToolPrepareListingDraft"), icon: "✏️" },
    get_milestones_for_category: { label: t("agentToolGetMilestones"), icon: "📊" },
    prepare_transaction: { label: t("agentToolPrepareTransaction"), icon: "🔐" },
  };
  const toolInfo = toolLabels[tc.name] || { label: tc.name, icon: "🔧" };

  const statusIcon =
    tc.status === "running" ? (
      <CircularProgress size={12} sx={{ color: "var(--color-primary)" }} />
    ) : tc.status === "error" ? (
      <span style={{ fontSize: 12 }}>❌</span>
    ) : (
      <CheckCircleIcon sx={{ fontSize: 14, color: "#22c55e" }} />
    );

  const chipBg =
    tc.status === "running"
      ? "rgba(212, 165, 116, 0.1)"
      : tc.status === "error"
        ? "rgba(239, 68, 68, 0.1)"
        : "rgba(34, 197, 94, 0.1)";

  const chipColor =
    tc.status === "running"
      ? "var(--color-primary)"
      : tc.status === "error"
        ? "#ef4444"
        : "#22c55e";

  const chipBorder =
    tc.status === "running"
      ? "1px solid rgba(212, 165, 116, 0.3)"
      : tc.status === "error"
        ? "1px solid rgba(239, 68, 68, 0.3)"
        : "1px solid rgba(34, 197, 94, 0.3)";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Chip
        icon={statusIcon}
        label={`${toolInfo.icon} ${toolInfo.label}`}
        size="small"
        sx={{
          fontSize: "0.7rem",
          height: 24,
          background: chipBg,
          color: chipColor,
          border: chipBorder,
          "& .MuiChip-icon": {
            color: "inherit",
          },
        }}
      />
    </motion.div>
  );
}

const roleStyles: Record<string, { icon: typeof PersonIcon; bg: string; border: string }> = {
  user: {
    icon: PersonIcon,
    bg: "rgba(45, 62, 95, 0.8)",
    border: "rgba(212, 165, 116, 0.3)",
  },
  system: {
    icon: ErrorIcon,
    bg: "rgba(239, 68, 68, 0.1)",
    border: "rgba(239, 68, 68, 0.3)",
  },
  assistant: {
    icon: SmartToyIcon,
    bg: "rgba(30, 41, 59, 0.9)",
    border: "rgba(148, 163, 184, 0.2)",
  },
};

function MessageBubble({ message }: { message: ChatMessage }) {
  const { locale } = useI18n();
  const isUser = message.role === "user";
  const style = roleStyles[message.role] || roleStyles.assistant;
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: isUser ? "row-reverse" : "row",
          gap: 1.5,
          mb: 2,
        }}
      >
        {/* Avatar */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isUser
              ? "linear-gradient(135deg, var(--color-primary) 0%, #c49660 100%)"
              : "linear-gradient(135deg, #64748b 0%, #475569 100%)",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Box>

        {/* Message content */}
        <Paper
          elevation={0}
          sx={{
            maxWidth: "75%",
            p: 2,
            background: style.bg,
            border: `1px solid ${style.border}`,
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          }}
        >
          {/* Tool calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} sx={{ mb: 1.5 }}>
              {message.toolCalls.map((tc, idx) => (
                <ToolCallBadge key={idx} name={tc.name} />
              ))}
            </Stack>
          )}

          {/* Message text */}
          <Typography
            sx={{
              fontSize: "0.9rem",
              lineHeight: 1.7,
              color: message.role === "system" ? "#ef4444" : "var(--color-text)",
              whiteSpace: "pre-wrap",
            }}
          >
            {message.content}
          </Typography>

          {/* Timestamp */}
          <Typography
            sx={{
              fontSize: "0.7rem",
              color: "var(--color-text-muted)",
              mt: 1,
              textAlign: isUser ? "right" : "left",
            }}
          >
            {new Date(message.timestamp).toLocaleTimeString(locale === "ja" ? "ja-JP" : "en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Typography>
        </Paper>
      </Box>
    </motion.div>
  );
}

function StreamingMessage({
  text,
  toolCalls,
}: {
  text: string;
  toolCalls: StreamingToolCall[];
}) {
  const style = roleStyles.assistant;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          mb: 2,
        }}
      >
        {/* Avatar */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <SmartToyIcon sx={{ fontSize: 20 }} />
        </Box>

        {/* Message content */}
        <Paper
          elevation={0}
          sx={{
            maxWidth: "75%",
            p: 2,
            background: style.bg,
            border: `1px solid ${style.border}`,
            borderRadius: "16px 16px 16px 4px",
            minWidth: 60,
          }}
        >
          {/* Streaming tool calls */}
          {toolCalls.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} sx={{ mb: text ? 1.5 : 0 }}>
              <AnimatePresence>
                {toolCalls.map((tc) => (
                  <StreamingToolCallBadge key={tc.callId} tc={tc} />
                ))}
              </AnimatePresence>
            </Stack>
          )}

          {/* Streaming text with blinking cursor */}
          {(text || toolCalls.length === 0) && (
            <Typography
              sx={{
                fontSize: "0.9rem",
                lineHeight: 1.7,
                color: "var(--color-text)",
                whiteSpace: "pre-wrap",
              }}
            >
              {text}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  display: "inline-block",
                  width: "2px",
                  height: "1em",
                  background: "var(--color-primary)",
                  marginLeft: "1px",
                  verticalAlign: "text-bottom",
                }}
              />
            </Typography>
          )}
        </Paper>
      </Box>
    </motion.div>
  );
}

function LoadingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
            color: "#fff",
          }}
        >
          <SmartToyIcon sx={{ fontSize: 20 }} />
        </Box>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            background: "rgba(30, 41, 59, 0.9)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: "16px 16px 16px 4px",
          }}
        >
          <Stack direction="row" spacing={0.5}>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--color-primary)",
                  }}
                />
              </motion.div>
            ))}
          </Stack>
        </Paper>
      </Box>
    </motion.div>
  );
}

export function MessageList({
  messages,
  isLoading,
  isStreaming,
  streamingText,
  streamingToolCalls,
  walletConnected,
  onConfirmTx,
  onCancelTx,
  fallbackTxPrepare,
  fallbackDraft,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTxPrepareMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.txPrepare) return messages[i].id;
    }
    return null;
  }, [messages]);
  const shouldShowTxCard = !!fallbackTxPrepare;
  const shouldRenderFallback = shouldShowTxCard && !lastTxPrepareMessageId;

  const lastDraftMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg?.toolCalls?.some((tc) => tc.name === "prepare_listing_draft")) {
        return msg.id;
      }
    }
    return null;
  }, [messages]);
  const shouldShowDraftCard = !!fallbackDraft;
  const shouldRenderDraftFallback = shouldShowDraftCard && !lastDraftMessageId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isStreaming, streamingText, fallbackDraft]);

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        p: 2,
        "&::-webkit-scrollbar": {
          width: 6,
        },
        "&::-webkit-scrollbar-track": {
          background: "rgba(30, 41, 59, 0.5)",
        },
        "&::-webkit-scrollbar-thumb": {
          background: "rgba(148, 163, 184, 0.3)",
          borderRadius: 3,
        },
      }}
    >
      <AnimatePresence>
        {messages.map((message) => (
          <Box key={message.id}>
            <MessageBubble message={message} />
            {shouldShowDraftCard && message.id === lastDraftMessageId && (
              <Box sx={{ ml: "48px", maxWidth: "75%", mb: 2 }}>
                <DraftPreview draft={fallbackDraft!} />
              </Box>
            )}
            {shouldShowTxCard && message.id === lastTxPrepareMessageId && (
              <Box sx={{ ml: "48px", maxWidth: "75%", mb: 2 }}>
                <TxConfirmPanel
                  txPrepare={fallbackTxPrepare!}
                  draft={message.draft || fallbackDraft}
                  onConfirm={onConfirmTx}
                  onCancel={onCancelTx}
                  walletConnected={walletConnected}
                />
              </Box>
            )}
          </Box>
        ))}
      </AnimatePresence>
      {/* Show streaming message instead of loading dots when streaming */}
      {isStreaming ? (
        <StreamingMessage
          text={streamingText || ""}
          toolCalls={streamingToolCalls || []}
        />
      ) : (
        isLoading && <LoadingIndicator />
      )}
      {shouldRenderDraftFallback && (
        <Box sx={{ ml: "48px", maxWidth: "75%", mb: 2 }}>
          <DraftPreview draft={fallbackDraft!} />
        </Box>
      )}
      {shouldRenderFallback && (
        <Box sx={{ ml: "48px", maxWidth: "75%", mb: 2 }}>
          <TxConfirmPanel
            txPrepare={fallbackTxPrepare!}
            draft={fallbackDraft}
            onConfirm={onConfirmTx}
            onCancel={onCancelTx}
            walletConnected={walletConnected}
          />
        </Box>
      )}
      <div ref={bottomRef} />
    </Box>
  );
}
