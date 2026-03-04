"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AppBar, Toolbar, Box, Typography, ToggleButtonGroup, ToggleButton, Container, Button } from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useI18n, type Locale } from "@/lib/i18n";

interface HeaderProps {
  onLocaleChange: (locale: Locale) => void;
}

export function Header({ onLocaleChange }: HeaderProps) {
  const { locale, t } = useI18n();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      className="header"
      sx={{
        background: 'rgba(10, 22, 40, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar
          disableGutters
          sx={{
            minHeight: { xs: 64, sm: 72 },
            justifyContent: 'space-between',
          }}
        >
          {/* Logo & Title */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href="/"
              aria-label={locale === "ja" ? "ホームへ戻る" : "Back to home"}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  cursor: "pointer",
                }}
              >
                <Box
                  component="img"
                  src="/jpyc-logo.png"
                  alt="JPYC logo"
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid var(--color-border-accent)',
                    boxShadow: 'var(--shadow-subtle)',
                  }}
                />
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      fontSize: { xs: '1rem', sm: '1.125rem' },
                      color: 'var(--color-text)',
                      letterSpacing: '0.02em',
                      lineHeight: 1.2,
                    }}
                  >
                    {t("appTitle")}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-primary)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      display: { xs: 'none', sm: 'block' },
                    }}
                  >
                    {t("appSubtitle")}
                  </Typography>
                </Box>
              </Box>
            </Link>
          </motion.div>

          {/* Right side: My Page + Language Switcher */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
              {/* Agent Chat Link */}
              {process.env.NEXT_PUBLIC_ENABLE_AGENT !== 'false' && (
              <Link href="/agent" style={{ textDecoration: 'none' }}>
                <Button
                  size="small"
                  startIcon={<SmartToyIcon />}
                  sx={{
                    color: 'var(--color-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    border: '1px solid var(--color-border-accent)',
                    background: 'rgba(212, 165, 116, 0.08)',
                    minWidth: 'auto',
                    '& .MuiButton-startIcon': {
                      mr: { xs: 0, sm: 1 },
                    },
                    '&:hover': {
                      color: 'var(--color-primary)',
                      background: 'rgba(212, 165, 116, 0.15)',
                      borderColor: 'var(--color-primary)',
                    },
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    {locale === 'ja' ? 'AIアシスタント' : 'AI Assistant'}
                  </Box>
                </Button>
              </Link>
              )}

              {/* My Page Link */}
              <Link href="/my" style={{ textDecoration: 'none' }}>
                <Button
                  size="small"
                  startIcon={<AccountCircleIcon />}
                  sx={{
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    border: '1px solid transparent',
                    minWidth: 'auto',
                    '& .MuiButton-startIcon': {
                      mr: { xs: 0, sm: 1 },
                    },
                    '&:hover': {
                      color: 'var(--color-primary)',
                      background: 'rgba(212, 165, 116, 0.08)',
                      borderColor: 'var(--color-border-accent)',
                    },
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    {locale === 'ja' ? 'マイページ' : 'My Page'}
                  </Box>
                </Button>
              </Link>

              {/* Language Switcher */}
              <ToggleButtonGroup
              value={locale}
              exclusive
              onChange={(_, newLocale) => newLocale && onLocaleChange(newLocale)}
              size="small"
              sx={{
                background: 'rgba(45, 62, 95, 0.5)',
                borderRadius: 2,
                p: 0.5,
                gap: 0.5,
                '& .MuiToggleButtonGroup-grouped': {
                  margin: 0,
                  border: 'none',
                  borderRadius: '6px !important',
                },
                '& .MuiToggleButton-root': {
                  color: 'var(--color-text-secondary)',
                  border: 'none',
                  px: 2,
                  py: 0.75,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  transition: 'all 200ms ease',
                  '&:hover': {
                    background: 'rgba(212, 165, 116, 0.08)',
                    color: 'var(--color-primary)',
                  },
                  '&.Mui-selected': {
                    background: 'rgba(212, 165, 116, 0.15)',
                    color: 'var(--color-primary)',
                    '&:hover': {
                      background: 'rgba(212, 165, 116, 0.2)',
                    },
                  },
                },
              }}
            >
              <ToggleButton value="ja">JP</ToggleButton>
              <ToggleButton value="en">EN</ToggleButton>
            </ToggleButtonGroup>
            </Box>
          </motion.div>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
