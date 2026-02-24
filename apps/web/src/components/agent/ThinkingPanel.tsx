"use client";

import { Box, Paper, Typography, Chip, Stack, Collapse, LinearProgress } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import PsychologyIcon from "@mui/icons-material/Psychology";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { AgentState, ToolCall } from "@/lib/agent/types";

interface ThinkingPanelProps {
  state: AgentState;
  isLoading: boolean;
  toolCalls?: ToolCall[];
}

const stateLabels: Record<AgentState, { label: string; description: string }> = {
  idle: { label: "待機中", description: "メッセージを入力してください" },
  gathering_info: { label: "情報収集中", description: "必要な情報を取得しています" },
  draft_ready: { label: "ドラフト作成完了", description: "内容を確認してください" },
  awaiting_confirm: { label: "確認待ち", description: "ユーザーの確認を待っています" },
  tx_prepared: { label: "確認待ち", description: "確認をお願いします" },
  completed: { label: "完了", description: "処理が完了しました" },
};

const stateChipStyles: Record<string, { background: string; color: string; border: string }> = {
  tx_prepared: {
    background: "rgba(34, 197, 94, 0.15)",
    color: "#22c55e",
    border: "1px solid rgba(34, 197, 94, 0.3)",
  },
  draft_ready: {
    background: "rgba(212, 165, 116, 0.15)",
    color: "var(--color-primary)",
    border: "1px solid rgba(212, 165, 116, 0.3)",
  },
};

const defaultChipStyle = {
  background: "rgba(148, 163, 184, 0.15)",
  color: "var(--color-text-secondary)",
  border: "1px solid rgba(148, 163, 184, 0.3)",
};

const toolLabels: Record<string, { label: string; icon: string }> = {
  get_listings: { label: "出品一覧取得", icon: "📋" },
  get_listing_detail: { label: "出品詳細取得", icon: "🔍" },
  prepare_listing_draft: { label: "ドラフト作成", icon: "✏️" },
  get_milestones_for_category: { label: "マイルストーン取得", icon: "📊" },
  prepare_transaction: { label: "操作準備", icon: "🔐" },
};

function getToolChipStyle(tc: ToolCall): { background: string; color: string; border: string } {
  const hasResult = tc.result !== undefined;
  const hasError = hasResult && typeof tc.result === "object" && tc.result !== null && "error" in tc.result;

  if (!hasResult) {
    return {
      background: "rgba(212, 165, 116, 0.1)",
      color: "var(--color-primary)",
      border: "1px solid rgba(212, 165, 116, 0.3)",
    };
  }
  if (hasError) {
    return {
      background: "rgba(239, 68, 68, 0.1)",
      color: "#ef4444",
      border: "1px solid rgba(239, 68, 68, 0.3)",
    };
  }
  return {
    background: "rgba(34, 197, 94, 0.1)",
    color: "#22c55e",
    border: "1px solid rgba(34, 197, 94, 0.3)",
  };
}

export function ThinkingPanel({ state, isLoading, toolCalls }: ThinkingPanelProps) {
  const stateInfo = stateLabels[state] || stateLabels.idle;
  const recentToolCalls = toolCalls?.slice(-3) || [];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        background: "rgba(30, 41, 59, 0.6)",
        border: "1px solid var(--color-border)",
        borderRadius: 2,
        mb: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <motion.div
          animate={isLoading ? { rotate: 360 } : {}}
          transition={{ duration: 2, repeat: isLoading ? Infinity : 0, ease: "linear" }}
        >
          <PsychologyIcon
            sx={{
              fontSize: 24,
              color: isLoading ? "var(--color-primary)" : "var(--color-text-secondary)",
            }}
          />
        </motion.div>
        <Typography
          sx={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--color-text)",
          }}
        >
          Agent Thinking
        </Typography>
        <Chip
          label={stateInfo.label}
          size="small"
          sx={{
            ml: "auto",
            fontSize: "0.7rem",
            height: 22,
            ...(stateChipStyles[state] || defaultChipStyle),
          }}
        />
      </Box>

      {/* Loading progress */}
      <Collapse in={isLoading}>
        <LinearProgress
          sx={{
            mb: 1.5,
            height: 3,
            borderRadius: 1.5,
            background: "rgba(148, 163, 184, 0.1)",
            "& .MuiLinearProgress-bar": {
              background: "linear-gradient(90deg, var(--color-primary) 0%, #c49660 100%)",
            },
          }}
        />
      </Collapse>

      {/* State description */}
      <Typography
        sx={{
          fontSize: "0.8rem",
          color: "var(--color-text-muted)",
          mb: recentToolCalls.length > 0 ? 1.5 : 0,
        }}
      >
        {stateInfo.description}
      </Typography>

      {/* Tool calls */}
      <AnimatePresence>
        {recentToolCalls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Box
              sx={{
                pt: 1.5,
                borderTop: "1px solid var(--color-border)",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  color: "var(--color-text-muted)",
                  mb: 1,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Tool Use
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                {recentToolCalls.map((tc, idx) => {
                  const toolInfo = toolLabels[tc.name] || { label: tc.name, icon: "🔧" };
                  const hasResult = tc.result !== undefined;
                  const hasError = hasResult && typeof tc.result === "object" && tc.result !== null && "error" in tc.result;
                  const chipStyle = getToolChipStyle(tc);

                  let chipIcon;
                  if (!hasResult) {
                    chipIcon = <BuildIcon sx={{ fontSize: 14 }} />;
                  } else if (hasError) {
                    chipIcon = <span style={{ fontSize: 14 }}>❌</span>;
                  } else {
                    chipIcon = <CheckCircleIcon sx={{ fontSize: 14, color: "#22c55e" }} />;
                  }

                  return (
                    <motion.div
                      key={`${tc.name}-${idx}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <Chip
                        icon={chipIcon}
                        label={`${toolInfo.icon} ${toolInfo.label}`}
                        size="small"
                        sx={{
                          fontSize: "0.7rem",
                          height: 26,
                          ...chipStyle,
                          "& .MuiChip-icon": {
                            color: "inherit",
                          },
                        }}
                      />
                    </motion.div>
                  );
                })}
              </Stack>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Paper>
  );
}
