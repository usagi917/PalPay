"use client";

import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, LinearProgress } from "@mui/material";
import { motion } from "framer-motion";
import TimelineIcon from "@mui/icons-material/Timeline";
import type { MilestonePreview } from "@/lib/agent/types";

interface MilestoneTableProps {
  milestones: MilestonePreview[];
  totalAmount?: string;
}

const headerCellSx = {
  color: "var(--color-text-muted)",
  fontSize: "0.7rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px solid var(--color-border)",
  py: 1,
} as const;

export function MilestoneTable({ milestones, totalAmount }: MilestoneTableProps) {
  const total = totalAmount ? Number(totalAmount) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          background: "rgba(30, 41, 59, 0.8)",
          border: "1px solid var(--color-border)",
          borderRadius: 2,
          mb: 2,
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <TimelineIcon sx={{ fontSize: 20, color: "var(--color-primary)" }} />
          <Typography
            sx={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "var(--color-text)",
            }}
          >
            マイルストーン詳細
          </Typography>
          <Chip
            label={`${milestones.length}段階`}
            size="small"
            sx={{
              ml: "auto",
              fontSize: "0.7rem",
              height: 22,
              background: "rgba(148, 163, 184, 0.15)",
              color: "var(--color-text-secondary)",
            }}
          />
        </Box>

        {/* Table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={headerCellSx}>#</TableCell>
                <TableCell sx={headerCellSx}>工程</TableCell>
                <TableCell align="right" sx={headerCellSx}>割合</TableCell>
                {total > 0 && (
                  <TableCell align="right" sx={headerCellSx}>金額</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {milestones.map((ms, idx) => {
                const percent = ms.bps / 100;
                const amount = total > 0 ? Math.floor(total * percent / 100) : 0;

                return (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    style={{ display: "table-row" }}
                  >
                    <TableCell
                      sx={{
                        color: "var(--color-text-muted)",
                        fontSize: "0.8rem",
                        borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
                        py: 1.5,
                      }}
                    >
                      {idx + 1}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "var(--color-text)",
                        fontSize: "0.85rem",
                        borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
                        py: 1.5,
                      }}
                    >
                      {ms.name}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
                        py: 1.5,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "flex-end" }}>
                        <LinearProgress
                          variant="determinate"
                          value={percent}
                          sx={{
                            width: 60,
                            height: 4,
                            borderRadius: 2,
                            background: "rgba(148, 163, 184, 0.1)",
                            "& .MuiLinearProgress-bar": {
                              background: "var(--color-primary)",
                            },
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: "0.8rem",
                            color: "var(--color-primary)",
                            fontWeight: 500,
                            minWidth: 40,
                            textAlign: "right",
                          }}
                        >
                          {percent}%
                        </Typography>
                      </Box>
                    </TableCell>
                    {total > 0 && (
                      <TableCell
                        align="right"
                        sx={{
                          color: "var(--color-text-secondary)",
                          fontSize: "0.8rem",
                          borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
                          py: 1.5,
                        }}
                      >
                        ¥{amount.toLocaleString("ja-JP")}
                      </TableCell>
                    )}
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Total row */}
        {total > 0 && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mt: 2,
              pt: 2,
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              合計
            </Typography>
            <Typography
              sx={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--color-primary)",
              }}
            >
              ¥{total.toLocaleString("ja-JP")} JPYC
            </Typography>
          </Box>
        )}
      </Paper>
    </motion.div>
  );
}
