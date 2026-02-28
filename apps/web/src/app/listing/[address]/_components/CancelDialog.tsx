"use client";

import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import type { Locale } from "@/lib/i18n";

export interface CancelDialogProps {
  open: boolean;
  locale: Locale;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelDialog({ open, locale, onClose, onConfirm }: CancelDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ color: "var(--color-text)" }}>
        {locale === "ja" ? "購入をキャンセルしますか？" : "Cancel this purchase?"}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: "var(--color-text-secondary)" }}>
          {locale === "ja"
            ? "キャンセルすると全額返金され、NFTは出品者に戻ります。"
            : "Cancelling will refund the full amount and return the NFT to the producer."}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={onClose}
          sx={{ color: "var(--color-text-muted)" }}
        >
          {locale === "ja" ? "戻る" : "Go Back"}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{
            background: "var(--status-error)",
            color: "white",
            "&:hover": {
              background: "#c0392b",
            },
          }}
        >
          {locale === "ja" ? "キャンセルして返金" : "Yes, Cancel & Refund"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
