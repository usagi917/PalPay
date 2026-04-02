"use client";

import { Box, Typography, Card, CardContent } from "@mui/material";
import { motion } from "framer-motion";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { formatAmount } from "@/lib/hooks";
import type { Locale } from "@/lib/i18n";
import type { Milestone } from "@/lib/types";

export interface MilestoneListProps {
  milestones: Milestone[];
  milestoneAmounts: bigint[];
  nextMilestoneIndex: number;
  status: string;
  locale: Locale;
  decimals: number;
  symbol: string;
}

export function MilestoneList({
  milestones,
  milestoneAmounts,
  nextMilestoneIndex,
  status,
  locale,
  decimals,
  symbol,
}: MilestoneListProps) {
  const isJapanese = locale === "ja";

  return (
    <Card
      sx={{
        background: "var(--color-surface)",
        backdropFilter: "blur(20px)",
        border: "1px solid var(--color-border)",
        borderRadius: 3,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography
          variant="h6"
          sx={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-text)", mb: 3 }}
        >
          {isJapanese ? "育成・受け渡しの流れ" : "Progress steps"}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {milestones.map((milestone, index) => {
            const amount = milestoneAmounts[index] ?? 0n;
            const isNext = index === nextMilestoneIndex && status === "active";
            const isFuture = !milestone.completed && index > nextMilestoneIndex && status === "active";

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 2,
                    p: 2,
                    borderRadius: 2,
                    background: isNext
                      ? "var(--color-primary-surface)"
                      : milestone.completed
                      ? "var(--status-success-surface)"
                      : "transparent",
                    border: isNext ? "1px solid var(--color-border-accent)" : "1px solid transparent",
                    opacity: isFuture ? 0.6 : 1,
                  }}
                >
                  <Box sx={{ pt: 0.5 }}>
                    {milestone.completed ? (
                      <CheckCircleIcon sx={{ color: "var(--status-success)" }} />
                    ) : isFuture ? (
                      <LockOutlinedIcon sx={{ color: "var(--color-text-muted)", fontSize: "1.25rem" }} />
                    ) : (
                      <RadioButtonUncheckedIcon
                        sx={{ color: isNext ? "var(--color-primary)" : "var(--color-text-muted)" }}
                      />
                    )}
                  </Box>

                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography
                          sx={{
                            fontWeight: 600,
                            color: milestone.completed
                              ? "var(--color-text)"
                              : isNext
                              ? "var(--color-primary)"
                              : "var(--color-text-secondary)",
                          }}
                        >
                          {milestone.name}
                        </Typography>
                        {isFuture && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: "var(--color-text-muted)",
                              fontSize: "0.7rem",
                            }}
                          >
                            {isJapanese ? "このあと" : "Later"}
                          </Typography>
                        )}
                        {isNext && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: "var(--color-primary)",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                            }}
                          >
                            {isJapanese ? "いま記録する" : "Record now"}
                          </Typography>
                        )}
                      </Box>
                      <Typography
                        sx={{
                          color: milestone.completed
                            ? "var(--status-success)"
                            : "var(--color-text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {formatAmount(amount, decimals, symbol)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: "var(--color-text-muted)" }}>
                      {Number(milestone.bps) / 100}%
                    </Typography>
                  </Box>
                </Box>
              </motion.div>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}
