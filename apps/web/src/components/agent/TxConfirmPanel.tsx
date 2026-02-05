"use client";

import { useState } from "react";
import { Box, Paper, Typography, Button, CircularProgress, Alert, Chip, Stack, Divider } from "@mui/material";
import { motion } from "framer-motion";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import type { TxPrepareResult, ListingDraft } from "@/lib/agent/types";
import type { ReactElement } from "react";

interface TxConfirmPanelProps {
  txPrepare: TxPrepareResult;
  draft?: ListingDraft;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  walletConnected: boolean;
}

const actionLabels: Record<string, { label: string; icon: ReactElement; description: string }> = {
  createListing: {
    label: "出品作成",
    icon: <AddCircleIcon />,
    description: "新しい出品をブロックチェーンに登録します",
  },
  lock: {
    label: "購入ロック",
    icon: <LockIcon />,
    description: "資金をエスクローにロックします",
  },
  approve: {
    label: "承認",
    icon: <CheckCircleIcon />,
    description: "取引を承認してマイルストーン支払いを開始します",
  },
  cancel: {
    label: "キャンセル",
    icon: <CancelIcon />,
    description: "取引をキャンセルして資金を返金します",
  },
  confirmDelivery: {
    label: "納品確認",
    icon: <CheckCircleIcon />,
    description: "最終納品を確認して残金を解放します",
  },
};

export function TxConfirmPanel({
  txPrepare,
  draft,
  onConfirm,
  onCancel,
  walletConnected,
}: TxConfirmPanelProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionInfo = actionLabels[txPrepare.action] || {
    label: txPrepare.action,
    icon: <LockIcon />,
    description: "トランザクションを実行します",
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "トランザクションに失敗しました");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 3,
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(45, 62, 95, 0.9) 100%)",
          border: "2px solid var(--color-primary)",
          borderRadius: 3,
          mb: 2,
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, var(--color-primary) 0%, #c49660 100%)",
              color: "#fff",
              "& svg": { fontSize: 24 },
            }}
          >
            {actionInfo.icon}
          </Box>
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
              署名準備完了
            </Typography>
            <Typography
              sx={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "var(--color-text)",
              }}
            >
              {actionInfo.label}
            </Typography>
          </Box>
        </Box>

        {/* Description */}
        <Typography
          sx={{
            fontSize: "0.9rem",
            color: "var(--color-text-secondary)",
            mb: 2,
          }}
        >
          {actionInfo.description}
        </Typography>

        <Divider sx={{ borderColor: "var(--color-border)", my: 2 }} />

        {/* Transaction details */}
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {/* Action */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography sx={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
              アクション
            </Typography>
            <Chip
              label={txPrepare.action}
              size="small"
              sx={{
                fontSize: "0.75rem",
                background: "rgba(212, 165, 116, 0.15)",
                color: "var(--color-primary)",
                border: "1px solid rgba(212, 165, 116, 0.3)",
              }}
            />
          </Box>

          {/* Escrow address */}
          {txPrepare.escrowAddress && (
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography sx={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                コントラクト
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-secondary)",
                  fontFamily: "monospace",
                }}
              >
                {txPrepare.escrowAddress.slice(0, 8)}...{txPrepare.escrowAddress.slice(-6)}
              </Typography>
            </Box>
          )}

          {/* Amount (from draft) */}
          {draft && (
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography sx={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                金額
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "var(--color-primary)",
                }}
              >
                ¥{Number(draft.totalAmount).toLocaleString("ja-JP")} JPYC
              </Typography>
            </Box>
          )}

          {/* Approval notice */}
          {txPrepare.requiresApproval && (
            <Alert
              severity="info"
              sx={{
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                "& .MuiAlert-icon": {
                  color: "#3b82f6",
                },
                "& .MuiAlert-message": {
                  color: "var(--color-text)",
                  fontSize: "0.8rem",
                },
              }}
            >
              JPYCのApprove（承認）トランザクションが先に実行されます
            </Alert>
          )}
        </Stack>

        {/* Error message */}
        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2,
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              "& .MuiAlert-icon": {
                color: "#ef4444",
              },
              "& .MuiAlert-message": {
                color: "var(--color-text)",
                fontSize: "0.8rem",
              },
            }}
          >
            {error}
          </Alert>
        )}

        {/* Action buttons */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={onCancel}
            disabled={isProcessing}
            sx={{
              flex: 1,
              py: 1.5,
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              borderColor: "var(--color-border)",
              "&:hover": {
                borderColor: "var(--color-text-secondary)",
                background: "rgba(148, 163, 184, 0.1)",
              },
            }}
          >
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={isProcessing || !walletConnected}
            startIcon={
              isProcessing ? (
                <CircularProgress size={20} sx={{ color: "#fff" }} />
              ) : (
                <AccountBalanceWalletIcon />
              )
            }
            sx={{
              flex: 2,
              py: 1.5,
              fontSize: "0.9rem",
              fontWeight: 600,
              background: "linear-gradient(135deg, var(--color-primary) 0%, #c49660 100%)",
              color: "#fff",
              "&:hover": {
                background: "linear-gradient(135deg, #c49660 0%, var(--color-primary) 100%)",
              },
              "&.Mui-disabled": {
                background: "rgba(148, 163, 184, 0.3)",
                color: "var(--color-text-muted)",
              },
            }}
          >
            {isProcessing
              ? "処理中..."
              : walletConnected
                ? "ウォレットで署名"
                : "ウォレット未接続"}
          </Button>
        </Stack>

        {/* Wallet not connected warning */}
        {!walletConnected && (
          <Typography
            sx={{
              mt: 2,
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              textAlign: "center",
            }}
          >
            署名するにはウォレットを接続してください
          </Typography>
        )}
      </Paper>
    </motion.div>
  );
}
