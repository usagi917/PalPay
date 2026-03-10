"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaymentIcon from "@mui/icons-material/Payment";
import SendIcon from "@mui/icons-material/Send";
import CancelIcon from "@mui/icons-material/Cancel";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { TxProgress } from "@/components";
import { formatAmount } from "@/lib/hooks";
import type { TxStep } from "@/lib/hooks";
import type { Locale } from "@/lib/i18n";
import type { EscrowInfo, Milestone, UserRole } from "@/lib/types";
import type { Hash } from "viem";

export interface ActionCardProps {
  info: EscrowInfo;
  locale: Locale;
  decimals: number;
  symbol: string;
  userRole: UserRole;
  txStep: TxStep;
  txHash: Hash | null;
  actionLoading: boolean;
  actionError: string | null;
  resetState: () => void;
  purchaseValidation: { balance: bigint; hasEnoughBalance: boolean };
  milestones: Milestone[];
  milestonesLoading: boolean;
  nextMilestoneIndex: number;
  onLock: () => void;
  onSubmit: (index: number) => void;
  onApprove: () => void;
  onActivateAfterTimeout: () => void;
  onCancel: () => void;
  onRequestFinalDelivery: () => void;
  onConfirmDelivery: () => void;
  onFinalizeAfterTimeout: () => void;
}

export function ActionCard({
  info,
  locale,
  decimals,
  symbol,
  userRole,
  txStep,
  txHash,
  actionLoading,
  actionError,
  resetState,
  purchaseValidation,
  milestones,
  milestonesLoading,
  nextMilestoneIndex,
  onLock,
  onSubmit,
  onApprove,
  onActivateAfterTimeout,
  onCancel,
  onRequestFinalDelivery,
  onConfirmDelivery,
  onFinalizeAfterTimeout,
}: ActionCardProps) {
  // Guard: if nextMilestoneIndex is out of bounds, treat active state sections as inactive
  const milestoneInBounds = nextMilestoneIndex >= 0 && nextMilestoneIndex < milestones.length;
  const [nowSec, setNowSec] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const lastMilestoneIndex = milestones.length - 1;
  const atFinalMilestone = milestoneInBounds && nextMilestoneIndex === lastMilestoneIndex;
  const lockExpired = info.lockDeadline !== null && nowSec >= info.lockDeadline;
  const finalRequested = info.finalRequestedAt > 0n;
  const finalExpired = info.finalConfirmationDeadline !== null && nowSec >= info.finalConfirmationDeadline;
  const relistReady = info.status === "open" && info.cancelCount > 0n;

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(BigInt(Math.floor(Date.now() / 1000)));
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const formatDeadline = useMemo(
    () => (deadline: bigint | null) =>
      deadline === null
        ? null
        : new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(Number(deadline) * 1000)),
    [locale]
  );

  const lockDeadlineLabel = formatDeadline(info.lockDeadline);
  const finalDeadlineLabel = formatDeadline(info.finalConfirmationDeadline);

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
          sx={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-text)", mb: 2 }}
        >
          {locale === "ja" ? "お手続き" : "Actions"}
        </Typography>

        {/* Transaction Progress */}
        <TxProgress
          step={txStep}
          txHash={txHash}
          error={actionError}
          onClose={resetState}
        />

        {/* Balance/Allowance Info (for potential buyers) */}
        {info.status === "open" && userRole !== "producer" && (
          <Box sx={{ mb: 2 }}>
            {/* Balance Display */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 1.5,
                mb: 1,
                borderRadius: 2,
                background: purchaseValidation.hasEnoughBalance
                  ? "var(--status-success-surface)"
                  : "var(--status-error-surface)",
                border: `1px solid ${
                  purchaseValidation.hasEnoughBalance
                    ? "rgba(110, 191, 139, 0.25)"
                    : "rgba(214, 104, 83, 0.25)"
                }`,
              }}
            >
              <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
                {locale === "ja" ? "お支払い可能額" : "Available Funds"}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: purchaseValidation.hasEnoughBalance
                    ? "var(--status-success)"
                    : "var(--status-error)",
                }}
              >
                {formatAmount(purchaseValidation.balance, decimals, symbol)}
              </Typography>
            </Box>

            {/* Insufficient Balance Warning */}
            {!purchaseValidation.hasEnoughBalance && (
              <Alert
                severity="warning"
                sx={{
                  mt: 1,
                  borderRadius: 2,
                  background: "var(--status-warning-surface)",
                  color: "var(--status-warning)",
                  border: "1px solid rgba(232, 197, 71, 0.25)",
                }}
              >
                {locale === "ja"
                  ? `お支払い額が${formatAmount(info.totalAmount - purchaseValidation.balance, decimals, symbol)}不足しています`
                  : `Insufficient funds by ${formatAmount(info.totalAmount - purchaseValidation.balance, decimals, symbol)}`}
              </Alert>
            )}
          </Box>
        )}

        {/* Lock Button (for non-producer, when open) */}
        {info.status === "open" && userRole !== "producer" && txStep !== "success" && (
          <Button
            variant="contained"
            fullWidth
            startIcon={actionLoading ? <CircularProgress size={20} /> : <PaymentIcon />}
            onClick={onLock}
            disabled={actionLoading || !purchaseValidation.hasEnoughBalance}
            sx={{
              background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
              color: "var(--sumi-black)",
              fontWeight: 600,
              py: 1.5,
              borderRadius: 2,
              boxShadow: "var(--shadow-subtle), var(--shadow-copper)",
              "&:hover": {
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-deep) 100%)",
                transform: "translateY(-2px)",
                boxShadow: "var(--shadow-medium), 0 0 40px var(--copper-glow)",
              },
              "&:disabled": {
                background: "var(--color-surface-hover)",
                color: "var(--color-text-muted)",
                boxShadow: "none",
              },
            }}
          >
            {actionLoading
              ? locale === "ja"
                ? "処理中..."
                : "Processing..."
              : locale === "ja"
              ? `支払いを確定する (${formatAmount(info.totalAmount, decimals, symbol)})`
              : `Confirm Payment (${formatAmount(info.totalAmount, decimals, symbol)})`}
          </Button>
        )}

        {/* Producer's own listing - waiting message */}
        {info.status === "open" && userRole === "producer" && txStep !== "success" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
              {relistReady
                ? locale === "ja"
                  ? "キャンセル後の再販待ちです。現在は生産者がNFTを保有しています。"
                  : "Relisting is available after cancellation. The producer currently holds the NFT."
                : locale === "ja"
                ? "購入者を待っています..."
                : "Waiting for buyer..."}
            </Typography>
          </Box>
        )}

        {/* LOCKED state - Buyer needs to approve or cancel */}
        {info.status === "locked" && userRole === "buyer" && txStep !== "success" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {lockExpired
                ? locale === "ja"
                  ? "開始待ち期限を過ぎました。キャンセルはできません。取引を進める場合はタイムアウト開始を実行してください。"
                  : "The review window has expired. Cancellation is no longer available. Activate the transaction after timeout to proceed."
                : locale === "ja"
                ? "出品者とチャットで条件を確認してください。問題なければ取引を開始してください。"
                : "Chat with the producer to confirm conditions. Start the transaction when ready."}
            </Alert>
            {lockDeadlineLabel && (
              <Typography variant="caption" sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                {locale === "ja" ? `確認期限: ${lockDeadlineLabel}` : `Review deadline: ${lockDeadlineLabel}`}
              </Typography>
            )}
            {!lockExpired ? (
              <>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={actionLoading ? <CircularProgress size={20} /> : <ThumbUpIcon />}
                  onClick={onApprove}
                  disabled={actionLoading}
                  sx={{
                    background: "linear-gradient(135deg, var(--status-success) 0%, #5A9E73 100%)",
                    color: "var(--sumi-black)",
                    fontWeight: 600,
                    py: 1.5,
                    borderRadius: 2,
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "var(--shadow-medium), 0 0 30px rgba(110, 191, 139, 0.3)",
                    },
                  }}
                >
                  {actionLoading
                    ? locale === "ja"
                      ? "処理中..."
                      : "Processing..."
                    : locale === "ja"
                    ? "取引を開始する"
                    : "Start Transaction"}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={actionLoading ? <CircularProgress size={20} /> : <CancelIcon />}
                  onClick={onCancel}
                  disabled={actionLoading}
                  sx={{
                    borderColor: "var(--status-error)",
                    color: "var(--status-error)",
                    "&:hover": {
                      borderColor: "var(--status-error)",
                      background: "var(--status-error-surface)",
                    },
                  }}
                >
                  {actionLoading
                    ? locale === "ja"
                      ? "処理中..."
                      : "Processing..."
                    : locale === "ja"
                    ? "キャンセルして返金"
                    : "Cancel & Refund"}
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                fullWidth
                startIcon={actionLoading ? <CircularProgress size={20} /> : <ThumbUpIcon />}
                onClick={onActivateAfterTimeout}
                disabled={actionLoading}
                sx={{
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                  color: "var(--sumi-black)",
                  fontWeight: 600,
                  py: 1.5,
                  borderRadius: 2,
                }}
              >
                {actionLoading
                  ? locale === "ja"
                    ? "処理中..."
                    : "Processing..."
                  : locale === "ja"
                  ? "期限後に取引開始"
                  : "Activate After Timeout"}
              </Button>
            )}
          </Box>
        )}

        {/* LOCKED state - Producer waiting for approval */}
        {info.status === "locked" && userRole === "producer" && txStep !== "success" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {lockExpired
                ? locale === "ja"
                  ? "開始待ち期限を過ぎました。誰でも取引開始へ進められます。"
                  : "The review window has expired. Anyone can activate the transaction now."
                : locale === "ja"
                ? "購入者が条件を確認中です。確認後、取引が開始します。"
                : "Buyer is reviewing conditions. Transaction will start after confirmation."}
            </Alert>
            {lockDeadlineLabel && (
              <Typography variant="caption" sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                {locale === "ja" ? `確認期限: ${lockDeadlineLabel}` : `Review deadline: ${lockDeadlineLabel}`}
              </Typography>
            )}
            {lockExpired ? (
              <Button
                variant="contained"
                fullWidth
                startIcon={actionLoading ? <CircularProgress size={20} /> : <ThumbUpIcon />}
                onClick={onActivateAfterTimeout}
                disabled={actionLoading}
                sx={{
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                  color: "var(--sumi-black)",
                  fontWeight: 600,
                  py: 1.5,
                  borderRadius: 2,
                }}
              >
                {actionLoading
                  ? locale === "ja"
                    ? "処理中..."
                    : "Processing..."
                  : locale === "ja"
                  ? "期限後に取引開始"
                  : "Activate After Timeout"}
              </Button>
            ) : (
              <Typography sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                {locale === "ja" ? "購入者の確認待ち..." : "Waiting for buyer confirmation..."}
              </Typography>
            )}
          </Box>
        )}

        {/* Loading state while milestones refresh */}
        {info.status === "active" && userRole === "producer" && milestonesLoading && txStep === "idle" && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} sx={{ color: "var(--color-primary)" }} />
          </Box>
        )}

        {/* Submit Button (for producer, when active) - excludes final milestone */}
        {info.status === "active" && userRole === "producer" && milestoneInBounds && nextMilestoneIndex < milestones.length - 1 && txStep !== "success" && !milestonesLoading && (
          <Button
            variant="contained"
            fullWidth
            startIcon={actionLoading ? <CircularProgress size={20} /> : <SendIcon />}
            onClick={() => onSubmit(nextMilestoneIndex)}
            disabled={actionLoading}
            sx={{
              background: "linear-gradient(135deg, var(--status-success) 0%, #5A9E73 100%)",
              color: "var(--sumi-black)",
              fontWeight: 600,
              py: 1.5,
              borderRadius: 2,
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "var(--shadow-medium), 0 0 30px rgba(110, 191, 139, 0.3)",
              },
            }}
          >
            {actionLoading
              ? locale === "ja"
                ? "処理中..."
                : "Processing..."
              : locale === "ja"
              ? `「${milestones[nextMilestoneIndex].name}」を完了報告`
              : `Report "${milestones[nextMilestoneIndex].name}" Complete`}
          </Button>
        )}

        {/* Producer requests final delivery */}
        {info.status === "active" && userRole === "producer" && atFinalMilestone && !finalRequested && txStep !== "success" && !milestonesLoading && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {locale === "ja"
                ? "最終納品が完了したら、購入者の最終確認リクエストを送ってください。"
                : "Once final delivery is ready, request buyer confirmation to unlock the last payment."}
            </Alert>
            <Button
              variant="contained"
              fullWidth
              startIcon={actionLoading ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={onRequestFinalDelivery}
              disabled={actionLoading}
              sx={{
                background: "linear-gradient(135deg, var(--status-success) 0%, #5A9E73 100%)",
                color: "var(--sumi-black)",
                fontWeight: 600,
                py: 1.5,
                borderRadius: 2,
              }}
            >
              {actionLoading
                ? locale === "ja"
                  ? "処理中..."
                  : "Processing..."
                : locale === "ja"
                ? "最終納品を申請する"
                : "Request Final Delivery"}
            </Button>
          </Box>
        )}

        {/* Producer waiting for buyer to confirm final delivery */}
        {info.status === "active" && userRole === "producer" && atFinalMilestone && finalRequested && !finalExpired && txStep !== "success" && !milestonesLoading && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {locale === "ja"
                ? "購入者の受取確認待ちです。期限を過ぎると誰でも最終確定できます。"
                : "Waiting for buyer confirmation. Anyone can finalize after the deadline."}
            </Alert>
            {finalDeadlineLabel && (
              <Typography sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                {locale === "ja" ? `最終確認期限: ${finalDeadlineLabel}` : `Final confirmation deadline: ${finalDeadlineLabel}`}
              </Typography>
            )}
          </Box>
        )}

        {info.status === "active" && userRole === "producer" && atFinalMilestone && finalRequested && finalExpired && txStep !== "success" && !milestonesLoading && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              {locale === "ja"
                ? "最終確認期限を過ぎました。最終確定で残額を受け取れます。"
                : "The final confirmation deadline has passed. Finalize to release the remaining amount."}
            </Alert>
            <Button
              variant="contained"
              fullWidth
              startIcon={actionLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
              onClick={onFinalizeAfterTimeout}
              disabled={actionLoading}
              sx={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                color: "var(--sumi-black)",
                fontWeight: 600,
                py: 1.5,
                borderRadius: 2,
              }}
            >
              {actionLoading
                ? locale === "ja"
                  ? "処理中..."
                  : "Processing..."
                : locale === "ja"
                ? "期限後に最終確定"
                : "Finalize After Timeout"}
            </Button>
          </Box>
        )}

        {/* Buyer tracking progress - not final milestone */}
        {info.status === "active" && userRole === "buyer" && milestoneInBounds && nextMilestoneIndex < milestones.length - 1 && txStep !== "success" && (
          <Typography sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
            {locale === "ja" ? "進捗を追跡中..." : "Tracking progress..."}
          </Typography>
        )}

        {info.status === "active" && userRole === "buyer" && atFinalMilestone && !finalRequested && txStep !== "success" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {locale === "ja"
                ? "最終納品申請を待っています。申請後に受取確認または期限後の最終確定が可能になります。"
                : "Waiting for the producer's final delivery request. You can confirm receipt or finalize after timeout once requested."}
            </Alert>
          </Box>
        )}

        {/* Confirm Delivery Button (for buyer, when active, final milestone) */}
        {info.status === "active" && userRole === "buyer" && atFinalMilestone && finalRequested && !finalExpired && txStep !== "success" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              {locale === "ja"
                ? "商品の受取りを確認してください。確認すると残りの支払いが完了します。"
                : "Please confirm receipt. This will complete the remaining payment."}
            </Alert>
            {finalDeadlineLabel && (
              <Typography variant="caption" sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                {locale === "ja" ? `最終確認期限: ${finalDeadlineLabel}` : `Final confirmation deadline: ${finalDeadlineLabel}`}
              </Typography>
            )}
            <Button
              variant="contained"
              fullWidth
              startIcon={actionLoading ? <CircularProgress size={20} /> : <LocalShippingIcon />}
              onClick={onConfirmDelivery}
              disabled={actionLoading}
              sx={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                color: "var(--sumi-black)",
                fontWeight: 600,
                py: 1.5,
                borderRadius: 2,
                boxShadow: "var(--shadow-subtle), var(--shadow-copper)",
                "&:hover": {
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-deep) 100%)",
                  transform: "translateY(-2px)",
                  boxShadow: "var(--shadow-medium), 0 0 40px var(--copper-glow)",
                },
              }}
            >
              {actionLoading
                ? locale === "ja"
                  ? "処理中..."
                  : "Processing..."
                : locale === "ja"
                ? "受取りを確認する"
                : "Confirm Receipt"}
            </Button>
          </Box>
        )}

        {info.status === "active" && userRole === "buyer" && atFinalMilestone && finalRequested && finalExpired && txStep !== "success" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              {locale === "ja"
                ? "最終確認期限を過ぎました。最終確定に進むと残額支払いが完了します。"
                : "The final confirmation deadline has passed. Finalize to complete the remaining payment."}
            </Alert>
            <Button
              variant="contained"
              fullWidth
              startIcon={actionLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
              onClick={onFinalizeAfterTimeout}
              disabled={actionLoading}
              sx={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                color: "var(--sumi-black)",
                fontWeight: 600,
                py: 1.5,
                borderRadius: 2,
              }}
            >
              {actionLoading
                ? locale === "ja"
                  ? "処理中..."
                  : "Processing..."
                : locale === "ja"
                ? "期限後に最終確定"
                : "Finalize After Timeout"}
            </Button>
          </Box>
        )}

        {/* Completed message */}
        {info.status === "completed" && (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: "var(--status-success)", mb: 1 }} />
            <Typography sx={{ color: "var(--color-text)" }}>
              {locale === "ja" ? "全工程完了" : "All milestones completed"}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
