"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import { Header, ConnectWallet, ListingCard } from "@/components";
import { Footer } from "@/components/Footer";
import {
  useWallet,
  useMyListings,
  useTokenInfo,
  formatAmount,
} from "@/lib/hooks";
import { I18nContext, translations, type Locale, type TranslationKey } from "@/lib/i18n";

type TabValue = "producer" | "buyer";
type StatusFilter = "all" | "open" | "locked" | "active" | "completed";

export default function MyPage() {
  const [locale, setLocale] = useState<Locale>("ja");
  const [activeTab, setActiveTab] = useState<TabValue>("producer");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const i18nValue = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: TranslationKey) => translations[locale][key] as string,
    }),
    [locale]
  );

  const wallet = useWallet();
  const { asProducer, asBuyer, stats, isLoading, error } = useMyListings(wallet.address);
  const { symbol, decimals } = useTokenInfo();
  const isJapanese = locale === "ja";

  const filteredListings = useMemo(() => {
    const listings = activeTab === "producer" ? asProducer : asBuyer;
    if (statusFilter === "all") return listings;
    return listings.filter((listing) => listing.status === statusFilter);
  }, [activeTab, asProducer, asBuyer, statusFilter]);

  const availableFilters = useMemo(() => {
    if (activeTab === "producer") {
      return [
        { value: "all" as StatusFilter, count: asProducer.length },
        { value: "open" as StatusFilter, count: stats.producerOpen },
        { value: "locked" as StatusFilter, count: stats.producerLocked },
        { value: "active" as StatusFilter, count: stats.producerActive },
        { value: "completed" as StatusFilter, count: stats.producerCompleted },
      ];
    }

    return [
      { value: "all" as StatusFilter, count: asBuyer.length },
      { value: "locked" as StatusFilter, count: stats.buyerLocked },
      { value: "active" as StatusFilter, count: stats.buyerActive },
      { value: "completed" as StatusFilter, count: stats.buyerCompleted },
    ];
  }, [activeTab, asProducer.length, asBuyer.length, stats]);

  const producerFilterLabels: Record<StatusFilter, { ja: string; en: string }> = {
    all: { ja: "すべて", en: "All" },
    open: { ja: "支払い待ち", en: "Awaiting payment" },
    locked: { ja: "確認待ち", en: "Waiting for review" },
    active: { ja: "記録する", en: "Ready to record" },
    completed: { ja: "完了", en: "Completed" },
  };

  const buyerFilterLabels: Record<StatusFilter, { ja: string; en: string }> = {
    all: { ja: "すべて", en: "All" },
    open: { ja: "対象外", en: "N/A" },
    locked: { ja: "開始前", en: "Before start" },
    active: { ja: "確認中", en: "In progress" },
    completed: { ja: "完了", en: "Completed" },
  };

  const filterLabels = activeTab === "producer" ? producerFilterLabels : buyerFilterLabels;
  const nextProducerListing =
    asProducer.find((listing) => listing.status === "active") ??
    asProducer.find((listing) => listing.status === "locked") ??
    asProducer.find((listing) => listing.status === "open") ??
    null;

  const producerNeedsAttention = stats.producerActive + stats.producerLocked;
  const producerWaiting = stats.producerOpen;
  const producerDone = stats.producerCompleted;
  const buyerPending = stats.buyerLocked + stats.buyerActive;

  const producerSummary = nextProducerListing
    ? nextProducerListing.status === "active"
      ? {
          title: isJapanese ? "今日記録する案件があります" : "A listing is ready to record today",
          body: isJapanese
            ? "担当画面を開いて、今日終わった工程をその場で記録してください。"
            : "Open the assigned listing and record the step that finished today.",
        }
      : nextProducerListing.status === "locked"
      ? {
          title: isJapanese ? "買い手の確認待ちがあります" : "A buyer review is waiting",
          body: isJapanese
            ? "条件確認が終わると進行中に変わります。必要ならチャットで補足できます。"
            : "The listing will move into active progress after buyer review. Add context in chat if needed.",
        }
      : {
          title: isJapanese ? "支払い準備待ちの案件があります" : "A listing is waiting for payment setup",
          body: isJapanese
            ? "買い手が支払い準備を進めると、記録する画面に切り替わります。"
            : "Once the buyer secures payment, the listing will switch into the progress workspace.",
        }
    : {
        title: isJapanese ? "いま優先する案件はありません" : "There is no urgent producer task right now",
        body: isJapanese
          ? "まずは完了済みや待機中の案件を見返せば十分です。"
          : "Review completed or waiting listings first if you want to check the current state.",
      };

  const summaryCards = [
    {
      label: isJapanese ? "要対応" : "Needs attention",
      value: producerNeedsAttention,
    },
    {
      label: isJapanese ? "支払い待ち" : "Waiting for payment",
      value: producerWaiting,
    },
    {
      label: isJapanese ? "完了済み" : "Completed",
      value: producerDone,
    },
  ];

  return (
    <I18nContext.Provider value={i18nValue}>
      <div className="app-shell">
        <Header onLocaleChange={setLocale} />

        <Box
          component="main"
          className="content-layer"
          sx={{ flex: 1, py: { xs: 3, sm: 4 } }}
        >
          <Container maxWidth="lg">
            <Box sx={{ mb: 3 }}>
              <Link href="/" style={{ textDecoration: "none" }}>
                <Box
                  component="button"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    background: "none",
                    border: "none",
                    color: "var(--color-text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    "&:hover": { color: "var(--color-primary)" },
                  }}
                >
                  <ArrowBackIcon fontSize="small" />
                  {isJapanese ? "一覧に戻る" : "Back to listings"}
                </Box>
              </Link>
            </Box>

            <Typography
              variant="h4"
              sx={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--color-text)",
                mb: 1,
              }}
            >
              {isJapanese ? "担当一覧" : "My workspace"}
            </Typography>
            <Typography
              sx={{
                color: "var(--color-text-secondary)",
                lineHeight: 1.7,
                mb: 3,
                maxWidth: 720,
              }}
            >
              {isJapanese
                ? "生産者として今やることを先頭に出しています。買い手としての確認は必要な時だけ軽く見られる構成です。"
                : "This page prioritizes the producer's next action. Buyer-side review stays available as a lighter secondary view."}
            </Typography>

            <Box sx={{ mb: 4 }}>
              <ConnectWallet
                address={wallet.address}
                isConnecting={wallet.isConnecting}
                error={wallet.error}
                userRole="none"
                onConnect={wallet.connect}
                onDisconnect={wallet.disconnect}
              />
            </Box>

            {!wallet.address && (
              <Card
                sx={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 3,
                  textAlign: "center",
                  py: 6,
                }}
              >
                <CardContent>
                  <Typography sx={{ color: "var(--color-text-muted)" }}>
                    {isJapanese
                      ? "ログインすると、要対応の案件と次に開く案件がここに並びます。"
                      : "Log in to see pending listings and the next workspace to open."}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {wallet.address && (
              <>
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid size={{ xs: 12, lg: 8 }}>
                    <Card
                      sx={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 3,
                        height: "100%",
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
                          {isJapanese ? "生産者としての優先事項" : "Producer priority"}
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
                          {producerSummary.title}
                        </Typography>
                        <Typography
                          sx={{
                            color: "var(--color-text-secondary)",
                            lineHeight: 1.8,
                            mb: 3,
                          }}
                        >
                          {producerSummary.body}
                        </Typography>

                        <Grid container spacing={2} sx={{ mb: 3 }}>
                          {summaryCards.map((card) => (
                            <Grid size={{ xs: 12, sm: 4 }} key={card.label}>
                              <Box
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
                                  {card.label}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontFamily: "var(--font-display)",
                                    fontWeight: 700,
                                    fontSize: "1.6rem",
                                    color: "var(--color-text)",
                                  }}
                                >
                                  {card.value}
                                </Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>

                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                          {nextProducerListing && (
                            <Link
                              href={`/listing/${nextProducerListing.escrowAddress}`}
                              style={{ textDecoration: "none" }}
                            >
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
                                {isJapanese ? "次の案件を開く" : "Open next listing"}
                              </Button>
                            </Link>
                          )}
                          <Link href="/" style={{ textDecoration: "none" }}>
                            <Button
                              variant="outlined"
                              sx={{
                                borderColor: "var(--color-border-strong)",
                                color: "var(--color-text-secondary)",
                                borderRadius: 2,
                              }}
                            >
                              {isJapanese ? "一覧を見る" : "Back to listings"}
                            </Button>
                          </Link>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, lg: 4 }}>
                    <Card
                      sx={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 3,
                        height: "100%",
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
                          {isJapanese ? "買い手としての軽い確認" : "Light buyer review"}
                        </Typography>
                        <Typography
                          sx={{
                            color: "var(--color-text-secondary)",
                            lineHeight: 1.7,
                            mb: 2.5,
                          }}
                        >
                          {isJapanese
                            ? "買い手側で確認が必要な案件だけを後から見返せます。生産者の導線が主役です。"
                            : "Buyer-side checks stay available for the few listings that need them. The producer flow remains primary."}
                        </Typography>
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            background: "var(--color-bg-elevated)",
                            border: "1px solid var(--color-border)",
                            mb: 2,
                          }}
                        >
                          <Typography
                            sx={{ fontSize: "0.75rem", color: "var(--color-text-muted)", mb: 0.75 }}
                          >
                            {isJapanese ? "買い手として要確認" : "Buyer reviews pending"}
                          </Typography>
                          <Typography
                            sx={{
                              fontFamily: "var(--font-display)",
                              fontWeight: 700,
                              fontSize: "1.6rem",
                              color: "var(--color-text)",
                            }}
                          >
                            {buyerPending}
                          </Typography>
                        </Box>
                        <Typography sx={{ color: "var(--color-text-muted)", mb: 1 }}>
                          {isJapanese ? "受け取り済み" : "Completed as buyer"}
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 600,
                            color: "var(--color-text)",
                            mb: 2.5,
                          }}
                        >
                          {stats.buyerCompleted}
                        </Typography>
                        <Typography sx={{ color: "var(--color-text-muted)", mb: 0.5 }}>
                          {isJapanese ? "総支払額" : "Total spent"}
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 600,
                            color: "var(--color-primary)",
                          }}
                        >
                          {formatAmount(stats.totalSpent, decimals, symbol)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Card
                  sx={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 3,
                  }}
                >
                  <Box sx={{ borderBottom: "1px solid var(--color-border)" }}>
                    <Tabs
                      value={activeTab}
                      onChange={(_, value) => {
                        setActiveTab(value);
                        setStatusFilter("all");
                      }}
                      sx={{
                        "& .MuiTabs-indicator": {
                          backgroundColor: "var(--color-primary)",
                        },
                        "& .MuiTab-root": {
                          color: "var(--color-text-muted)",
                          "&.Mui-selected": { color: "var(--color-primary)" },
                        },
                      }}
                    >
                      <Tab
                        value="producer"
                        icon={<StorefrontIcon />}
                        iconPosition="start"
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            {isJapanese ? "生産者として使う" : "Producer view"}
                            <Chip
                              label={asProducer.length}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: "0.75rem",
                                background: "var(--color-primary-surface)",
                                color: "var(--color-primary)",
                              }}
                            />
                          </Box>
                        }
                      />
                      <Tab
                        value="buyer"
                        icon={<ShoppingBagIcon />}
                        iconPosition="start"
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            {isJapanese ? "買い手として確認する" : "Buyer review"}
                            <Chip
                              label={asBuyer.length}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: "0.75rem",
                                background: "var(--color-primary-surface)",
                                color: "var(--color-primary)",
                              }}
                            />
                          </Box>
                        }
                      />
                    </Tabs>
                  </Box>

                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
                      {availableFilters.map((filter) => (
                        <Chip
                          key={filter.value}
                          label={`${filterLabels[filter.value][locale]} (${filter.count})`}
                          onClick={() => setStatusFilter(filter.value)}
                          variant={statusFilter === filter.value ? "filled" : "outlined"}
                          sx={{
                            borderColor: "var(--color-border-strong)",
                            color:
                              statusFilter === filter.value
                                ? "var(--sumi-black)"
                                : "var(--color-text-secondary)",
                            background:
                              statusFilter === filter.value
                                ? "var(--color-primary)"
                                : "transparent",
                            "&:hover": {
                              background:
                                statusFilter === filter.value
                                  ? "var(--color-primary)"
                                  : "var(--color-primary-surface)",
                            },
                          }}
                        />
                      ))}
                    </Box>

                    {isLoading && (
                      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress sx={{ color: "var(--color-primary)" }} />
                      </Box>
                    )}

                    {error && (
                      <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                        {error}
                      </Alert>
                    )}

                    {!isLoading && filteredListings.length > 0 && (
                      <Grid container spacing={3}>
                        {filteredListings.map((listing, index) => (
                          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={listing.escrowAddress}>
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.05 }}
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
                    )}

                    {!isLoading && filteredListings.length === 0 && (
                      <Box
                        sx={{
                          textAlign: "center",
                          py: 6,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        <Typography variant="h6" sx={{ mb: 1, color: "var(--color-text-secondary)" }}>
                          {activeTab === "producer"
                            ? isJapanese
                              ? "この条件に合う担当案件はありません"
                              : "No producer listings match this filter"
                            : isJapanese
                            ? "この条件に合う買い手側案件はありません"
                            : "No buyer listings match this filter"}
                        </Typography>
                        <Typography variant="body2">
                          {activeTab === "producer"
                            ? isJapanese
                              ? "支払い待ち、確認待ち、記録する案件を切り替えて確認できます。"
                              : "Switch between payment waiting, review waiting, and ready-to-record filters."
                            : isJapanese
                            ? "必要な確認が発生したときだけ、ここを見返せば十分です。"
                            : "Come back here only when a buyer-side confirmation is needed."}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>

                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ color: "var(--color-text-muted)", mb: 0.5 }}>
                    {isJapanese ? "生産者としての受取総額" : "Total received as producer"}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "1.5rem",
                      color: "var(--color-primary)",
                    }}
                  >
                    {formatAmount(stats.totalEarned, decimals, symbol)}
                  </Typography>
                </Box>
              </>
            )}
          </Container>
        </Box>

        <Footer />
      </div>
    </I18nContext.Provider>
  );
}
