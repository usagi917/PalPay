"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import { Box, TextField, IconButton, Paper, Chip, Stack } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { motion } from "framer-motion";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  quickActions?: Array<{ label: string; message: string }>;
}

const defaultQuickActions = [
  { label: "和牛を売りたい", message: "神戸牛A5ランクを50万円で売りたいです" },
  { label: "出品を見る", message: "現在の出品一覧を見せてください" },
  { label: "日本酒を売りたい", message: "純米大吟醸を10万円で売りたいです" },
];

export function MessageInput({
  onSend,
  disabled,
  placeholder,
  quickActions,
}: MessageInputProps) {
  const [input, setInput] = useState("");
  const canSend = !!input.trim() && !disabled;
  const actions = quickActions && quickActions.length > 0 ? quickActions : defaultQuickActions;

  const handleSend = useCallback(() => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleQuickAction = useCallback(
    (message: string) => {
      if (!disabled) {
        onSend(message);
      }
    },
    [disabled, onSend]
  );

  return (
    <Box sx={{ p: 2, borderTop: "1px solid var(--color-border)" }}>
      {/* Quick actions */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mb: 2,
          overflowX: "auto",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {actions.map((action) => (
          <motion.div
            key={action.label}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Chip
              label={action.label}
              onClick={() => handleQuickAction(action.message)}
              disabled={disabled}
              sx={{
                cursor: "pointer",
                background: "rgba(45, 62, 95, 0.6)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
                fontSize: "0.8rem",
                "&:hover": {
                  background: "rgba(212, 165, 116, 0.15)",
                  color: "var(--color-primary)",
                  borderColor: "var(--color-border-accent)",
                },
                "&.Mui-disabled": {
                  opacity: 0.5,
                },
              }}
            />
          </motion.div>
        ))}
      </Stack>

      {/* Input field */}
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          p: 1,
          background: "rgba(30, 41, 59, 0.8)",
          border: "1px solid var(--color-border)",
          borderRadius: 3,
          transition: "border-color 0.2s ease",
          "&:focus-within": {
            borderColor: "var(--color-primary)",
          },
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder || "メッセージを入力..."}
          variant="standard"
          InputProps={{
            disableUnderline: true,
            sx: {
              color: "var(--color-text)",
              fontSize: "0.95rem",
              "& ::placeholder": {
                color: "var(--color-text-muted)",
                opacity: 1,
              },
            },
          }}
          sx={{
            "& .MuiInputBase-root": {
              px: 1,
            },
          }}
        />
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <IconButton
            onClick={handleSend}
            disabled={!canSend}
            sx={{
              width: 44,
              height: 44,
              background: canSend
                ? "linear-gradient(135deg, var(--color-primary) 0%, #c49660 100%)"
                : "rgba(148, 163, 184, 0.2)",
              color: canSend ? "#fff" : "var(--color-text-muted)",
              transition: "all 0.2s ease",
              "&:hover": {
                background: canSend
                  ? "linear-gradient(135deg, #c49660 0%, var(--color-primary) 100%)"
                  : "rgba(148, 163, 184, 0.3)",
              },
              "&.Mui-disabled": {
                color: "var(--color-text-muted)",
              },
            }}
          >
            <SendIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </motion.div>
      </Paper>
    </Box>
  );
}
