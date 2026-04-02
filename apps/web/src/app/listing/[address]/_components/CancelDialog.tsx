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
        {locale === "ja" ? "今回は見送りますか？" : "Stop this listing for now?"}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: "var(--color-text-secondary)" }}>
          {locale === "ja"
            ? "キャンセルすると全額返金され、この案件は生産者側に戻ります。"
            : "Cancelling will refund the full amount and move the listing back to the producer side."}
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
          {locale === "ja" ? "返金して終了" : "Refund and stop"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
