"use client";

import { useEffect, useRef } from "react";
import { Box, Typography, Paper, Avatar } from "@mui/material";
import { Person, Agriculture } from "@mui/icons-material";
import type { XmtpMessage } from "@/lib/xmtp";

interface MessageListProps {
  messages: XmtpMessage[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "text.secondary",
        }}
      >
        <Typography variant="body2">メッセージを読み込み中...</Typography>
      </Box>
    );
  }

  if (messages.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "text.secondary",
        }}
      >
        <Typography variant="body2">
          メッセージがありません。会話を始めましょう！
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      {messages.map((message) => (
        <Box
          key={message.id}
          sx={{
            display: "flex",
            justifyContent: message.isSelf ? "flex-end" : "flex-start",
            alignItems: "flex-end",
            gap: 1,
          }}
        >
          {!message.isSelf && (
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: "success.main",
              }}
            >
              <Agriculture sx={{ fontSize: 18 }} />
            </Avatar>
          )}

          <Paper
            elevation={1}
            sx={{
              px: 2,
              py: 1,
              maxWidth: "70%",
              bgcolor: message.isSelf ? "primary.main" : "background.paper",
              color: message.isSelf ? "primary.contrastText" : "text.primary",
              borderRadius: message.isSelf
                ? "16px 16px 4px 16px"
                : "16px 16px 16px 4px",
              border: message.isSelf ? "none" : "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {message.content}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                mt: 0.5,
                opacity: 0.7,
                textAlign: message.isSelf ? "right" : "left",
              }}
            >
              {message.sent.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Typography>
          </Paper>

          {message.isSelf && (
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: "primary.main",
              }}
            >
              <Person sx={{ fontSize: 18 }} />
            </Avatar>
          )}
        </Box>
      ))}
      <div ref={bottomRef} />
    </Box>
  );
}
