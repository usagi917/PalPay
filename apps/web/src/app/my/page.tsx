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
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import { Header, ConnectWallet, ListingCard } from "@/components";
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

  // Filter listings based on tab and status
  const filteredListings = useMemo(() => {
    const listings = activeTab === "producer" ? asProducer : asBuyer;
    if (statusFilter === "all") return listings;
    return listings.filter((l) => l.status === statusFilter);
  }, [activeTab, asProducer, asBuyer, statusFilter]);

  // Available status filters per tab (V6: added locked)
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

  const filterLabels: Record<StatusFilter, { ja: string; en: string }> = {
    all: { ja: "すべて", en: "All" },
    open: { ja: "購入受付中", en: "Available" },
    locked: { ja: "条件確認中", en: "Under Review" },
    active: { ja: "進行中", en: "In Progress" },
    completed: { ja: "取引完了", en: "Completed" },
  };

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
            {/* Back button */}
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
                  {locale === "ja" ? "一覧に戻る" : "Back to Listings"}
                </Box>
              </Link>
            </Box>

            {/* Page Title */}
            <Typography
              variant="h4"
              sx={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--color-text)",
                mb: 3,
              }}
            >
              {locale === "ja" ? "マイページ" : "My Page"}
            </Typography>

            {/* Wallet */}
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

            {/* Not connected state */}
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
                    {locale === "ja"
                      ? "ログインしてマイページを表示"
                      : "Log in to view your page"}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* Connected state */}
            {wallet.address && (
              <>
                {/* Stats Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  {/* Producer Stats */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Card
                      sx={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 3,
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                          <StorefrontIcon sx={{ color: "var(--color-primary)" }} />
                          <Typography
                            variant="h6"
                            sx={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-text)" }}
                          >
                            {locale === "ja" ? "出品" : "As Producer"}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                          <Typography sx={{ color: "var(--color-text-muted)" }}>
                            {locale === "ja" ? "総出品数" : "Total Listings"}
                          </Typography>
                          <Typography sx={{ color: "var(--color-text)", fontWeight: 600 }}>
                            {stats.totalProduced}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                          <Typography sx={{ color: "var(--color-text-muted)" }}>
                            {locale === "ja" ? "条件確認中" : "Under Review"}
                          </Typography>
                          <Typography sx={{ color: "var(--status-warning)", fontWeight: 500 }}>
                            {stats.producerLocked}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                          <Typography sx={{ color: "var(--color-text-muted)" }}>
                            {locale === "ja" ? "進行中" : "Active"}
                          </Typography>
                          <Typography sx={{ color: "var(--status-info)", fontWeight: 500 }}>
                            {stats.producerActive}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography sx={{ color: "var(--color-text-muted)" }}>
                            {locale === "ja" ? "総収益" : "Total Earned"}
                          </Typography>
                          <Typography sx={{ color: "var(--status-success)", fontWeight: 600 }}>
                            {formatAmount(stats.totalEarned, decimals, symbol)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Buyer Stats */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Card
                      sx={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 3,
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                          <ShoppingBagIcon sx={{ color: "var(--copper-rich)" }} />
                          <Typography
                            variant="h6"
                            sx={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-text)" }}
                          >
                            {locale === "ja" ? "購入" : "As Buyer"}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                          <Typography sx={{ color: "var(--color-text-muted)" }}>
                            {locale === "ja" ? "総購入数" : "Total Purchases"}
                          </Typography>
                          <Typography sx={{ color: "var(--color-text)", fontWeight: 600 }}>
                            {stats.totalBought}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                          <Typography sx={{ color: "var(--color-text-muted)" }}>
                            {locale === "ja" ? "条件確認中" : "Under Review"}
                          </Typography>
                          <Typography sx={{ color: "var(--status-warning)", fontWeight: 500 }}>
                            {stats.buyerLocked}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                          <Typography sx={{ color: "var(--color-text-muted)" }}>
                            {locale === "ja" ? "進行中" : "Active"}
                          </Typography>
                          <Typography sx={{ color: "var(--status-info)", fontWeight: 500 }}>
                            {stats.buyerActive}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography sx={{ color: "var(--color-text-muted)" }}>
                            {locale === "ja" ? "総支払額" : "Total Spent"}
                          </Typography>
                          <Typography sx={{ color: "var(--color-text)", fontWeight: 600 }}>
                            {formatAmount(stats.totalSpent, decimals, symbol)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Tabs */}
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
                      onChange={(_, v) => {
                        setActiveTab(v);
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
                            {locale === "ja" ? "出品した商品" : "My Listings"}
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
                            {locale === "ja" ? "購入した商品" : "My Purchases"}
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
                    {/* Status Filters */}
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

                    {/* Loading */}
                    {isLoading && (
                      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress sx={{ color: "var(--color-primary)" }} />
                      </Box>
                    )}

                    {/* Error */}
                    {error && (
                      <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                        {error}
                      </Alert>
                    )}

                    {/* Listings Grid */}
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

                    {/* Empty State */}
                    {!isLoading && filteredListings.length === 0 && (
                      <Box
                        sx={{
                          textAlign: "center",
                          py: 6,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          {activeTab === "producer"
                            ? locale === "ja"
                              ? "出品がありません"
                              : "No listings yet"
                            : locale === "ja"
                            ? "購入履歴がありません"
                            : "No purchases yet"}
                        </Typography>
                        <Typography variant="body2">
                          {activeTab === "producer"
                            ? locale === "ja"
                              ? "新規出品を作成してみましょう"
                              : "Create a new listing to get started"
                            : locale === "ja"
                            ? "商品を購入すると履歴が表示されます"
                            : "Your purchases will appear here"}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </Container>
        </Box>
      </div>
    </I18nContext.Provider>
  );
}
