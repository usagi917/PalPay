"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import type { Address } from "viem";
import { useI18n } from "@/lib/i18n";
import type { UserRole } from "@/lib/types";

interface ConnectWalletProps {
  address: Address | null;
  isConnecting: boolean;
  error: string | null;
  userRole: UserRole;
  onConnect: () => void;
  onDisconnect: () => void;
}

const buildIdenticonCells = (address: Address) => {
  const seed = address.toLowerCase().replace(/^0x/, "");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 5; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < 3; x += 1) {
      hash = (hash * 1103515245 + 12345) >>> 0;
      row.push((hash & 1) === 1);
    }
    const mirrored = row.slice(0, 2).reverse();
    const full = row.concat(mirrored);
    for (let x = 0; x < 5; x += 1) {
      if (full[x]) cells.push({ x, y });
    }
  }
  return cells;
};

const roleColors: Record<UserRole, { bg: string; color: string; border: string }> = {
  buyer: {
    bg: 'var(--color-buyer-surface)',
    color: 'var(--color-buyer)',
    border: 'rgba(107, 163, 214, 0.25)',
  },
  producer: {
    bg: 'var(--color-producer-surface)',
    color: 'var(--color-producer)',
    border: 'rgba(110, 191, 139, 0.25)',
  },
  none: {
    bg: 'var(--color-surface-hover)',
    color: 'var(--color-text-muted)',
    border: 'var(--color-border)',
  },
};

export function ConnectWallet({
  address,
  isConnecting,
  error,
  userRole,
  onConnect,
  onDisconnect,
}: ConnectWalletProps) {
  const { locale, t } = useI18n();

  const identiconCells = useMemo(
    () => (address ? buildIdenticonCells(address) : []),
    [address],
  );

  const shortenAddress = (addr: Address) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const roleConfig: Record<UserRole, string> = {
    buyer: t("buyer"),
    producer: t("producer"),
    none: t("observer"),
  };

  const roleLabel = roleConfig[userRole];
  const colors = roleColors[userRole];
  const isJapanese = locale === "ja";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card
        sx={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(247, 243, 235, 0.02) 0%, transparent 50%)',
            pointerEvents: 'none',
          },
        }}
      >
        <CardContent sx={{ p: 3, position: 'relative' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: 'var(--color-primary-surface)',
                border: '1px solid var(--color-border-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AccountCircleIcon sx={{ color: 'var(--color-primary)', fontSize: 20 }} />
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '1rem',
                color: 'var(--color-text)',
              }}
            >
              {t("wallet")}
            </Typography>
          </Box>

          <Typography
            sx={{
              fontSize: "0.9rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.7,
              mb: 2.5,
            }}
          >
            {address
              ? isJapanese
                ? "このアカウントで進捗記録、確認、受け取り状況をまとめて管理できます。"
                : "Use this account to record progress, review updates, and track payout status."
              : isJapanese
              ? "初回設定は付き添いで進められます。ログインすると、そのまま担当案件の記録と確認に進めます。"
              : "First-time setup can be assisted. After login, you can go straight into recording and reviewing assigned work."}
          </Typography>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Alert
                  severity="error"
                  sx={{
                    mb: 2,
                    background: 'var(--status-error-surface)',
                    color: 'var(--status-error)',
                    border: '1px solid rgba(214, 104, 83, 0.25)',
                    borderRadius: 2,
                    '& .MuiAlert-icon': { color: 'var(--status-error)' },
                  }}
                >
                  {error}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {address ? (
              <motion.div
                key="connected"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                {/* Connected Status */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    borderRadius: 2,
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    mb: 2,
                  }}
                >
                  {/* Identicon */}
                  <Box sx={{ position: 'relative' }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--copper-deep) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-copper)',
                      }}
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 5 5"
                        aria-hidden="true"
                      >
                        {identiconCells.map((cell, index) => (
                          <rect
                            key={`${cell.x}-${cell.y}-${index}`}
                            x={cell.x + 0.08}
                            y={cell.y + 0.08}
                            width={0.84}
                            height={0.84}
                            rx={0.15}
                            fill="var(--sumi-black)"
                          />
                        ))}
                      </svg>
                    </Box>
                    {/* Online indicator */}
                    <Box
                      component={motion.div}
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      sx={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'var(--status-success)',
                        border: '3px solid var(--color-surface)',
                        boxShadow: '0 0 8px rgba(110, 191, 139, 0.4)',
                      }}
                    />
                  </Box>

                  {/* Address & Role */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        mb: 0.5,
                      }}
                    >
                      {isJapanese ? "アカウントID" : "Account ID"}: {shortenAddress(address)}
                    </Typography>
                    <Chip
                      label={roleLabel}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: colors.bg,
                        color: colors.color,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 1,
                      }}
                    />
                  </Box>
                </Box>

                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    color: "var(--color-text-muted)",
                    mb: 2,
                    lineHeight: 1.6,
                  }}
                >
                  {isJapanese
                    ? "現地サポートと一緒に使う前提でも問題ありません。普段どおりの業務を止めずに記録できます。"
                    : "It is fine to use this with on-site support. The goal is to keep everyday operations moving without extra friction."}
                </Typography>

                {/* Disconnect Button */}
                <Button
                  onClick={onDisconnect}
                  fullWidth
                  variant="outlined"
                  startIcon={<LogoutIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    borderColor: 'var(--color-border-strong)',
                    color: 'var(--color-text-secondary)',
                    py: 1.25,
                    borderRadius: 2,
                    '&:hover': {
                      borderColor: 'var(--status-error)',
                      color: 'var(--status-error)',
                      background: 'var(--status-error-surface)',
                    },
                  }}
                >
                  {t("disconnect")}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="disconnected"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <Button
                  onClick={onConnect}
                  disabled={isConnecting}
                  fullWidth
                  variant="contained"
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)',
                    color: 'var(--sumi-black)',
                    fontWeight: 600,
                    borderRadius: 2,
                    boxShadow: 'var(--shadow-subtle), var(--shadow-copper)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--copper-deep) 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: 'var(--shadow-medium), 0 0 40px var(--copper-glow)',
                    },
                    '&:disabled': {
                      background: 'var(--color-surface-hover)',
                      color: 'var(--color-text-muted)',
                      boxShadow: 'none',
                    },
                  }}
                  startIcon={
                    isConnecting ? (
                      <CircularProgress size={18} sx={{ color: 'inherit' }} />
                    ) : (
                      <AccountCircleIcon sx={{ fontSize: 20 }} />
                    )
                  }
                >
                  {isConnecting ? t("connecting") : t("connectWallet")}
                </Button>
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mt: 1.5,
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {isJapanese
                    ? "ウォレット接続が難しい場合でも、初回だけ一緒に設定すれば次回からはそのまま使えます。"
                    : "If wallet setup feels unfamiliar, assist the first login once and the same flow should work afterward."}
                </Typography>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
