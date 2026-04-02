"use client";

import Link from "next/link";
import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Box,
  Container,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Button,
} from "@mui/material";
import {
  Header,
  ConnectWallet,
  ListingCard,
  CreateListingForm,
} from "@/components";
import { Footer } from "@/components/Footer";
import {
  useWallet,
  useListingSummaries,
  useTokenInfo,
} from "@/lib/hooks";
import { I18nContext, translations, type Locale, type TranslationKey } from "@/lib/i18n";

export default function Home() {
  const [locale, setLocale] = useState<Locale>("ja");

  const i18nValue = useMemo(() => ({
    locale,
    setLocale,
    t: (key: TranslationKey) => translations[locale][key] as string,
  }), [locale]);

  const wallet = useWallet();
  const { summaries, isLoading, error, refetch } = useListingSummaries();
  const { symbol, decimals } = useTokenInfo();

  const handleListingCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  const { t } = i18nValue;
  const isJapanese = locale === "ja";

  // Filter listings by status
  const openListings = summaries.filter((s) => s.status === "open");
  const activeListings = summaries.filter((s) => s.status === "active");
  const completedListings = summaries.filter((s) => s.status === "completed");
  const myProducerListings = useMemo(() => {
    if (!wallet.address) return [];
    const lower = wallet.address.toLowerCase();
    return summaries.filter((summary) => summary.producer.toLowerCase() === lower);
  }, [summaries, wallet.address]);

  const producerInProgress = myProducerListings.filter((summary) => summary.status === "active");
  const producerNeedsReview = myProducerListings.filter((summary) => summary.status === "locked");
  const producerWaitingForBuyer = myProducerListings.filter((summary) => summary.status === "open");
  const producerCompleted = myProducerListings.filter((summary) => summary.status === "completed");
  const nextProducerListing =
    producerInProgress[0] ?? producerNeedsReview[0] ?? producerWaitingForBuyer[0] ?? null;

  const heroDescription = isJapanese
    ? "スマホで今日の工程を記録すると、相手に進み具合が伝わり、次の支払い準備までこの画面で確認できます。"
    : "Record today's progress from a phone, show the counterpart what changed, and keep the next payout step visible in the same place.";
  const starterChecklist = isJapanese
    ? [
        "最初にログインして、自分の担当案件を開く",
        "今日の工程が終わったら、その場で記録する",
        "買い手の確認待ちか、次に受け取れる予定額を確認する",
      ]
    : [
        "Log in and open the listing you are responsible for",
        "Record the step as soon as today's work is finished",
        "Check whether you are waiting on buyer confirmation or the next payout",
      ];
  const taskSummary = nextProducerListing
    ? nextProducerListing.status === "active"
      ? {
          title: isJapanese ? "いま記録を進める案件があります" : "You have a listing ready for progress recording",
          body: isJapanese
            ? "作業が終わったら、そのまま担当画面を開いて記録してください。写真やメモは任意です。"
            : "Open the assigned workspace after the work is done and record the update. Photos and notes stay optional.",
        }
      : nextProducerListing.status === "locked"
      ? {
          title: isJapanese ? "買い手の確認待ちがあります" : "A buyer review is waiting",
          body: isJapanese
            ? "条件確認が終わると取引が進みます。必要ならチャットで条件を詰めてください。"
            : "The flow will continue after buyer review. Use chat if you need to align on the conditions.",
        }
      : {
          title: isJapanese ? "支払い待ちの案件があります" : "A listing is waiting for payment setup",
          body: isJapanese
            ? "買い手が支払い準備を進めると次の工程に入れます。案件詳細で状態を確認できます。"
            : "Once the buyer secures payment, the work can move forward. You can check the state from the listing detail.",
        }
    : {
        title: isJapanese ? "まずは担当案件を開けば十分です" : "Opening the assigned listing is enough for now",
        body: isJapanese
          ? "この pilot では、複雑な操作よりも毎回迷わず開けることを優先します。"
          : "In this pilot, the priority is not complexity but making the next action obvious every time.",
      };

  const taskMetrics = [
    {
      label: isJapanese ? "記録する案件" : "Ready to record",
      value: producerInProgress.length,
    },
    {
      label: isJapanese ? "確認待ち" : "Waiting for review",
      value: producerNeedsReview.length + producerWaitingForBuyer.length,
    },
    {
      label: isJapanese ? "完了済み" : "Completed",
      value: producerCompleted.length,
    },
  ];

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
            {/* Hero */}
            <Box
              component="section"
              className="hero"
              sx={{
                textAlign: "center",
                py: { xs: 4, md: 6 },
                mb: 4,
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <Typography
                  className="hero-eyebrow"
                  sx={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "var(--color-primary)",
                    mb: 1.5,
                  }}
                >
                  {t("heroEyebrow")}
                </Typography>
                <Typography
                  variant="h2"
                  className="hero-title"
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: { xs: "1.875rem", sm: "2.5rem", md: "3rem" },
                    lineHeight: 1.15,
                    color: "var(--color-text)",
                    mb: 2,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {t("heroTitle")}
                </Typography>
                <Typography
                  className="hero-subtitle"
                  sx={{
                    fontSize: "1.0625rem",
                    color: "var(--color-text-secondary)",
                    maxWidth: 640,
                    mx: "auto",
                    lineHeight: 1.7,
                  }}
                >
                  {heroDescription}
                </Typography>
              </motion.div>
            </Box>

            {/* Producer-first Workspace Entry */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              <Grid container spacing={3} sx={{ mb: 5 }}>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <Card
                    sx={{
                      height: "100%",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 3,
                    }}
                  >
                    <CardContent sx={{ p: 3.5 }}>
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "var(--color-primary)",
                          mb: 1.5,
                        }}
                      >
                        {isJapanese ? "今日やること" : "Today's flow"}
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          color: "var(--color-text)",
                          fontSize: { xs: "1.6rem", md: "2rem" },
                          lineHeight: 1.2,
                          mb: 1.5,
                        }}
                      >
                        {wallet.address
                          ? taskSummary.title
                          : isJapanese
                          ? "最初は3つだけ分かれば進められます"
                          : "Three simple steps are enough to get started"}
                      </Typography>
                      <Typography
                        sx={{
                          color: "var(--color-text-secondary)",
                          lineHeight: 1.8,
                          mb: 3,
                          maxWidth: 640,
                        }}
                      >
                        {wallet.address
                          ? taskSummary.body
                          : isJapanese
                          ? "この pilot では、難しい用語を覚える必要はありません。担当案件を開いて、今日終わったことをその場で残せれば十分です。"
                          : "This pilot does not expect people to learn Web3 terms. Opening the assigned listing and recording what finished today is enough."}
                      </Typography>

                      {!wallet.address && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                          {starterChecklist.map((item, index) => (
                            <Box
                              key={item}
                              sx={{
                                display: "flex",
                                gap: 1.5,
                                alignItems: "flex-start",
                                p: 1.5,
                                borderRadius: 2,
                                background: "var(--color-bg-elevated)",
                                border: "1px solid var(--color-border)",
                              }}
                            >
                              <Box
                                sx={{
                                  minWidth: 28,
                                  height: 28,
                                  borderRadius: "50%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 700,
                                  color: "var(--color-primary)",
                                  background: "var(--color-primary-surface)",
                                  border: "1px solid var(--color-border-accent)",
                                }}
                              >
                                {index + 1}
                              </Box>
                              <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                                {item}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}

                      {wallet.address && (
                        <>
                          <Grid container spacing={2} sx={{ mb: 3 }}>
                            {taskMetrics.map((metric) => (
                              <Grid size={{ xs: 12, sm: 4 }} key={metric.label}>
                                <Box
                                  sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    background: "var(--color-bg-elevated)",
                                    border: "1px solid var(--color-border)",
                                  }}
                                >
                                  <Typography
                                    sx={{
                                      fontSize: "0.75rem",
                                      color: "var(--color-text-muted)",
                                      mb: 0.75,
                                    }}
                                  >
                                    {metric.label}
                                  </Typography>
                                  <Typography
                                    sx={{
                                      fontFamily: "var(--font-display)",
                                      fontWeight: 700,
                                      fontSize: "1.6rem",
                                      color: "var(--color-text)",
                                    }}
                                  >
                                    {metric.value}
                                  </Typography>
                                </Box>
                              </Grid>
                            ))}
                          </Grid>

                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                            <Link href="/my" style={{ textDecoration: "none" }}>
                              <Button
                                variant="contained"
                                sx={{
                                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                                  color: "var(--sumi-black)",
                                  fontWeight: 600,
                                  borderRadius: 2,
                                  boxShadow: "var(--shadow-subtle), var(--shadow-copper)",
                                }}
                              >
                                {isJapanese ? "担当一覧を見る" : "Open my workspace"}
                              </Button>
                            </Link>
                            {nextProducerListing && (
                              <Link
                                href={`/listing/${nextProducerListing.escrowAddress}`}
                                style={{ textDecoration: "none" }}
                              >
                                <Button
                                  variant="outlined"
                                  sx={{
                                    borderColor: "var(--color-border-strong)",
                                    color: "var(--color-text-secondary)",
                                    borderRadius: 2,
                                  }}
                                >
                                  {isJapanese ? "次の案件を開く" : "Open next listing"}
                                </Button>
                              </Link>
                            )}
                          </Box>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, lg: 5 }}>
                  <ConnectWallet
                    address={wallet.address}
                    isConnecting={wallet.isConnecting}
                    error={wallet.error}
                    userRole="none"
                    onConnect={wallet.connect}
                    onDisconnect={wallet.disconnect}
                  />

                  {wallet.address && (
                    <Box sx={{ mt: 3 }}>
                      <Card
                        sx={{
                          background: "var(--color-surface)",
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
                            {isJapanese ? "運営用の案件登録" : "Pilot listing setup"}
                          </Typography>
                          <Typography
                            sx={{
                              color: "var(--color-text-secondary)",
                              lineHeight: 1.7,
                              mb: 2.5,
                            }}
                          >
                            {isJapanese
                              ? "新しい案件を立ち上げるときだけ使う導線です。生産者の通常業務より下に置いています。"
                              : "Use this only when a new pilot listing needs to be created. It stays secondary to the producer's day-to-day workflow."}
                          </Typography>
                          <CreateListingForm onSuccess={handleListingCreated} />
                        </CardContent>
                      </Card>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </motion.div>

            {/* Loading */}
            {isLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress sx={{ color: "var(--color-primary)" }} />
              </Box>
            )}

            {/* Error */}
            {error && (
              <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {!isLoading && summaries.length > 0 && (
              <Box component="section" sx={{ mb: 4 }}>
                <Typography
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: "1.35rem",
                    color: "var(--color-text)",
                    mb: 0.75,
                  }}
                >
                  {isJapanese ? "案件一覧" : "Listings"}
                </Typography>
                <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                  {isJapanese
                    ? "実証実験で動いている案件を、開始前・進行中・完了済みで見られます。"
                    : "Browse pilot listings by stage: before start, in progress, and completed."}
                </Typography>
              </Box>
            )}

            {/* Open Listings */}
            {openListings.length > 0 && (
              <Box component="section" sx={{ mb: 6 }}>
                <Box className="section-header" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                  <Box
                    className="section-dot section-dot-success"
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--status-success)",
                    }}
                  />
                  <Typography
                    variant="h5"
                    className="section-title"
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "1.25rem",
                      color: "var(--color-text)",
                    }}
                  >
                    {locale === "ja" ? "開始前・支払い待ち" : "Before start"}
                  </Typography>
                  <Typography
                    component="span"
                    className="section-count"
                    sx={{ color: "var(--color-text-muted)", fontWeight: 400 }}
                  >
                    ({openListings.length})
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  {openListings.map((listing, index) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={listing.escrowAddress}>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <ListingCard
                          listing={listing}
                          tokenSymbol={symbol}
                          tokenDecimals={decimals}
                        />
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Active Listings */}
            {activeListings.length > 0 && (
              <Box component="section" sx={{ mb: 6 }}>
                <Box className="section-header" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                  <Box
                    className="section-dot section-dot-info"
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--status-info)",
                    }}
                  />
                  <Typography
                    variant="h5"
                    className="section-title"
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "1.25rem",
                      color: "var(--color-text)",
                    }}
                  >
                    {locale === "ja" ? "進行中の案件" : "In progress"}
                  </Typography>
                  <Typography
                    component="span"
                    className="section-count"
                    sx={{ color: "var(--color-text-muted)", fontWeight: 400 }}
                  >
                    ({activeListings.length})
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  {activeListings.map((listing, index) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={listing.escrowAddress}>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <ListingCard
                          listing={listing}
                          tokenSymbol={symbol}
                          tokenDecimals={decimals}
                        />
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Completed Listings */}
            {completedListings.length > 0 && (
              <Box component="section" sx={{ mb: 6 }}>
                <Box className="section-header" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                  <Box
                    className="section-dot section-dot-muted"
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--color-text-muted)",
                    }}
                  />
                  <Typography
                    variant="h5"
                    className="section-title"
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "1.25rem",
                      color: "var(--color-text)",
                    }}
                  >
                    {locale === "ja" ? "完了した案件" : "Completed"}
                  </Typography>
                  <Typography
                    component="span"
                    className="section-count"
                    sx={{ color: "var(--color-text-muted)", fontWeight: 400 }}
                  >
                    ({completedListings.length})
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  {completedListings.map((listing, index) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={listing.escrowAddress}>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <ListingCard
                          listing={listing}
                          tokenSymbol={symbol}
                          tokenDecimals={decimals}
                        />
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Empty State */}
            {!isLoading && summaries.length === 0 && (
              <Box
                className="empty-state"
                sx={{
                  textAlign: "center",
                  py: 8,
                  color: "var(--color-text-muted)",
                }}
              >
                <Typography
                  variant="h6"
                  className="empty-state-title"
                  sx={{
                    fontFamily: "var(--font-display)",
                    mb: 1,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {locale === "ja" ? "まだ出品がありません" : "No listings yet"}
                </Typography>
                <Typography variant="body2" className="empty-state-description">
                  {locale === "ja"
                    ? "まずはログインして、担当案件が見える状態にしましょう"
                    : "Start by logging in so the assigned listings become visible."}
                </Typography>
              </Box>
            )}
          </Container>
        </Box>

        <Footer />
      </div>
    </I18nContext.Provider>
  );
}
