"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Button, Container, Typography } from "@mui/material";
import { useI18n } from "@/lib/i18n";

type FooterNavItem = {
  href: string;
  label: {
    ja: string;
    en: string;
  };
};

const baseNavItems: FooterNavItem[] = [
  {
    href: "/",
    label: {
      ja: "一覧",
      en: "Listings",
    },
  },
  {
    href: "/my",
    label: {
      ja: "マイページ",
      en: "My Page",
    },
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Footer() {
  const pathname = usePathname();
  const { locale } = useI18n();
  const isJapanese = locale === "ja";

  const navItems: FooterNavItem[] = [
    ...baseNavItems,
    ...(process.env.NEXT_PUBLIC_ENABLE_AGENT === "true"
      ? [
          {
            href: "/agent",
            label: {
              ja: "AIアシスタント",
              en: "AI Assistant",
            },
          },
        ]
      : []),
  ];

  return (
    <Box component="footer" className="footer content-layer">
      <Container maxWidth="lg">
        <Box className="footer-inner">
          <Box className="footer-brand-block">
            <Box
              component={Link}
              href="/"
              className="footer-brand-link"
              aria-label={isJapanese ? "ホームへ戻る" : "Back to home"}
            >
              <Box
                component="img"
                src="/jpyc-logo.png"
                alt="JPYC logo"
                className="footer-logo"
              />
              <Box className="footer-brand-copy">
                <Typography className="footer-title">palpay</Typography>
              </Box>
            </Box>

            <Typography className="footer-description">
              {isJapanese
                ? "進捗記録、確認待ち、次の支払い準備をひとつの画面で整理できる生産者向けワークスペースです。"
                : "A workspace that keeps progress records, review status, and the next payout step in one place."}
            </Typography>
          </Box>

          <Box className="footer-meta">
            <Box className="footer-nav">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Button
                    key={item.href}
                    component={Link}
                    href={item.href}
                    size="small"
                    disableElevation
                    sx={{
                      color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 2,
                      border: active
                        ? "1px solid var(--color-border-accent)"
                        : "1px solid transparent",
                      background: active
                        ? "rgba(212, 165, 116, 0.12)"
                        : "transparent",
                      minWidth: "auto",
                      "&:hover": {
                        color: "var(--color-primary)",
                        background: "rgba(212, 165, 116, 0.08)",
                        borderColor: "var(--color-border-accent)",
                      },
                    }}
                  >
                    {item.label[locale]}
                  </Button>
                );
              })}
            </Box>

            <Typography className="footer-copyright">
              © {new Date().getFullYear()} palpay
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
