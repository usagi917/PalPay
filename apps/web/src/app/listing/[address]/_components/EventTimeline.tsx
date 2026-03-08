"use client";

import { Box, Typography, Card, CardContent } from "@mui/material";
import { formatAmount } from "@/lib/hooks";
import { getTxUrl } from "@/lib/config";
import type { Locale } from "@/lib/i18n";
import type { Milestone, TimelineEvent } from "@/lib/types";

export interface EventTimelineProps {
  events: TimelineEvent[];
  milestones: Milestone[];
  locale: Locale;
  decimals: number;
  symbol: string;
}

export function EventTimeline({
  events,
  milestones,
  locale,
  decimals,
  symbol,
}: EventTimelineProps) {
  if (events.length === 0) return null;

  return (
    <Card
      sx={{
        mt: 3,
        background: "var(--color-surface)",
        backdropFilter: "blur(20px)",
        border: "1px solid var(--color-border)",
        borderRadius: 3,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography
          variant="h6"
          sx={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-text)", mb: 3 }}
        >
          {locale === "ja" ? "取引履歴" : "Transaction History"}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {events.map((event, index) => {
            const milestoneName =
              event.type === "Completed" && event.index !== undefined
                ? milestones[Number(event.index)]?.name
                : undefined;

            const getEventLabel = () => {
              switch (event.type) {
                case "Locked":
                  return locale === "ja" ? "お支払い" : "Payment";
                case "Approved":
                  return locale === "ja" ? "取引開始" : "Transaction Started";
                case "Cancelled":
                  return locale === "ja" ? "キャンセル・返金" : "Cancelled & Refunded";
                case "ActivatedAfterTimeout":
                  return locale === "ja" ? "期限後に取引開始" : "Activated After Timeout";
                case "FinalDeliveryRequested":
                  return locale === "ja" ? "最終納品申請" : "Final Delivery Requested";
                case "DeliveryConfirmed":
                  return locale === "ja" ? "受取確認・取引完了" : "Receipt Confirmed";
                case "FinalizedAfterTimeout":
                  return locale === "ja" ? "期限後に最終確定" : "Finalized After Timeout";
                case "Completed":
                  return milestoneName ||
                    (event.index !== undefined
                      ? `Milestone #${event.index}`
                      : locale === "ja"
                        ? "マイルストーン"
                        : "Milestone");
                default:
                  return event.type;
              }
            };

            return (
              <Box
                key={index}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  p: 1.5,
                  borderRadius: 2,
                  background: "rgba(247, 243, 235, 0.02)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <Box>
                  <Typography sx={{ color: "var(--color-text)", fontWeight: 500 }}>
                    {getEventLabel()}
                  </Typography>
                  {event.amount && (
                    <Typography variant="caption" sx={{ color: "var(--color-text-muted)" }}>
                      {formatAmount(event.amount, decimals, symbol)}
                    </Typography>
                  )}
                  {event.deadline && (
                    <Typography variant="caption" sx={{ display: "block", color: "var(--color-text-muted)" }}>
                      {locale === "ja"
                        ? `期限: ${new Date(Number(event.deadline) * 1000).toLocaleString("ja-JP")}`
                        : `Deadline: ${new Date(Number(event.deadline) * 1000).toLocaleString("en-US")}`}
                    </Typography>
                  )}
                </Box>
                <a
                  href={getTxUrl(event.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-primary)", fontSize: "0.85rem" }}
                >
                  {locale === "ja" ? "詳細" : "Details"}
                </a>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}
