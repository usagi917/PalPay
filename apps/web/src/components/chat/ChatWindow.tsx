"use client";

import { Box, Paper, Typography, Alert, CircularProgress, Chip } from "@mui/material";
import { Chat, CheckCircle, Error as ErrorIcon } from "@mui/icons-material";
import { useXmtpChat } from "@/hooks/useXmtpChat";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { shortenAddress } from "@/lib/hooks";

interface ChatWindowProps {
  escrowAddress: string;
  peerAddress: string;
  peerLabel?: string; // "出品者" or "購入者"
  enabled?: boolean;
  height?: number | string;
}

export function ChatWindow({
  escrowAddress,
  peerAddress,
  peerLabel = "相手",
  enabled = true,
  height = 400,
}: ChatWindowProps) {
  const {
    messages,
    sendMessage,
    isLoading,
    isConnecting,
    isSending,
    error,
    canMessagePeer,
    isReady,
  } = useXmtpChat({ escrowAddress, peerAddress, enabled });

  if (!enabled) {
    return null;
  }

  return (
    <Paper
      elevation={2}
      sx={{
        display: "flex",
        flexDirection: "column",
        height,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          bgcolor: "primary.main",
          color: "white",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chat />
          <Typography variant="subtitle1" fontWeight="bold">
            {peerLabel}とのチャット
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isReady && (
            <Chip
              icon={<CheckCircle sx={{ fontSize: 16, color: "white !important" }} />}
              label="接続中"
              size="small"
              sx={{
                bgcolor: "rgba(255,255,255,0.2)",
                color: "white",
                "& .MuiChip-icon": { color: "white" },
              }}
            />
          )}
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {shortenAddress(peerAddress)}
          </Typography>
        </Box>
      </Box>

      {/* Connection Status */}
      {isConnecting && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            py: 2,
            bgcolor: "action.hover",
          }}
        >
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            XMTPに接続中...
          </Typography>
        </Box>
      )}

      {/* Error Display */}
      {error && (
        <Alert
          severity={canMessagePeer ? "error" : "warning"}
          icon={<ErrorIcon />}
          sx={{ borderRadius: 0 }}
        >
          {error}
        </Alert>
      )}

      {/* Peer Cannot Message Warning */}
      {!isConnecting && !canMessagePeer && !error && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          {peerLabel}がまだXMTPを有効にしていません。
          有効になると自動的にチャットが開始されます。
        </Alert>
      )}

      {/* Messages */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        disabled={!isReady}
        isSending={isSending}
        placeholder={
          isReady
            ? "メッセージを入力... (Shift+Enterで送信 / 送信ボタン)"
            : "接続を待っています..."
        }
      />
    </Paper>
  );
}
