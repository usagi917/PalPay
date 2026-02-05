"use client";

import { useRef, useEffect } from "react";
import { Box, Paper, Typography, Chip, Stack } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import ErrorIcon from "@mui/icons-material/Error";
import BuildIcon from "@mui/icons-material/Build";
import type { ChatMessage } from "@/lib/agent/types";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

function ToolCallBadge({ name }: { name: string }) {
  const toolLabels: Record<string, string> = {
    get_listings: "出品一覧取得",
    get_listing_detail: "出品詳細取得",
    prepare_listing_draft: "ドラフト作成",
    get_milestones_for_category: "マイルストーン取得",
    prepare_transaction: "TX準備",
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const getIcon = () => {
    if (isUser) return <PersonIcon sx={{ fontSize: 20 }} />;
    if (isSystem) return <ErrorIcon sx={{ fontSize: 20 }} />;
    return <SmartToyIcon sx={{ fontSize: 20 }} />;
  };

  const getBgColor = () => {
    if (isUser) return "rgba(45, 62, 95, 0.8)";
    if (isSystem) return "rgba(239, 68, 68, 0.1)";
    return "rgba(30, 41, 59, 0.9)";
  };

  const getBorderColor = () => {
    if (isUser) return "rgba(212, 165, 116, 0.3)";
    if (isSystem) return "rgba(239, 68, 68, 0.3)";
    return "rgba(148, 163, 184, 0.2)";
  };

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
          {getIcon()}
        </Box>

        {/* Message content */}
        <Paper
          elevation={0}
          sx={{
            maxWidth: "75%",
            p: 2,
            background: getBgColor(),
            border: `1px solid ${getBorderColor()}`,
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
              color: isSystem ? "#ef4444" : "var(--color-text)",
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
            {new Date(message.timestamp).toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Typography>
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

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
          <MessageBubble key={message.id} message={message} />
        ))}
      </AnimatePresence>
      {isLoading && <LoadingIndicator />}
      <div ref={bottomRef} />
    </Box>
  );
}
