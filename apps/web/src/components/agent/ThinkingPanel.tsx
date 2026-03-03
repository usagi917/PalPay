"use client";

import { Box, Paper, Typography, Chip, Stack, Collapse, LinearProgress } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import PsychologyIcon from "@mui/icons-material/Psychology";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CircularProgress from "@mui/material/CircularProgress";
import { useI18n } from "@/lib/i18n";
import type { AgentState, ToolCall, StreamingToolCall } from "@/lib/agent/types";

interface ThinkingPanelProps {
  state: AgentState;
  isLoading: boolean;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  streamingToolCalls?: StreamingToolCall[];
}

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

function getStreamingToolChipStyle(status: StreamingToolCall["status"]): { background: string; color: string; border: string } {
  switch (status) {
    case "running":
      return {
        background: "rgba(212, 165, 116, 0.1)",
        color: "var(--color-primary)",
        border: "1px solid rgba(212, 165, 116, 0.3)",
      };
    case "error":
      return {
        background: "rgba(239, 68, 68, 0.1)",
        color: "#ef4444",
        border: "1px solid rgba(239, 68, 68, 0.3)",
      };
    case "completed":
      return {
        background: "rgba(34, 197, 94, 0.1)",
        color: "#22c55e",
        border: "1px solid rgba(34, 197, 94, 0.3)",
      };
  }
}

export function ThinkingPanel({ state, isLoading, isStreaming, toolCalls, streamingToolCalls }: ThinkingPanelProps) {
  const { t } = useI18n();
  const stateLabels: Record<AgentState, { label: string; description: string }> = {
    idle: { label: t("agentStateIdleLabel"), description: t("agentStateIdleDescription") },
    gathering_info: { label: t("agentStateGatheringLabel"), description: t("agentStateGatheringDescription") },
    draft_ready: { label: t("agentStateDraftReadyLabel"), description: t("agentStateDraftReadyDescription") },
    awaiting_confirm: { label: t("agentStateAwaitingConfirmLabel"), description: t("agentStateAwaitingConfirmDescription") },
    tx_prepared: { label: t("agentStateTxPreparedLabel"), description: t("agentStateTxPreparedDescription") },
    completed: { label: t("agentStateCompletedLabel"), description: t("agentStateCompletedDescription") },
  };
  const toolLabels: Record<string, { label: string; icon: string }> = {
    get_listings: { label: t("agentToolGetListings"), icon: "📋" },
    get_listing_detail: { label: t("agentToolGetListingDetail"), icon: "🔍" },
    prepare_listing_draft: { label: t("agentToolPrepareListingDraft"), icon: "✏️" },
    get_milestones_for_category: { label: t("agentToolGetMilestones"), icon: "📊" },
    prepare_transaction: { label: t("agentToolPrepareTransaction"), icon: "🔐" },
    analyze_market: { label: "Market Analysis", icon: "📈" },
    assess_risk: { label: "Risk Assessment", icon: "⚠️" },
    suggest_next_action: { label: "Next Action", icon: "💡" },
  };
  const stateInfo = stateLabels[state] || stateLabels.idle;

  // Merge: show streaming tool calls during streaming, otherwise show history tool calls
  const activeStreamingCalls = streamingToolCalls || [];
  const recentToolCalls = toolCalls?.slice(-3) || [];
  const showStreamingCalls = isStreaming && activeStreamingCalls.length > 0;
  const showHistoryCalls = !showStreamingCalls && recentToolCalls.length > 0;

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
          {t("agentThinkingTitle")}
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

      {/* Loading progress — pulse animation during streaming */}
      <Collapse in={isLoading}>
        <LinearProgress
          variant={isStreaming ? "indeterminate" : "indeterminate"}
          sx={{
            mb: 1.5,
            height: 3,
            borderRadius: 1.5,
            background: "rgba(148, 163, 184, 0.1)",
            "& .MuiLinearProgress-bar": {
              background: isStreaming
                ? "linear-gradient(90deg, var(--color-primary) 0%, #c49660 50%, var(--color-primary) 100%)"
                : "linear-gradient(90deg, var(--color-primary) 0%, #c49660 100%)",
              ...(isStreaming ? { animationDuration: "1.2s" } : {}),
            },
          }}
        />
      </Collapse>

      {/* State description */}
      <Typography
        sx={{
          fontSize: "0.8rem",
          color: "var(--color-text-muted)",
          mb: (showStreamingCalls || showHistoryCalls) ? 1.5 : 0,
        }}
      >
        {stateInfo.description}
      </Typography>

      {/* Streaming tool calls (real-time) */}
      <AnimatePresence>
        {showStreamingCalls && (
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
                {t("agentToolUse")}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                {activeStreamingCalls.map((tc, idx) => {
                  const toolInfo = toolLabels[tc.name] || { label: tc.name, icon: "🔧" };
                  const chipStyle = getStreamingToolChipStyle(tc.status);

                  let chipIcon;
                  if (tc.status === "running") {
                    chipIcon = <CircularProgress size={12} sx={{ color: "var(--color-primary)" }} />;
                  } else if (tc.status === "error") {
                    chipIcon = <span style={{ fontSize: 14 }}>❌</span>;
                  } else {
                    chipIcon = <CheckCircleIcon sx={{ fontSize: 14, color: "#22c55e" }} />;
                  }

                  return (
                    <motion.div
                      key={tc.callId}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
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

      {/* History tool calls (after completion) */}
      <AnimatePresence>
        {showHistoryCalls && (
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
                {t("agentToolUse")}
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
