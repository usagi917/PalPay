"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Box,
  Container,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Header, ConnectWallet } from "@/components";
import { ChatWindow } from "@/components/chat";
import {
  useWallet,
  useEscrowInfo,
  useMilestones,
  useEscrowActions,
  useEscrowEvents,
  useTokenInfo,
  usePurchaseValidation,
  useNftOwner,
  getUserRole,
  canAccessChat,
} from "@/lib/hooks";
import { I18nContext, translations, type Locale, type TranslationKey } from "@/lib/i18n";
import type { Address } from "viem";

import { ListingInfoCard } from "./_components/ListingInfoCard";
import { ActionCard } from "./_components/ActionCard";
import { MilestoneList } from "./_components/MilestoneList";
import { EventTimeline } from "./_components/EventTimeline";
import { CancelDialog } from "./_components/CancelDialog";

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
  const { owner: nftOwner } = useNftOwner(info?.tokenId ?? null);

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

  const { lock, submit, approve, cancel, confirmDelivery, isLoading: actionLoading, error: actionError, txHash, txStep, resetState } = useEscrowActions(
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

  const handleCancelConfirm = () => {
    setCancelDialogOpen(false);
    cancel();
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
                    <ListingInfoCard
                      info={info}
                      locale={locale}
                      decimals={decimals}
                      symbol={symbol}
                      completedCount={completedCount}
                      totalCount={totalCount}
                      progressPercent={progressPercent}
                      escrowAddress={escrowAddress}
                    />

                    {/* Action Card */}
                    {wallet.address && (
                      <ActionCard
                        info={info}
                        locale={locale}
                        decimals={decimals}
                        symbol={symbol}
                        userRole={userRole}
                        txStep={txStep}
                        txHash={txHash}
                        actionLoading={actionLoading}
                        actionError={actionError}
                        resetState={resetState}
                        purchaseValidation={purchaseValidation}
                        milestones={milestones}
                        milestonesLoading={milestonesLoading}
                        nextMilestoneIndex={nextMilestoneIndex}
                        onLock={handleLock}
                        onSubmit={handleSubmit}
                        onApprove={approve}
                        onCancel={() => setCancelDialogOpen(true)}
                        onConfirmDelivery={confirmDelivery}
                      />
                    )}

                    {/* Chat Window - for NFT holders and producer only */}
                    {wallet.address && canAccessChat(wallet.address, info, nftOwner) && (
                      <Card
                        sx={{
                          background: "var(--color-surface)",
                          backdropFilter: "blur(20px)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 3,
                        }}
                      >
                        <CardContent sx={{ p: 0 }}>
                          <ChatWindow
                            escrowAddress={escrowAddress}
                            peerAddress={
                              userRole === "producer"
                                ? (nftOwner || info.buyer) // Producer chats with current NFT owner
                                : info.producer // NFT owner chats with producer
                            }
                            peerLabel={
                              userRole === "producer"
                                ? (locale === "ja" ? "NFT所有者" : "NFT Owner")
                                : (locale === "ja" ? "出品者" : "Producer")
                            }
                            enabled={true}
                            height={350}
                          />
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
                              ? "購入するにはログインしてください"
                              : "Log in to purchase"}
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
                                ? "ログイン中..."
                                : "Logging in..."
                              : locale === "ja"
                              ? "ログイン"
                              : "Log in"}
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </Box>

                  {/* Right: Milestones */}
                  <Box>
                    <MilestoneList
                      milestones={milestones}
                      milestoneAmounts={milestoneAmounts}
                      nextMilestoneIndex={nextMilestoneIndex}
                      status={info.status}
                      locale={locale}
                      decimals={decimals}
                      symbol={symbol}
                    />

                    <EventTimeline
                      events={events}
                      milestones={milestones}
                      locale={locale}
                      decimals={decimals}
                      symbol={symbol}
                    />
                  </Box>
                </Box>
              </motion.div>
            )}
          </Container>
        </Box>

        {/* Cancel Confirmation Dialog */}
        <CancelDialog
          open={cancelDialogOpen}
          locale={locale}
          onClose={() => setCancelDialogOpen(false)}
          onConfirm={handleCancelConfirm}
        />
      </div>
    </I18nContext.Provider>
  );
}
