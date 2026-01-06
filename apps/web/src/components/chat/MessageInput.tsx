"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import { Box, TextField, IconButton, CircularProgress } from "@mui/material";
import { Send } from "@mui/icons-material";

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  isSending = false,
  placeholder = "メッセージを入力...",
}: MessageInputProps) {
  const [message, setMessage] = useState("");

  const handleSend = useCallback(async () => {
    if (!message.trim() || disabled || isSending) return;

    const content = message;
    setMessage("");
    await onSend(content);
  }, [message, disabled, isSending, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        p: 2,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <TextField
        fullWidth
        size="small"
        multiline
        maxRows={4}
        placeholder={placeholder}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isSending}
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: 3,
          },
        }}
      />
      <IconButton
        color="primary"
        onClick={handleSend}
        disabled={!message.trim() || disabled || isSending}
        sx={{
          bgcolor: "primary.main",
          color: "white",
          "&:hover": {
            bgcolor: "primary.dark",
          },
          "&:disabled": {
            bgcolor: "grey.300",
            color: "grey.500",
          },
        }}
      >
        {isSending ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          <Send />
        )}
      </IconButton>
    </Box>
  );
}
