"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  LinearProgress,
  CircularProgress,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import LockIcon from "@mui/icons-material/Lock";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SendIcon from "@mui/icons-material/Send";
import CancelIcon from "@mui/icons-material/Cancel";
import { Header, HeroNFT, ConnectWallet, TxProgress } from "@/components";
import {
  useWallet,
  useEscrowInfo,
  useMilestones,
  useEscrowActions,
  useEscrowEvents,
  useTokenInfo,
  usePurchaseValidation,
  formatAmount,
  getUserRole,
  shortenAddress,
} from "@/lib/hooks";
import { getTxUrl, getAddressUrl, CATEGORY_LABELS, STATUS_LABELS } from "@/lib/config";
import { I18nContext, translations, type Locale, type TranslationKey } from "@/lib/i18n";
import type { Address } from "viem";

export default function ListingDetailPage() {
  const params = useParams();
  const escrowAddress = params.address as Address;
  const router = useRouter();

  const [locale, setLocale] = useState<Locale>("ja");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const i18nValue = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: TranslationKey) => translations[locale][key] as string,
    }),
    [locale]
  );

  const wallet = useWallet();
  const { info, isLoading: infoLoading, error: infoError, refetch: refetchInfo } = useEscrowInfo(escrowAddress);
  const { milestones, isLoading: milestonesLoading, refetch: refetchMilestones } = useMilestones(escrowAddress);
  const { events, refetch: refetchEvents } = useEscrowEvents(escrowAddress);
  const { symbol, decimals } = useTokenInfo();

  // Purchase validation (balance/allowance check)
  const purchaseValidation = usePurchaseValidation(
    wallet.address,
    escrowAddress,
    info?.totalAmount ?? 0n
  );

  const handleSuccess = useCallback(() => {
    refetchInfo();
    refetchMilestones();
    refetchEvents();
    purchaseValidation.refetch();
    router.refresh();
  }, [refetchInfo, refetchMilestones, refetchEvents, purchaseValidation, router]);

  const { lock, submit, cancel, isLoading: actionLoading, error: actionError, txHash, txStep, resetState } = useEscrowActions(
    escrowAddress,
    handleSuccess
  );

  // 成功後に3秒で自動リセット
  useEffect(() => {
    if (txStep === "success") {
      const timer = setTimeout(() => {
        resetState();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [txStep, resetState]);

  const userRole = getUserRole(wallet.address, info);

  // t is available via i18nValue for future use
  void i18nValue.t;

  const isLoading = infoLoading || milestonesLoading;

  // Progress calculation
  const completedCount = milestones.filter((m) => m.completed).length;
  const totalCount = milestones.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const milestoneAmounts = useMemo(() => {
    if (!info) return [];
    let sum = 0n;
    return milestones.map((milestone, index) => {
      if (index === milestones.length - 1) {
        return info.totalAmount - sum;
      }
      const amount = (info.totalAmount * milestone.bps) / 10000n;
      sum += amount;
      return amount;
    });
  }, [info, milestones]);

  // Get next incomplete milestone for producer
  const nextMilestoneIndex = milestones.findIndex((m) => !m.completed);

  const handleLock = async () => {
    if (info) {
      await lock(info.totalAmount);
    }
  };

  const handleSubmit = async (index: number) => {
    await submit(index);
  };

  if (!escrowAddress) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Alert severity="error">Invalid escrow address</Alert>
      </Container>
    );
  }

  return (
    <I18nContext.Provider value={i18nValue}>
      <div className="app-shell">
        {/* Header */}
        <Header onLocaleChange={setLocale} />

        {/* Main Content */}
        <Box
          component="main"
          className="content-layer"
          sx={{
            flex: 1,
            py: { xs: 3, sm: 4 },
          }}
        >
          <Container maxWidth="lg">
            {/* Back button */}
            <Box sx={{ mb: 3 }}>
              <Link href="/" style={{ textDecoration: "none" }}>
                <Button
                  startIcon={<ArrowBackIcon />}
                  sx={{
                    color: "var(--color-text-secondary)",
                    "&:hover": {
                      color: "var(--color-primary)",
                      background: "var(--color-primary-surface)",
                    },
                  }}
                >
                  {locale === "ja" ? "一覧に戻る" : "Back to Listings"}
                </Button>
              </Link>
            </Box>

            {/* Wallet */}
            <Box sx={{ mb: 3 }}>
              <ConnectWallet
                address={wallet.address}
                isConnecting={wallet.isConnecting}
                error={wallet.error}
                userRole={userRole}
                onConnect={wallet.connect}
                onDisconnect={wallet.disconnect}
              />
            </Box>

            {/* Loading */}
            {isLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress sx={{ color: "var(--color-primary)" }} />
              </Box>
            )}

            {/* Error */}
            {infoError && (
              <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
                {infoError}
              </Alert>
            )}

            {/* Content */}
            {info && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 4,
                  }}
                >
                  {/* Left: Info */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {/* Dynamic NFT */}
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
                          {locale === "ja" ? "ダイナミックNFT" : "Dynamic NFT"}
                        </Typography>
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                          <div className="hero-nft-shell">
                            <HeroNFT tokenId={Number(info.tokenId)} />
                          </div>
                        </Box>
                      </CardContent>
                    </Card>

                    {/* Main Card */}
                    <Card
                      sx={{
                        background: "var(--color-surface)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 3,
                      }}
                    >
                      {/* Image */}
                      {info.imageURI && (
                        <Box
                          sx={{
                            width: "100%",
                            height: 250,
                            overflow: "hidden",
                            borderRadius: "12px 12px 0 0",
                          }}
                        >
                          <Box
                            component="img"
                            src={info.imageURI}
                            alt={info.title}
                            sx={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </Box>
                      )}

                      <CardContent sx={{ p: 3 }}>
                        {/* Category & Status */}
                        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                          <Chip
                            label={CATEGORY_LABELS[info.category]?.[locale] || info.category}
                            size="small"
                            sx={{
                              background: "var(--color-primary-surface)",
                              color: "var(--color-primary)",
                              border: "1px solid var(--color-border-accent)",
                              fontWeight: 600,
                              borderRadius: 1,
                            }}
                          />
                          <Chip
                            label={STATUS_LABELS[info.status]?.[locale] || info.status}
                            size="small"
                            color={STATUS_LABELS[info.status]?.color as "success" | "info" | "default"}
                          />
                        </Box>

                        {/* Title */}
                        <Typography
                          variant="h4"
                          sx={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            color: "var(--color-text)",
                            mb: 2,
                          }}
                        >
                          {info.title}
                        </Typography>

                        {/* Description */}
                        <Typography
                          variant="body1"
                          sx={{
                            color: "var(--color-text-secondary)",
                            mb: 3,
                            lineHeight: 1.7,
                          }}
                        >
                          {info.description}
                        </Typography>

                        <Divider sx={{ borderColor: "var(--color-border)", mb: 3 }} />

                        {/* Price */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                          <Typography sx={{ color: "var(--color-text-muted)" }}>
                            {locale === "ja" ? "価格" : "Price"}
                          </Typography>
                          <Typography
                            sx={{
                              fontFamily: "var(--font-display)",
                              fontWeight: 700,
                              fontSize: "1.25rem",
                              color: "var(--color-primary)",
                            }}
                          >
                            {formatAmount(info.totalAmount, decimals, symbol)}
                          </Typography>
                        </Box>

                        {/* Released */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                          <Typography sx={{ color: "var(--color-text-muted)" }}>
                            {locale === "ja" ? "支払済み" : "Released"}
                          </Typography>
                          <Typography sx={{ color: "var(--color-text-secondary)" }}>
                            {formatAmount(info.releasedAmount, decimals, symbol)}
                          </Typography>
                        </Box>

                        {/* Progress */}
                        <Box sx={{ mb: 3 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                            <Typography sx={{ color: "var(--color-text-muted)" }}>
                              {locale === "ja" ? "進捗" : "Progress"}
                            </Typography>
                            <Typography sx={{ color: "var(--color-text-secondary)" }}>
                              {completedCount}/{totalCount}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={progressPercent}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: "rgba(255, 255, 255, 0.1)",
                              "& .MuiLinearProgress-bar": {
                                background: "linear-gradient(90deg, var(--color-primary), var(--copper-rich))",
                                borderRadius: 4,
                              },
                            }}
                          />
                        </Box>

                        <Divider sx={{ borderColor: "var(--color-border)", mb: 3 }} />

                        {/* Addresses */}
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" sx={{ color: "var(--color-text-muted)" }}>
                              {locale === "ja" ? "生産者" : "Producer"}
                            </Typography>
                            <a
                              href={getAddressUrl(info.producer)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--color-primary)", fontFamily: "monospace", fontSize: "0.85rem" }}
                            >
                              {shortenAddress(info.producer)}
                            </a>
                          </Box>
                          {info.locked && (
                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                              <Typography variant="caption" sx={{ color: "var(--color-text-muted)" }}>
                                {locale === "ja" ? "購入者" : "Buyer"}
                              </Typography>
                              <a
                                href={getAddressUrl(info.buyer)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--color-primary)", fontFamily: "monospace", fontSize: "0.85rem" }}
                              >
                                {shortenAddress(info.buyer)}
                              </a>
                            </Box>
                          )}
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" sx={{ color: "var(--color-text-muted)" }}>
                              {locale === "ja" ? "エスクロー" : "Escrow"}
                            </Typography>
                            <a
                              href={getAddressUrl(escrowAddress)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--color-primary)", fontFamily: "monospace", fontSize: "0.85rem" }}
                            >
                              {shortenAddress(escrowAddress)}
                            </a>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>

                    {/* Action Card */}
                    {wallet.address && (
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
                            {locale === "ja" ? "アクション" : "Actions"}
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
                                  {locale === "ja" ? "残高" : "Balance"}
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

                              {/* Allowance Status */}
                              {purchaseValidation.hasEnoughBalance && (
                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    p: 1.5,
                                    borderRadius: 2,
                                    background: "rgba(247, 243, 235, 0.02)",
                                    border: "1px solid var(--color-border)",
                                  }}
                                >
                                  <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
                                    {locale === "ja" ? "承認状況" : "Approval"}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 500,
                                      color: purchaseValidation.hasEnoughAllowance
                                        ? "var(--status-success)"
                                        : "var(--color-text-muted)",
                                    }}
                                  >
                                    {purchaseValidation.hasEnoughAllowance
                                      ? locale === "ja"
                                        ? "承認済み"
                                        : "Approved"
                                      : locale === "ja"
                                      ? "承認が必要"
                                      : "Needs Approval"}
                                  </Typography>
                                </Box>
                              )}

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
                                    ? `残高が${formatAmount(info.totalAmount - purchaseValidation.balance, decimals, symbol)}不足しています`
                                    : `Insufficient balance by ${formatAmount(info.totalAmount - purchaseValidation.balance, decimals, symbol)}`}
                                </Alert>
                              )}
                            </Box>
                          )}

                          {/* Lock Button (for non-producer, when open) */}
                          {info.status === "open" && userRole !== "producer" && txStep !== "success" && (
                            <Button
                              variant="contained"
                              fullWidth
                              startIcon={actionLoading ? <CircularProgress size={20} /> : <LockIcon />}
                              onClick={handleLock}
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
                                : purchaseValidation.needsApproval
                                ? locale === "ja"
                                  ? `承認して購入 (${formatAmount(info.totalAmount, decimals, symbol)})`
                                  : `Approve & Purchase (${formatAmount(info.totalAmount, decimals, symbol)})`
                                : locale === "ja"
                                ? `購入する (${formatAmount(info.totalAmount, decimals, symbol)})`
                                : `Purchase (${formatAmount(info.totalAmount, decimals, symbol)})`}
                            </Button>
                          )}

                          {/* Producer's own listing - waiting message + cancel button */}
                          {info.status === "open" && userRole === "producer" && txStep !== "success" && (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <Typography sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                                {locale === "ja" ? "購入者を待っています..." : "Waiting for buyer..."}
                              </Typography>
                              <Button
                                variant="outlined"
                                fullWidth
                                startIcon={actionLoading ? <CircularProgress size={20} /> : <CancelIcon />}
                                onClick={() => setCancelDialogOpen(true)}
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
                                  ? "出品をキャンセル"
                                  : "Cancel Listing"}
                              </Button>
                            </Box>
                          )}

                          {/* Loading state while milestones refresh */}
                          {info.status === "active" && userRole === "producer" && milestonesLoading && txStep === "idle" && (
                            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                              <CircularProgress size={24} sx={{ color: "var(--color-primary)" }} />
                            </Box>
                          )}

                          {/* Submit Button (for producer, when active) */}
                          {info.status === "active" && userRole === "producer" && nextMilestoneIndex >= 0 && txStep !== "success" && !milestonesLoading && (
                            <Button
                              variant="contained"
                              fullWidth
                              startIcon={actionLoading ? <CircularProgress size={20} /> : <SendIcon />}
                              onClick={() => handleSubmit(nextMilestoneIndex)}
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

                          {/* Buyer message when active */}
                          {info.status === "active" && userRole === "buyer" && (
                            <Typography sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                              {locale === "ja" ? "生産者の進捗を確認中..." : "Tracking producer progress..."}
                            </Typography>
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

                          {/* Cancelled message */}
                          {info.status === "cancelled" && (
                            <Box sx={{ textAlign: "center", py: 2 }}>
                              <CancelIcon sx={{ fontSize: 48, color: "var(--status-error)", mb: 1 }} />
                              <Typography sx={{ color: "var(--color-text)" }}>
                                {locale === "ja" ? "この出品はキャンセルされました" : "This listing has been cancelled"}
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Connect Wallet prompt */}
                    {!wallet.address && info.status === "open" && (
                      <Card
                        sx={{
                          background: "var(--color-surface)",
                          backdropFilter: "blur(20px)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 3,
                        }}
                      >
                        <CardContent sx={{ p: 3, textAlign: "center" }}>
                          <Typography sx={{ color: "var(--color-text-muted)", mb: 2 }}>
                            {locale === "ja"
                              ? "購入するにはウォレットを接続してください"
                              : "Connect wallet to purchase"}
                          </Typography>
                          <Button
                            variant="contained"
                            onClick={wallet.connect}
                            disabled={wallet.isConnecting}
                            sx={{
                              background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                              color: "var(--sumi-black)",
                              fontWeight: 600,
                              borderRadius: 2,
                              boxShadow: "var(--shadow-subtle), var(--shadow-copper)",
                              "&:hover": {
                                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-deep) 100%)",
                                transform: "translateY(-2px)",
                              },
                            }}
                          >
                            {wallet.isConnecting
                              ? locale === "ja"
                                ? "接続中..."
                                : "Connecting..."
                              : locale === "ja"
                              ? "ウォレット接続"
                              : "Connect Wallet"}
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </Box>

                  {/* Right: Milestones */}
                  <Box>
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
                          {locale === "ja" ? "マイルストーン" : "Milestones"}
                        </Typography>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {milestones.map((milestone, index) => {
                            const amount = milestoneAmounts[index] ?? 0n;
                            const isNext = index === nextMilestoneIndex && info.status === "active";
                            const isFuture = !milestone.completed && index > nextMilestoneIndex && info.status === "active";

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
                                  {/* Icon */}
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

                                  {/* Content */}
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
                                            {locale === "ja" ? "順番待ち" : "Waiting"}
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
                                    <Typography
                                      variant="caption"
                                      sx={{ color: "var(--color-text-muted)" }}
                                    >
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

                    {/* Event Timeline */}
                    {events.length > 0 && (
                      <Card
                        sx={{
                          mt: 3,
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
                            {locale === "ja" ? "イベント履歴" : "Event History"}
                          </Typography>

                          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {events.map((event, index) => {
                              const milestoneName =
                                event.type === "Completed" && event.index !== undefined
                                  ? milestones[Number(event.index)]?.name
                                  : undefined;

                              return (
                                <Box
                                  key={index}
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    p: 1.5,
                                    borderRadius: 2,
                                    background: "rgba(247, 243, 235, 0.02)",
                                    border: "1px solid var(--color-border)",
                                  }}
                                >
                                  <Box>
                                    <Typography sx={{ color: "var(--color-text)", fontWeight: 500 }}>
                                      {event.type === "Locked"
                                        ? locale === "ja"
                                          ? "購入"
                                          : "Purchased"
                                        : milestoneName ||
                                          (event.index !== undefined
                                            ? `Milestone #${event.index}`
                                            : locale === "ja"
                                              ? "マイルストーン"
                                              : "Milestone")}
                                    </Typography>
                                    {event.amount && (
                                      <Typography variant="caption" sx={{ color: "var(--color-text-muted)" }}>
                                        {formatAmount(event.amount, decimals, symbol)}
                                      </Typography>
                                    )}
                                  </Box>
                                  <a
                                    href={getTxUrl(event.txHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: "var(--color-primary)", fontSize: "0.85rem" }}
                                  >
                                    {locale === "ja" ? "TX確認" : "View TX"}
                                  </a>
                                </Box>
                              );
                            })}
                          </Box>
                        </CardContent>
                      </Card>
                    )}
                  </Box>
                </Box>
              </motion.div>
            )}
          </Container>
        </Box>

        {/* Cancel Confirmation Dialog */}
        <Dialog
          open={cancelDialogOpen}
          onClose={() => setCancelDialogOpen(false)}
          PaperProps={{
            sx: {
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 3,
            },
          }}
        >
          <DialogTitle sx={{ color: "var(--color-text)" }}>
            {locale === "ja" ? "出品をキャンセルしますか？" : "Cancel this listing?"}
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "var(--color-text-secondary)" }}>
              {locale === "ja"
                ? "この操作は取り消せません。出品をキャンセルするとNFTがバーンされます。"
                : "This action cannot be undone. Cancelling will burn the NFT."}
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={() => setCancelDialogOpen(false)}
              sx={{ color: "var(--color-text-muted)" }}
            >
              {locale === "ja" ? "戻る" : "Go Back"}
            </Button>
            <Button
              onClick={() => {
                setCancelDialogOpen(false);
                cancel();
              }}
              variant="contained"
              sx={{
                background: "var(--status-error)",
                color: "white",
                "&:hover": {
                  background: "#c0392b",
                },
              }}
            >
              {locale === "ja" ? "キャンセルする" : "Yes, Cancel"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </I18nContext.Provider>
  );
}
