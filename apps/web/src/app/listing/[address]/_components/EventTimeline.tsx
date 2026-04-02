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

  const isJapanese = locale === "ja";
  const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const dateTimeFormatter = new Intl.DateTimeFormat(isJapanese ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const formatEventDateTime = (timestampSec: number | bigint) =>
    dateTimeFormatter.format(new Date(Number(timestampSec) * 1000));

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
          {isJapanese ? "記録と確認の履歴" : "Proof history"}
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
                  return isJapanese ? "支払い準備が完了" : "Payment secured";
                case "Approved":
                  return isJapanese ? "取引開始" : "Work started";
                case "Cancelled":
                  return isJapanese ? "キャンセルと返金" : "Cancelled and refunded";
                case "ActivatedAfterTimeout":
                  return isJapanese ? "期限後に取引開始" : "Started after timeout";
                case "FinalDeliveryRequested":
                  return isJapanese ? "受け渡し完了の連絡" : "Final handoff requested";
                case "DeliveryConfirmed":
                  return isJapanese ? "受け取り確認" : "Receipt confirmed";
                case "FinalizedAfterTimeout":
                  return isJapanese ? "期限後に完了" : "Completed after timeout";
                case "Completed":
                  if (milestoneName) {
                    return isJapanese ? `${milestoneName} を記録` : `${milestoneName} recorded`;
                  }
                  return event.index !== undefined
                    ? `Milestone #${event.index}`
                    : isJapanese
                    ? "工程を記録"
                    : "Progress recorded";
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
                  gap: 2,
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
                  {event.evidenceHash && event.evidenceHash !== zeroHash && (
                    <Typography
                      variant="caption"
                      sx={{ display: "block", color: "var(--color-text-muted)" }}
                    >
                      {isJapanese ? "補足あり" : "Supporting proof attached"}:{" "}
                      {`${event.evidenceHash.slice(0, 10)}...${event.evidenceHash.slice(-6)}`}
                    </Typography>
                  )}
                  {event.timestamp && (
                    <Typography
                      variant="caption"
                      sx={{ display: "block", color: "var(--color-text-muted)" }}
                    >
                      {formatEventDateTime(event.timestamp)}
                    </Typography>
                  )}
                  {event.deadline && (
                    <Typography variant="caption" sx={{ display: "block", color: "var(--color-text-muted)" }}>
                      {isJapanese
                        ? `期限: ${formatEventDateTime(event.deadline)}`
                        : `Deadline: ${formatEventDateTime(event.deadline)}`}
                    </Typography>
                  )}
                </Box>
                <a
                  href={getTxUrl(event.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-primary)", fontSize: "0.85rem" }}
                >
                  {isJapanese ? "チェーン記録" : "On-chain record"}
                </a>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}
