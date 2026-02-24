"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Box, Container, Typography, Grid, CircularProgress, Alert } from "@mui/material";
import {
  Header,
  ConnectWallet,
  ListingCard,
  CreateListingForm,
} from "@/components";
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

  // Filter listings by status
  const openListings = summaries.filter((s) => s.status === "open");
  const activeListings = summaries.filter((s) => s.status === "active");
  const completedListings = summaries.filter((s) => s.status === "completed");

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
                    maxWidth: 540,
                    mx: "auto",
                    lineHeight: 1.7,
                  }}
                >
                  {t("appSubtitle")}
                </Typography>
              </motion.div>
            </Box>

            {/* Wallet & Create */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  gap: 3,
                  mb: 5,
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <ConnectWallet
                    address={wallet.address}
                    isConnecting={wallet.isConnecting}
                    error={wallet.error}
                    userRole="none"
                    onConnect={wallet.connect}
                    onDisconnect={wallet.disconnect}
                  />
                </Box>
                {wallet.address && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <CreateListingForm onSuccess={handleListingCreated} />
                  </motion.div>
                )}
              </Box>
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
                    {locale === "ja" ? "購入受付中" : "Available"}
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
                    {locale === "ja" ? "進行中" : "Active Listings"}
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
                    {locale === "ja" ? "完了" : "Completed"}
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
                    ? "ログインして最初の出品を作成しましょう"
                    : "Log in and create the first listing"}
                </Typography>
              </Box>
            )}
          </Container>
        </Box>

        {/* Footer */}
        <Box
          component="footer"
          className="footer content-layer"
          sx={{
            borderTop: "1px solid var(--color-border)",
            py: 3,
            mt: 4,
          }}
        >
          <Container maxWidth="lg">
            <Box
              className="footer-inner"
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "center", sm: "center" },
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Box className="footer-brand" sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box
                  component="img"
                  src="/jpyc-logo.png"
                  alt="JPYC logo"
                  className="footer-logo"
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1px solid var(--color-border)",
                  }}
                />
                <Box>
                  <Typography
                    className="footer-title"
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {t("appTitle")}
                  </Typography>
                  <Typography
                    className="footer-subtitle"
                    sx={{
                      fontSize: "0.6875rem",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {t("appSubtitle")}
                  </Typography>
                </Box>
              </Box>
              <Typography
                className="footer-copyright"
                sx={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-muted)",
                }}
              >
                © {new Date().getFullYear()} {t("appTitle")}
              </Typography>
            </Box>
          </Container>
        </Box>
      </div>
    </I18nContext.Provider>
  );
}
