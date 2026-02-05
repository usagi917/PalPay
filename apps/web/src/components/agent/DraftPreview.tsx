"use client";

import { Box, Paper, Typography, Chip, Divider, Stack } from "@mui/material";
import { motion } from "framer-motion";
import DescriptionIcon from "@mui/icons-material/Description";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CategoryIcon from "@mui/icons-material/Category";
import type { ListingDraft } from "@/lib/agent/types";

interface DraftPreviewProps {
  draft: ListingDraft;
}

const categoryLabels: Record<string, { ja: string; emoji: string }> = {
  wagyu: { ja: "和牛", emoji: "🥩" },
  sake: { ja: "日本酒", emoji: "🍶" },
  craft: { ja: "工芸品", emoji: "🏺" },
};

export function DraftPreview({ draft }: DraftPreviewProps) {
  const categoryInfo = categoryLabels[draft.category] || { ja: draft.category, emoji: "📦" };

  // Format amount with commas
  const formattedAmount = Number(draft.totalAmount).toLocaleString("ja-JP");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(45, 62, 95, 0.9) 100%)",
          border: "1px solid var(--color-border-accent)",
          borderRadius: 3,
          mb: 2,
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Typography sx={{ fontSize: "1.5rem" }}>{categoryInfo.emoji}</Typography>
          <Box>
            <Typography
              sx={{
                fontSize: "0.7rem",
                color: "var(--color-primary)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 600,
              }}
            >
              出品ドラフト
            </Typography>
            <Typography
              sx={{
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              {draft.title}
            </Typography>
          </Box>
          <Chip
            label={categoryInfo.ja}
            size="small"
            sx={{
              ml: "auto",
              fontSize: "0.75rem",
              background: "rgba(212, 165, 116, 0.15)",
              color: "var(--color-primary)",
              border: "1px solid rgba(212, 165, 116, 0.3)",
            }}
          />
        </Box>

        <Divider sx={{ borderColor: "var(--color-border)", my: 2 }} />

        {/* Details */}
        <Stack spacing={2}>
          {/* Description */}
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <DescriptionIcon
              sx={{ fontSize: 20, color: "var(--color-text-muted)", mt: 0.25 }}
            />
            <Box>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  mb: 0.5,
                }}
              >
                説明
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.9rem",
                  color: "var(--color-text)",
                  lineHeight: 1.6,
                }}
              >
                {draft.description}
              </Typography>
            </Box>
          </Box>

          {/* Amount */}
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <AttachMoneyIcon
              sx={{ fontSize: 20, color: "var(--color-text-muted)", mt: 0.25 }}
            />
            <Box>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  mb: 0.5,
                }}
              >
                総額
              </Typography>
              <Typography
                sx={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "var(--color-primary)",
                }}
              >
                ¥{formattedAmount}
                <Typography
                  component="span"
                  sx={{
                    fontSize: "0.8rem",
                    color: "var(--color-text-muted)",
                    ml: 0.5,
                  }}
                >
                  JPYC
                </Typography>
              </Typography>
            </Box>
          </Box>

          {/* Milestones summary */}
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <CategoryIcon
              sx={{ fontSize: 20, color: "var(--color-text-muted)", mt: 0.25 }}
            />
            <Box>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  mb: 0.5,
                }}
              >
                マイルストーン
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.9rem",
                  color: "var(--color-text)",
                }}
              >
                {draft.milestones.length}段階の支払い
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                {draft.milestones.slice(0, 5).map((ms, idx) => (
                  <Chip
                    key={idx}
                    label={`${ms.name} (${ms.bps / 100}%)`}
                    size="small"
                    sx={{
                      fontSize: "0.65rem",
                      height: 22,
                      background: "rgba(148, 163, 184, 0.1)",
                      color: "var(--color-text-secondary)",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                    }}
                  />
                ))}
                {draft.milestones.length > 5 && (
                  <Chip
                    label={`+${draft.milestones.length - 5}`}
                    size="small"
                    sx={{
                      fontSize: "0.65rem",
                      height: 22,
                      background: "rgba(212, 165, 116, 0.1)",
                      color: "var(--color-primary)",
                      border: "1px solid rgba(212, 165, 116, 0.2)",
                    }}
                  />
                )}
              </Stack>
            </Box>
          </Box>
        </Stack>
      </Paper>
    </motion.div>
  );
}
