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
import { Footer } from "@/components/Footer";
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
  formatAmount,
} from "@/lib/hooks";
import { I18nContext, translations, type Locale, type TranslationKey } from "@/lib/i18n";
import { isAddress, type Address } from "viem";

import { ListingInfoCard } from "./_components/ListingInfoCard";
import { ActionCard } from "./_components/ActionCard";
import { MilestoneList } from "./_components/MilestoneList";
import { EventTimeline } from "./_components/EventTimeline";
import { CancelDialog } from "./_components/CancelDialog";

export default function ListingDetailPage() {
  const params = useParams();
  const rawAddress = params.address;
  const escrowAddress = useMemo<Address | null>(() => {
    if (typeof rawAddress !== "string") {
      return null;
    }
    return isAddress(rawAddress) ? (rawAddress as Address) : null;
  }, [rawAddress]);
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
  const { owner: nftOwner } = useNftOwner(info?.tokenId ?? null, info?.factory ?? null);

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

  const {
    lock,
    submit,
    approve,
    activateAfterTimeout,
    cancel,
    requestFinalDelivery,
    confirmDelivery,
    finalizeAfterTimeout,
    isLoading: actionLoading,
    error: actionError,
    txHash,
    txStep,
    resetState,
  } = useEscrowActions(escrowAddress, handleSuccess);

  useEffect(() => {
    if (txStep === "success") {
      const timer = setTimeout(() => {
        resetState();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [txStep, resetState]);

  const userRole = getUserRole(wallet.address, info);
  const isLoading = infoLoading || milestonesLoading;
  const completedCount = milestones.filter((m) => m.completed).length;
  const totalCount = milestones.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isJapanese = locale === "ja";

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

  const nextMilestoneIndex = milestones.findIndex((m) => !m.completed);
  const nextMilestone =
    nextMilestoneIndex >= 0 && nextMilestoneIndex < milestones.length
      ? milestones[nextMilestoneIndex]
      : null;
  const nextMilestoneAmount =
    nextMilestone && nextMilestoneIndex >= 0 ? milestoneAmounts[nextMilestoneIndex] ?? 0n : 0n;
  const remainingAmount = info ? info.totalAmount - info.releasedAmount : 0n;
  const atFinalMilestone = nextMilestone !== null && nextMilestoneIndex === milestones.length - 1;

  const formatDeadline = useCallback(
    (deadline: bigint | null) => {
      if (deadline === null) return null;
      return new Intl.DateTimeFormat(isJapanese ? "ja-JP" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(Number(deadline) * 1000));
    },
    [isJapanese]
  );

  const workspaceGuide = useMemo(() => {
    if (!info) return null;

    const baseMetrics = [
      {
        label: isJapanese ? "現在の状態" : "Current state",
        value:
          info.status === "open"
            ? isJapanese
              ? "開始前"
              : "Before start"
            : info.status === "locked"
            ? isJapanese
              ? "確認待ち"
              : "Under review"
            : info.status === "active"
            ? isJapanese
              ? "進行中"
              : "In progress"
            : isJapanese
            ? "完了"
            : "Completed",
      },
      {
        label: isJapanese ? "受け取り済み" : "Paid already",
        value: formatAmount(info.releasedAmount, decimals, symbol),
      },
    ];

    if (!wallet.address) {
      return {
        eyebrow: isJapanese ? "担当画面" : "Assigned workspace",
        title: isJapanese ? "ログインすると、次の作業がここに出ます" : "Log in to reveal the next action",
        description: isJapanese
          ? "この画面では、今日の工程の記録、確認待ち、次に受け取れる予定額をひと目で追えます。"
          : "This page is where the next step, waiting reviews, and expected payout are surfaced in one view.",
        metrics: [
          baseMetrics[0],
          {
            label: isJapanese ? "合計予定額" : "Planned total",
            value: formatAmount(info.totalAmount, decimals, symbol),
          },
        ],
      };
    }

    if (userRole === "producer") {
      if (info.status === "open") {
        return {
          eyebrow: isJapanese ? "生産者向け" : "For producer",
          title: isJapanese ? "いまは買い手の支払い準備待ちです" : "Waiting for buyer payment setup",
          description: isJapanese
            ? "買い手が支払い準備を進めると、ここが進捗記録の画面に切り替わります。"
            : "Once the buyer secures payment, this page becomes the workspace for progress recording.",
          metrics: [
            baseMetrics[0],
            {
              label: isJapanese ? "合計予定額" : "Planned total",
              value: formatAmount(info.totalAmount, decimals, symbol),
            },
          ],
        };
      }

      if (info.status === "locked") {
        return {
          eyebrow: isJapanese ? "生産者向け" : "For producer",
          title: isJapanese ? "買い手が開始前の確認をしています" : "The buyer is reviewing before start",
          description: isJapanese
            ? "条件確認が終わると取引が始まります。必要ならチャットで補足を伝えてください。"
            : "The flow will begin after review. Use chat if you need to add context before start.",
          metrics: [
            baseMetrics[0],
            {
              label: isJapanese ? "開始確認の期限" : "Start review deadline",
              value: formatDeadline(info.lockDeadline) ?? (isJapanese ? "未設定" : "Not set"),
            },
          ],
        };
      }

      if (info.status === "active" && atFinalMilestone && info.finalRequestedAt === 0n) {
        return {
          eyebrow: isJapanese ? "最終受け渡し" : "Final handoff",
          title: isJapanese ? "受け渡し完了の連絡を送る段階です" : "Time to notify final handoff",
          description: isJapanese
            ? "最後の受け渡しが終わったら、買い手に確認依頼を送って残額の準備に進みます。"
            : "Once the final handoff is done, notify the buyer so the remaining amount can move forward.",
          metrics: [
            {
              label: isJapanese ? "残りの予定額" : "Remaining amount",
              value: formatAmount(remainingAmount, decimals, symbol),
            },
            baseMetrics[1],
          ],
        };
      }

      if (info.status === "active" && atFinalMilestone && info.finalRequestedAt > 0n) {
        return {
          eyebrow: isJapanese ? "最終確認" : "Final confirmation",
          title: isJapanese ? "受け取り確認が終わると残額に進みます" : "Remaining payout follows buyer confirmation",
          description: isJapanese
            ? "買い手の確認待ちです。期限を過ぎたらここから最終確定に進めます。"
            : "Waiting for the buyer's confirmation. If the deadline passes, you can finalize from here.",
          metrics: [
            {
              label: isJapanese ? "残りの予定額" : "Remaining amount",
              value: formatAmount(remainingAmount, decimals, symbol),
            },
            {
              label: isJapanese ? "最終確認の期限" : "Final confirmation deadline",
              value:
                formatDeadline(info.finalConfirmationDeadline) ??
                (isJapanese ? "未設定" : "Not set"),
            },
          ],
        };
      }

      if (info.status === "active" && nextMilestone) {
        return {
          eyebrow: isJapanese ? "今日の作業" : "Today's task",
          title: isJapanese
            ? `「${nextMilestone.name}」を記録すれば次へ進めます`
            : `Record "${nextMilestone.name}" to move forward`,
          description: isJapanese
            ? "写真やメモは任意です。まずは1回で記録できることを優先しています。"
            : "Photos and notes are optional. The default path is meant to be a single clear action.",
          metrics: [
            {
              label: isJapanese ? "次の受け取り予定" : "Next expected payout",
              value: formatAmount(nextMilestoneAmount, decimals, symbol),
            },
            baseMetrics[1],
          ],
        };
      }
    }

    if (userRole === "buyer") {
      if (info.status === "open") {
        return {
          eyebrow: isJapanese ? "買い手向け" : "For buyer",
          title: isJapanese ? "内容を確認して支払い準備に進めます" : "Review the plan and secure payment",
          description: isJapanese
            ? "この実証実験では、内容確認のあとに支払い準備を進める流れです。"
            : "In this pilot, you review the terms first and then secure payment for the listing.",
          metrics: [
            baseMetrics[0],
            {
              label: isJapanese ? "合計予定額" : "Planned total",
              value: formatAmount(info.totalAmount, decimals, symbol),
            },
          ],
        };
      }

      if (info.status === "locked") {
        return {
          eyebrow: isJapanese ? "買い手向け" : "For buyer",
          title: isJapanese ? "開始するか、今回は見送るかを決める段階です" : "Decide whether to start or stop",
          description: isJapanese
            ? "問題なければ開始、難しければ返金できます。判断材料はこのページにまとまっています。"
            : "Start if the conditions look good. If not, refund and stop from the same page.",
          metrics: [
            baseMetrics[0],
            {
              label: isJapanese ? "開始確認の期限" : "Start review deadline",
              value: formatDeadline(info.lockDeadline) ?? (isJapanese ? "未設定" : "Not set"),
            },
          ],
        };
      }

      if (info.status === "active" && info.finalRequestedAt === 0n) {
        return {
          eyebrow: isJapanese ? "買い手向け" : "For buyer",
          title: isJapanese ? "生産者の次の記録待ちです" : "Waiting for the producer's next record",
          description: isJapanese
            ? "更新が入ると下の履歴に残り、最終受け取り確認が必要なときはここに出ます。"
            : "New records appear below in the history. The final receipt check will surface here when needed.",
          metrics: [baseMetrics[0], baseMetrics[1]],
        };
      }

      if (info.status === "active" && info.finalRequestedAt > 0n) {
        return {
          eyebrow: isJapanese ? "受け取り確認" : "Receipt check",
          title: isJapanese ? "受け取り確認が必要です" : "Receipt confirmation is needed",
          description: isJapanese
            ? "問題なければ確認して完了です。期限を過ぎるとタイムアウトで完了できます。"
            : "Confirm if the handoff looks good. After the deadline, the flow can be finalized by timeout.",
          metrics: [
            {
              label: isJapanese ? "残りの予定額" : "Remaining amount",
              value: formatAmount(remainingAmount, decimals, symbol),
            },
            {
              label: isJapanese ? "確認の期限" : "Confirmation deadline",
              value:
                formatDeadline(info.finalConfirmationDeadline) ??
                (isJapanese ? "未設定" : "Not set"),
            },
          ],
        };
      }
    }

    if (userRole === "none") {
      if (info.status === "open") {
        return {
          eyebrow: isJapanese ? "公開中の案件" : "Open listing",
          title: isJapanese
            ? "内容を確認して支払い準備に進めます"
            : "Review the plan and secure payment",
          description: isJapanese
            ? "まだ開始前です。条件がよければ、下のボタンからこの条件で支払い準備に進めます。"
            : "This listing has not started yet. If the terms look good, you can secure payment from the action card below.",
          metrics: [
            baseMetrics[0],
            {
              label: isJapanese ? "合計予定額" : "Planned total",
              value: formatAmount(info.totalAmount, decimals, symbol),
            },
          ],
        };
      }

      if (info.status === "locked") {
        return {
          eyebrow: isJapanese ? "進行中の案件" : "Listing in review",
          title: isJapanese
            ? "買い手が開始前の確認をしています"
            : "The buyer is reviewing before start",
          description: isJapanese
            ? "この案件はいま確認中です。参加者になると、ここに次の操作が表示されます。"
            : "This listing is currently under review. Once you are a participant, the next action will appear here.",
          metrics: [
            baseMetrics[0],
            {
              label: isJapanese ? "開始確認の期限" : "Start review deadline",
              value: formatDeadline(info.lockDeadline) ?? (isJapanese ? "未設定" : "Not set"),
            },
          ],
        };
      }

      if (info.status === "active") {
        return {
          eyebrow: isJapanese ? "進行中の案件" : "Listing in progress",
          title: isJapanese
            ? "この案件は進行中です"
            : "This listing is currently in progress",
          description: isJapanese
            ? "進捗記録と受け渡しの流れは、参加者に合わせてここに表示されます。"
            : "Progress records and handoff steps appear here for the participants involved in the listing.",
          metrics: [baseMetrics[0], baseMetrics[1]],
        };
      }
    }

    return {
      eyebrow: isJapanese ? "案件の状態" : "Listing state",
      title: isJapanese ? "この案件は完了しています" : "This listing is complete",
      description: isJapanese
        ? "進捗記録と確認は完了済みです。履歴と証明ページから経緯を見返せます。"
        : "Progress recording and confirmations are complete. Use the history and proof view to review what happened.",
      metrics: [baseMetrics[0], baseMetrics[1]],
    };
  }, [
    info,
    wallet.address,
    userRole,
    isJapanese,
    formatDeadline,
    decimals,
    symbol,
    atFinalMilestone,
    nextMilestone,
    nextMilestoneAmount,
    remainingAmount,
  ]);

  const handleLock = async () => {
    if (info) {
      await lock(info.totalAmount);
    }
  };

  const handleSubmit = async (index: number, evidenceHash?: string) => {
    await submit(index, evidenceHash);
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
        <Header onLocaleChange={setLocale} />

        <Box
          component="main"
          className="content-layer"
          sx={{
            flex: 1,
            py: { xs: 3, sm: 4 },
          }}
        >
          <Container maxWidth="lg">
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
                  {isJapanese ? "一覧に戻る" : "Back to listings"}
                </Button>
              </Link>
            </Box>

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

            {isLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress sx={{ color: "var(--color-primary)" }} />
              </Box>
            )}

            {infoError && (
              <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
                {infoError}
              </Alert>
            )}

            {info && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      lg: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
                    },
                    gap: 4,
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {workspaceGuide && (
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
                            sx={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: "var(--color-primary)",
                              mb: 1.25,
                            }}
                          >
                            {workspaceGuide.eyebrow}
                          </Typography>
                          <Typography
                            variant="h5"
                            sx={{
                              fontFamily: "var(--font-display)",
                              fontWeight: 700,
                              color: "var(--color-text)",
                              mb: 1.5,
                              lineHeight: 1.25,
                            }}
                          >
                            {workspaceGuide.title}
                          </Typography>
                          <Typography
                            sx={{
                              color: "var(--color-text-secondary)",
                              lineHeight: 1.8,
                              mb: 3,
                            }}
                          >
                            {workspaceGuide.description}
                          </Typography>
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                              gap: 2,
                            }}
                          >
                            {workspaceGuide.metrics.map((metric) => (
                              <Box
                                key={metric.label}
                                sx={{
                                  p: 2,
                                  borderRadius: 2,
                                  background: "var(--color-bg-elevated)",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                <Typography
                                  sx={{ fontSize: "0.75rem", color: "var(--color-text-muted)", mb: 0.75 }}
                                >
                                  {metric.label}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontFamily: "var(--font-display)",
                                    fontWeight: 700,
                                    color: "var(--color-text)",
                                  }}
                                >
                                  {metric.value}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    )}

                    {wallet.address ? (
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
                        onActivateAfterTimeout={activateAfterTimeout}
                        onCancel={() => setCancelDialogOpen(true)}
                        onRequestFinalDelivery={(evidenceHash) => {
                          void requestFinalDelivery(evidenceHash);
                        }}
                        onConfirmDelivery={confirmDelivery}
                        onFinalizeAfterTimeout={finalizeAfterTimeout}
                      />
                    ) : (
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
                            sx={{
                              fontFamily: "var(--font-display)",
                              fontWeight: 600,
                              color: "var(--color-text)",
                              mb: 1,
                            }}
                          >
                            {isJapanese ? "続けるにはログインしてください" : "Log in to continue"}
                          </Typography>
                          <Typography
                            sx={{
                              color: "var(--color-text-secondary)",
                              lineHeight: 1.7,
                              mb: 2.5,
                            }}
                          >
                            {isJapanese
                              ? "ログインすると、この案件で次にやることと確認待ちが自動で出ます。"
                              : "After login, the next action and waiting confirmations for this listing will appear automatically."}
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
                            }}
                          >
                            {wallet.isConnecting
                              ? isJapanese
                                ? "ログイン中..."
                                : "Logging in..."
                              : isJapanese
                              ? "ログインして担当画面を開く"
                              : "Log in to open the workspace"}
                          </Button>
                        </CardContent>
                      </Card>
                    )}

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
                            peerAddress={userRole === "producer" ? (nftOwner || info.buyer) : info.producer}
                            peerLabel={
                              userRole === "producer"
                                ? isJapanese
                                  ? "買い手・所有者"
                                  : "Buyer / holder"
                                : isJapanese
                                ? "生産者"
                                : "Producer"
                            }
                            enabled={true}
                            height={350}
                          />
                        </CardContent>
                      </Card>
                    )}
                  </Box>
                </Box>
              </motion.div>
            )}
          </Container>
        </Box>

        <Footer />

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
