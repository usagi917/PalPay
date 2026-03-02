"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography, CircularProgress, Alert, Link, Collapse } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { motion, AnimatePresence } from "framer-motion";
import type { TxStep } from "@/lib/hooks";
import { getTxUrl } from "@/lib/config";
import { useI18n } from "@/lib/i18n";

interface TxProgressProps {
  step: TxStep;
  txHash?: string | null;
  error?: string | null;
  onClose?: () => void;
}

const stepMessages = {
  ja: {
    idle: "",
    checking: "お支払い準備を確認中...",
    approving: "お支払いの確認をお願いします...",
    "approve-confirming": "支払い準備を処理中...",
    signing: "操作の確認をお願いします...",
    confirming: "処理中...",
    success: "完了しました",
    error: "エラーが発生しました",
  },
  en: {
    idle: "",
    checking: "Checking payment readiness...",
    approving: "Please confirm payment...",
    "approve-confirming": "Processing payment preparation...",
    signing: "Please confirm the action...",
    confirming: "Processing...",
    success: "Completed successfully",
    error: "An error occurred",
  },
};

// Map each step to a stepper phase (0, 1, 2)
function getStepperPhase(step: TxStep): number {
  if (["checking", "approving", "approve-confirming"].includes(step)) return 0;
  if (["signing", "confirming"].includes(step)) return 1;
  if (step === "success") return 2;
  return -1;
}

const stepperLabels = {
  ja: ["準備", "確認", "完了"],
  en: ["Prepare", "Confirm", "Done"],
};

export function TxProgress({ step, txHash, error, onClose }: TxProgressProps) {
  const { locale } = useI18n();
  const messages = stepMessages[locale];
  const [detailOpen, setDetailOpen] = useState(false);
  const lastPhaseRef = useRef(-1);

  const isProcessing = ["checking", "approving", "approve-confirming", "signing", "confirming"].includes(step);
  const isSuccess = step === "success";
  const isError = step === "error";
  const currentPhase = getStepperPhase(step);
  const labels = stepperLabels[locale];

  // Track the last known good phase for error display
  if (currentPhase >= 0) {
    lastPhaseRef.current = currentPhase;
  }
  const displayPhase = isError ? lastPhaseRef.current : currentPhase;

  // Auto-expand txHash details on error
  useEffect(() => {
    if (isError && txHash) {
      setDetailOpen(true);
    }
  }, [isError, txHash]);

  if (step === "idle") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <Alert
          severity={isSuccess ? "success" : isError ? "error" : "info"}
          icon={
            isProcessing ? (
              <CircularProgress size={20} sx={{ color: "inherit" }} />
            ) : isSuccess ? (
              <CheckCircleIcon />
            ) : isError ? (
              <ErrorIcon />
            ) : undefined
          }
          onClose={isSuccess || isError ? onClose : undefined}
          sx={{
            borderRadius: 2,
            mb: 2,
            background: isSuccess
              ? "var(--status-success-surface)"
              : isError
              ? "var(--status-error-surface)"
              : "var(--status-info-surface)",
            color: isSuccess
              ? "var(--status-success)"
              : isError
              ? "var(--status-error)"
              : "var(--status-info)",
            border: `1px solid ${
              isSuccess
                ? "rgba(110, 191, 139, 0.25)"
                : isError
                ? "rgba(214, 104, 83, 0.25)"
                : "rgba(107, 157, 196, 0.25)"
            }`,
            "& .MuiAlert-icon": {
              color: "inherit",
            },
          }}
        >
          <Box>
            {/* 3-Step Progress Indicator */}
            {(isProcessing || isSuccess || (isError && displayPhase >= 0)) && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                {labels.map((label, i) => {
                  const phaseForDisplay = isError ? displayPhase : currentPhase;
                  const isFailedPhase = isError && i === displayPhase;
                  return (
                    <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          transition: "all 0.3s ease",
                          ...(isFailedPhase
                            ? {
                                border: "2px solid var(--status-error)",
                                color: "var(--status-error)",
                              }
                            : i < phaseForDisplay
                            ? {
                                background: "currentColor",
                                color: "inherit",
                                "& span": { color: isSuccess ? "var(--status-success-surface)" : isError ? "var(--status-error-surface)" : "var(--status-info-surface)" },
                              }
                            : i === phaseForDisplay
                            ? {
                                border: "2px solid currentColor",
                                color: "inherit",
                              }
                            : {
                                border: "1.5px solid currentColor",
                                opacity: 0.35,
                              }),
                        }}
                      >
                        {isFailedPhase ? (
                          <ErrorIcon sx={{ fontSize: 14, color: "var(--status-error)" }} />
                        ) : i < phaseForDisplay ? (
                          <CheckCircleIcon sx={{ fontSize: 14, color: isSuccess ? "var(--status-success-surface)" : isError ? "var(--status-error-surface)" : "var(--status-info-surface)" }} />
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </Box>
                      <Typography
                        sx={{
                          fontSize: "0.65rem",
                          fontWeight: i === phaseForDisplay ? 600 : 400,
                          opacity: i > phaseForDisplay ? 0.4 : 1,
                          mr: i < labels.length - 1 ? 0.5 : 0,
                        }}
                      >
                        {label}
                      </Typography>
                      {i < labels.length - 1 && (
                        <Box
                          sx={{
                            width: 16,
                            height: 1.5,
                            background: "currentColor",
                            opacity: i < phaseForDisplay ? 0.6 : 0.2,
                          }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}

            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {isError && error ? error : messages[step]}
            </Typography>

            {/* Progressive disclosure for txHash */}
            {txHash && (
              <Box sx={{ mt: 1 }}>
                <Box
                  onClick={() => setDetailOpen(!detailOpen)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    opacity: 0.8,
                    "&:hover": { opacity: 1 },
                  }}
                >
                  <ExpandMoreIcon
                    sx={{
                      fontSize: 16,
                      transform: detailOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  />
                  {locale === "ja" ? "処理の詳細" : "Processing Details"}
                </Box>
                <Collapse in={detailOpen}>
                  <Box sx={{ mt: 0.5, pl: 2.5 }}>
                    <Link
                      href={getTxUrl(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: "inherit",
                        fontSize: "0.75rem",
                        opacity: 0.9,
                        "&:hover": { opacity: 1 },
                      }}
                    >
                      {locale === "ja" ? "受付番号" : "Receipt No."}: {txHash.slice(0, 10)}...{txHash.slice(-8)} →
                    </Link>
                  </Box>
                </Collapse>
              </Box>
            )}
          </Box>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}
