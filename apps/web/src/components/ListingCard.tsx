"use client";

import { Box, Typography, Chip } from "@mui/material";
import { motion } from "framer-motion";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { formatAmount, shortenAddress } from "@/lib/hooks";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/config";
import type { ListingSummary } from "@/lib/types";

interface ListingCardProps {
  listing: ListingSummary;
  tokenSymbol: string;
  tokenDecimals: number;
}

export function ListingCard({ listing, tokenSymbol, tokenDecimals }: ListingCardProps) {
  const { locale } = useI18n();

  const categoryLabel = CATEGORY_LABELS[listing.category]?.[locale] || listing.category;
  const statusConfig = STATUS_LABELS[listing.status] || STATUS_LABELS.open;
  const statusLabel = statusConfig[locale];

  const progressPercent = listing.progress.total > 0
    ? (listing.progress.completed / listing.progress.total) * 100
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/listing/${listing.escrowAddress}`} style={{ textDecoration: "none" }}>
        <Box
          className="listing-card"
          sx={{
            display: "flex",
            flexDirection: "column",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 3,
            overflow: "hidden",
            cursor: "pointer",
            transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            "&:hover": {
              borderColor: "var(--color-border-accent)",
              transform: "translateY(-4px)",
              boxShadow: "var(--shadow-medium), var(--shadow-copper)",
            },
            "&:hover .listing-card-image img": {
              transform: "scale(1.05)",
            },
            "&:hover .listing-card-overlay": {
              opacity: 1,
            },
          }}
        >
          {/* Image */}
          <Box
            className="listing-card-image"
            sx={{
              aspectRatio: "4 / 3",
              overflow: "hidden",
              background: "var(--color-bg-elevated)",
              position: "relative",
            }}
          >
            {listing.imageURI ? (
              <Box
                component="img"
                src={listing.imageURI}
                alt={listing.title}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, var(--color-bg-elevated) 0%, var(--color-surface-hover) 100%)",
                }}
              >
                <Typography
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: "3rem",
                    color: "var(--color-text-muted)",
                    opacity: 0.3,
                  }}
                >
                  {listing.category === "wagyu" ? "牛" : listing.category === "sake" ? "酒" : "匠"}
                </Typography>
              </Box>
            )}
            {/* Gradient overlay */}
            <Box
              className="listing-card-overlay"
              sx={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, transparent 40%, rgba(10, 22, 40, 0.9) 100%)",
                opacity: 0,
                transition: "opacity 300ms ease",
              }}
            />
          </Box>

          {/* Content */}
          <Box
            sx={{
              p: 2.5,
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Badges */}
            <Box sx={{ display: "flex", gap: 0.75, mb: 1.5 }}>
              <Chip
                label={categoryLabel}
                size="small"
                sx={{
                  background: "var(--color-primary-surface)",
                  color: "var(--color-primary)",
                  border: "1px solid var(--color-border-accent)",
                  fontWeight: 600,
                  fontSize: "0.625rem",
                  height: 24,
                  borderRadius: 1,
                }}
              />
              <Chip
                label={statusLabel}
                size="small"
                color={statusConfig.color as "success" | "info" | "default"}
                sx={{
                  fontSize: "0.625rem",
                  height: 24,
                  borderRadius: 1,
                }}
              />
            </Box>

            {/* Title */}
            <Typography
              sx={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "1.125rem",
                color: "var(--color-text)",
                mb: 0.75,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.3,
              }}
            >
              {listing.title}
            </Typography>

            {/* Description */}
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: "var(--color-text-secondary)",
                mb: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                lineHeight: 1.55,
                minHeight: "2.7em",
                flex: 1,
              }}
            >
              {listing.description}
            </Typography>

            {/* Footer */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                pt: 2,
                borderTop: "1px solid var(--color-border)",
              }}
            >
              {/* Price */}
              <Box>
                <Typography
                  sx={{
                    fontSize: "0.6875rem",
                    color: "var(--color-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                    mb: 0.25,
                  }}
                >
                  {locale === "ja" ? "価格" : "Price"}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "1.25rem",
                    color: "var(--color-primary)",
                    lineHeight: 1,
                  }}
                >
                  {formatAmount(listing.totalAmount, tokenDecimals, tokenSymbol)}
                </Typography>
              </Box>

              {/* Progress */}
              <Box sx={{ textAlign: "right" }}>
                <Typography
                  sx={{
                    fontSize: "0.6875rem",
                    color: "var(--color-text-muted)",
                    mb: 0.5,
                  }}
                >
                  {listing.progress.completed}/{listing.progress.total}
                </Typography>
                <Box
                  sx={{
                    width: 80,
                    height: 3,
                    background: "var(--color-border)",
                    borderRadius: "9999px",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      width: `${progressPercent}%`,
                      height: "100%",
                      background: "var(--color-primary)",
                      borderRadius: "9999px",
                      transition: "width 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Producer */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mt: 1.5,
                pt: 1.5,
                borderTop: "1px solid var(--color-divider)",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 500,
                }}
              >
                {locale === "ja" ? "生産者" : "Producer"}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                {shortenAddress(listing.producer)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Link>
    </motion.div>
  );
}
