"use client";

import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { HeroNFT } from "@/components";
import { formatAmount, shortenAddress } from "@/lib/hooks";
import { getAddressUrl, CATEGORY_LABELS, STATUS_LABELS } from "@/lib/config";
import type { Locale } from "@/lib/i18n";
import type { EscrowInfo } from "@/lib/types";
import type { Address } from "viem";

export interface ListingInfoCardProps {
  info: EscrowInfo;
  locale: Locale;
  decimals: number;
  symbol: string;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  escrowAddress: Address;
}

export function ListingInfoCard({
  info,
  locale,
  decimals,
  symbol,
  completedCount,
  totalCount,
  progressPercent,
  escrowAddress,
}: ListingInfoCardProps) {
  return (
    <>
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
            {locale === "ja" ? "取引証明書" : "Digital Certificate"}
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <div className="hero-nft-shell">
              <HeroNFT tokenId={Number(info.tokenId)} factoryAddress={info.factory} />
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

          {/* Addresses - Progressive Disclosure */}
          <Accordion
            sx={{
              background: "transparent",
              boxShadow: "none",
              border: "1px solid var(--color-border)",
              borderRadius: "8px !important",
              "&::before": { display: "none" },
              "&.Mui-expanded": { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: "var(--color-text-muted)" }} />}
              sx={{
                minHeight: 40,
                "& .MuiAccordionSummary-content": { margin: "8px 0" },
              }}
            >
              <Typography variant="caption" sx={{ color: "var(--color-text-muted)", fontWeight: 500 }}>
                {locale === "ja" ? "技術詳細" : "Technical Details"}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" sx={{ color: "var(--color-text-muted)" }}>
                    {locale === "ja" ? "生産者" : "Producer"}
                  </Typography>
                  <a
                    href={getAddressUrl(info.producer)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--color-primary)", fontSize: "0.85rem" }}
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
                      style={{ color: "var(--color-primary)", fontSize: "0.85rem" }}
                    >
                      {shortenAddress(info.buyer)}
                    </a>
                  </Box>
                )}
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" sx={{ color: "var(--color-text-muted)" }}>
                    {locale === "ja" ? "取引管理" : "Transaction"}
                  </Typography>
                  <a
                    href={getAddressUrl(escrowAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--color-primary)", fontSize: "0.85rem" }}
                  >
                    {shortenAddress(escrowAddress)}
                  </a>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </>
  );
}
