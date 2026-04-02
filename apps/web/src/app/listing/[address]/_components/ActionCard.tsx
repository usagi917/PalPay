"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Collapse,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaymentIcon from "@mui/icons-material/Payment";
import SendIcon from "@mui/icons-material/Send";
import CancelIcon from "@mui/icons-material/Cancel";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { TxProgress } from "@/components";
import { formatAmount } from "@/lib/hooks";
import type { TxStep } from "@/lib/hooks";
import type { Locale } from "@/lib/i18n";
import type { EscrowInfo, Milestone, UserRole } from "@/lib/types";
import type { Hash } from "viem";

export interface ActionCardProps {
  info: EscrowInfo;
  locale: Locale;
  decimals: number;
  symbol: string;
  userRole: UserRole;
  txStep: TxStep;
  txHash: Hash | null;
  actionLoading: boolean;
  actionError: string | null;
  resetState: () => void;
  purchaseValidation: { balance: bigint; hasEnoughBalance: boolean };
  milestones: Milestone[];
  milestonesLoading: boolean;
  nextMilestoneIndex: number;
  onLock: () => void;
  onSubmit: (index: number, evidenceHash?: string) => void | Promise<void>;
  onApprove: () => void;
  onActivateAfterTimeout: () => void;
  onCancel: () => void;
  onRequestFinalDelivery: (evidenceHash?: string) => void | Promise<void>;
  onConfirmDelivery: () => void;
  onFinalizeAfterTimeout: () => void;
}

export function ActionCard({
  info,
  locale,
  decimals,
  symbol,
  userRole,
  txStep,
  txHash,
  actionLoading,
  actionError,
  resetState,
  purchaseValidation,
  milestones,
  milestonesLoading,
  nextMilestoneIndex,
  onLock,
  onSubmit,
  onApprove,
  onActivateAfterTimeout,
  onCancel,
  onRequestFinalDelivery,
  onConfirmDelivery,
  onFinalizeAfterTimeout,
}: ActionCardProps) {
  const isJapanese = locale === "ja";
  const milestoneInBounds = nextMilestoneIndex >= 0 && nextMilestoneIndex < milestones.length;
  const [nowSec, setNowSec] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidencePhoto, setEvidencePhoto] = useState<File | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [isPreparingEvidence, setIsPreparingEvidence] = useState(false);
  const lastMilestoneIndex = milestones.length - 1;
  const atFinalMilestone = milestoneInBounds && nextMilestoneIndex === lastMilestoneIndex;
  const lockExpired = info.lockDeadline !== null && nowSec >= info.lockDeadline;
  const finalRequested = info.finalRequestedAt > 0n;
  const finalExpired = info.finalConfirmationDeadline !== null && nowSec >= info.finalConfirmationDeadline;
  const relistReady = info.status === "open" && info.cancelCount > 0n;

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(BigInt(Math.floor(Date.now() / 1000)));
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const formatDeadline = (deadline: bigint | null) =>
    deadline === null
      ? null
      : new Intl.DateTimeFormat(isJapanese ? "ja-JP" : "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(Number(deadline) * 1000));

  const lockDeadlineLabel = formatDeadline(info.lockDeadline);
  const finalDeadlineLabel = formatDeadline(info.finalConfirmationDeadline);
  const canRecordNextMilestone =
    info.status === "active" &&
    userRole === "producer" &&
    milestoneInBounds &&
    nextMilestoneIndex < milestones.length - 1 &&
    txStep !== "success" &&
    !milestonesLoading;
  const canRequestFinalHandoff =
    info.status === "active" &&
    userRole === "producer" &&
    atFinalMilestone &&
    !finalRequested &&
    txStep !== "success" &&
    !milestonesLoading;

  const resetEvidenceDraft = () => {
    setShowEvidenceForm(false);
    setEvidenceNote("");
    setEvidencePhoto(null);
    setEvidenceError(null);
  };

  const buildEvidenceHash = async (): Promise<`0x${string}` | undefined> => {
    const trimmedNote = evidenceNote.trim();
    if (!trimmedNote && !evidencePhoto) {
      return undefined;
    }

    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    chunks.push(encoder.encode(`note:${trimmedNote}`));

    if (evidencePhoto) {
      const fileBytes = new Uint8Array(await evidencePhoto.arrayBuffer());
      chunks.push(encoder.encode(`file:${evidencePhoto.name}:${evidencePhoto.type}:${evidencePhoto.size}`));
      chunks.push(fileBytes);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const digest = await crypto.subtle.digest("SHA-256", merged);
    const hex = Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");

    return `0x${hex}` as `0x${string}`;
  };

  const runWithOptionalEvidence = async (
    action: (evidenceHash?: string) => void | Promise<void>,
  ) => {
    setEvidenceError(null);
    try {
      setIsPreparingEvidence(true);
      const evidenceHash = await buildEvidenceHash();
      await action(evidenceHash);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEvidenceError(
        isJapanese
          ? `補足情報の準備に失敗しました: ${message}`
          : `Failed to prepare supporting proof: ${message}`,
      );
    } finally {
      setIsPreparingEvidence(false);
    }
  };

  const isBusy = actionLoading || isPreparingEvidence;
  const canAttachEvidence = canRecordNextMilestone || canRequestFinalHandoff;

  useEffect(() => {
    if (txStep === "success") {
      resetEvidenceDraft();
    }
  }, [txStep]);

  return (
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
          {isJapanese ? "今やること" : "Next step"}
        </Typography>

        <TxProgress
          step={txStep}
          txHash={txHash}
          error={actionError}
          onClose={resetState}
        />

        {evidenceError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {evidenceError}
          </Alert>
        )}

        {canAttachEvidence && (
          <Box sx={{ mb: 2.5 }}>
            <Button
              variant="text"
              onClick={() => setShowEvidenceForm((value) => !value)}
              sx={{
                px: 0,
                minWidth: 0,
                color: "var(--color-primary)",
                fontWeight: 600,
                "&:hover": { background: "transparent" },
              }}
            >
              {showEvidenceForm
                ? isJapanese
                  ? "補足を閉じる"
                  : "Hide supporting proof"
                : isJapanese
                ? "補足のメモ・写真を付ける"
                : "Add optional note or photo"}
            </Button>
            <Collapse in={showEvidenceForm}>
              <Box
                sx={{
                  mt: 1.5,
                  p: 2,
                  borderRadius: 2,
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                }}
              >
                <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                  {isJapanese
                    ? "任意の補足です。ここで入力した内容はハッシュ化した証跡 ID として記録されます。写真の原本共有は今までどおり現場運用のままです。"
                    : "This is optional. The note/photo is reduced to a hashed proof ID on-chain. Keep sharing the original photo through your existing field workflow."}
                </Typography>
                <TextField
                  multiline
                  minRows={3}
                  value={evidenceNote}
                  onChange={(event) => setEvidenceNote(event.target.value)}
                  placeholder={
                    isJapanese
                      ? "例: 体重測定を完了。飼料の切り替えも実施。"
                      : "Example: Weight check completed. Feed change was also applied."
                  }
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "var(--color-text)",
                      background: "var(--color-surface)",
                      "& fieldset": { borderColor: "var(--color-border)" },
                    },
                  }}
                />
                <Box>
                  <Button
                    component="label"
                    variant="outlined"
                    sx={{
                      borderColor: "var(--color-border-strong)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {isJapanese ? "写真を選ぶ" : "Choose photo"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setEvidencePhoto(file);
                      }}
                    />
                  </Button>
                  {evidencePhoto && (
                    <Typography sx={{ mt: 1, color: "var(--color-text-muted)" }}>
                      {isJapanese ? "選択中" : "Selected"}: {evidencePhoto.name}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Collapse>
          </Box>
        )}

        {info.status === "open" && userRole !== "producer" && (
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 1.5,
                mb: 1,
                borderRadius: 2,
                background: purchaseValidation.hasEnoughBalance
                  ? "var(--status-success-surface)"
                  : "var(--status-error-surface)",
                border: `1px solid ${
                  purchaseValidation.hasEnoughBalance
                    ? "rgba(110, 191, 139, 0.25)"
                    : "rgba(214, 104, 83, 0.25)"
                }`,
              }}
            >
              <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
                {isJapanese ? "支払いに使える残高" : "Available payment balance"}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: purchaseValidation.hasEnoughBalance
                    ? "var(--status-success)"
                    : "var(--status-error)",
                }}
              >
                {formatAmount(purchaseValidation.balance, decimals, symbol)}
              </Typography>
            </Box>

            {!purchaseValidation.hasEnoughBalance && (
              <Alert
                severity="warning"
                sx={{
                  mt: 1,
                  borderRadius: 2,
                  background: "var(--status-warning-surface)",
                  color: "var(--status-warning)",
                  border: "1px solid rgba(232, 197, 71, 0.25)",
                }}
              >
                {isJapanese
                  ? `必要額まで ${formatAmount(info.totalAmount - purchaseValidation.balance, decimals, symbol)} 足りません`
                  : `Insufficient funds by ${formatAmount(info.totalAmount - purchaseValidation.balance, decimals, symbol)}`}
              </Alert>
            )}
          </Box>
        )}

        {info.status === "open" && userRole !== "producer" && txStep !== "success" && (
          <Button
            variant="contained"
            fullWidth
            startIcon={isBusy ? <CircularProgress size={20} /> : <PaymentIcon />}
            onClick={onLock}
            disabled={isBusy || !purchaseValidation.hasEnoughBalance}
            sx={{
              background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
              color: "var(--sumi-black)",
              fontWeight: 600,
              py: 1.5,
              borderRadius: 2,
              boxShadow: "var(--shadow-subtle), var(--shadow-copper)",
              "&:hover": {
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-deep) 100%)",
                transform: "translateY(-2px)",
                boxShadow: "var(--shadow-medium), 0 0 40px var(--copper-glow)",
              },
              "&:disabled": {
                background: "var(--color-surface-hover)",
                color: "var(--color-text-muted)",
                boxShadow: "none",
              },
            }}
          >
              {isBusy
                ? isJapanese
                  ? "処理中..."
                : "Processing..."
              : isJapanese
              ? `この条件で支払い準備を進める (${formatAmount(info.totalAmount, decimals, symbol)})`
              : `Secure payment for this plan (${formatAmount(info.totalAmount, decimals, symbol)})`}
          </Button>
        )}

        {info.status === "open" && userRole === "producer" && txStep !== "success" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
              {relistReady
                ? isJapanese
                  ? "再開準備ができています。次の買い手が支払い準備を進めると、この画面から続けられます。"
                  : "This listing is ready to restart. Once the next buyer secures payment, you can continue from here."
                : isJapanese
                ? "いまは買い手の支払い準備待ちです。連絡が入ったらこの画面から続けられます。"
                : "Waiting for the buyer to secure payment. Once that is done, the next action will appear here."}
            </Typography>
          </Box>
        )}

        {info.status === "locked" && userRole === "buyer" && txStep !== "success" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {lockExpired
                ? isJapanese
                  ? "開始確認の期限を過ぎました。今回は返金ではなく、取引を進める操作だけが残っています。"
                  : "The review window has expired. Cancellation is no longer available. Only the start action remains."
                : isJapanese
                ? "内容を確認して問題なければ開始してください。見送る場合は返金できます。"
                : "Review the details. Start when ready, or refund if you decide not to proceed."}
            </Alert>
            {lockDeadlineLabel && (
              <Typography variant="caption" sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                {isJapanese ? `開始確認の期限: ${lockDeadlineLabel}` : `Start review deadline: ${lockDeadlineLabel}`}
              </Typography>
            )}
            {!lockExpired ? (
              <>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={isBusy ? <CircularProgress size={20} /> : <ThumbUpIcon />}
                  onClick={onApprove}
                  disabled={isBusy}
                  sx={{
                    background: "linear-gradient(135deg, var(--status-success) 0%, #5A9E73 100%)",
                    color: "var(--sumi-black)",
                    fontWeight: 600,
                    py: 1.5,
                    borderRadius: 2,
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "var(--shadow-medium), 0 0 30px rgba(110, 191, 139, 0.3)",
                    },
                  }}
                >
                  {isBusy
                    ? isJapanese
                      ? "処理中..."
                      : "Processing..."
                    : isJapanese
                    ? "内容確認を終えて開始する"
                    : "Approve and start"}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={isBusy ? <CircularProgress size={20} /> : <CancelIcon />}
                  onClick={onCancel}
                  disabled={isBusy}
                  sx={{
                    borderColor: "var(--status-error)",
                    color: "var(--status-error)",
                    "&:hover": {
                      borderColor: "var(--status-error)",
                      background: "var(--status-error-surface)",
                    },
                  }}
                >
                  {isBusy
                    ? isJapanese
                      ? "処理中..."
                      : "Processing..."
                    : isJapanese
                    ? "今回は見送って返金する"
                    : "Refund and stop"}
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                fullWidth
                startIcon={isBusy ? <CircularProgress size={20} /> : <ThumbUpIcon />}
                onClick={onActivateAfterTimeout}
                disabled={isBusy}
                sx={{
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                  color: "var(--sumi-black)",
                  fontWeight: 600,
                  py: 1.5,
                  borderRadius: 2,
                }}
              >
                {isBusy
                  ? isJapanese
                    ? "処理中..."
                    : "Processing..."
                  : isJapanese
                  ? "期限後に進行を再開する"
                  : "Start after timeout"}
              </Button>
            )}
          </Box>
        )}

        {info.status === "locked" && userRole === "producer" && txStep !== "success" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {lockExpired
                ? isJapanese
                  ? "開始確認の期限を過ぎました。次の操作をすると進行中に変わります。"
                  : "The review window has expired. The next action will move the listing into active progress."
                : isJapanese
                ? "買い手が内容を確認中です。確認が終わると取引が動き出します。"
                : "The buyer is reviewing the details. The flow will start after confirmation."}
            </Alert>
            {lockDeadlineLabel && (
              <Typography variant="caption" sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                {isJapanese ? `開始確認の期限: ${lockDeadlineLabel}` : `Start review deadline: ${lockDeadlineLabel}`}
              </Typography>
            )}
            {lockExpired ? (
              <Button
                variant="contained"
                fullWidth
                startIcon={isBusy ? <CircularProgress size={20} /> : <ThumbUpIcon />}
                onClick={onActivateAfterTimeout}
                disabled={isBusy}
                sx={{
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                  color: "var(--sumi-black)",
                  fontWeight: 600,
                  py: 1.5,
                  borderRadius: 2,
                }}
              >
                {isBusy
                  ? isJapanese
                    ? "処理中..."
                    : "Processing..."
                  : isJapanese
                  ? "期限後に進行を再開する"
                  : "Start after timeout"}
              </Button>
            ) : (
              <Typography sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                {isJapanese ? "買い手の開始確認待ちです。" : "Waiting for buyer confirmation."}
              </Typography>
            )}
          </Box>
        )}

        {info.status === "active" && userRole === "producer" && milestonesLoading && txStep === "idle" && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} sx={{ color: "var(--color-primary)" }} />
          </Box>
        )}

        {canRecordNextMilestone && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {isJapanese
                ? "まずは今日終わった工程を記録してください。写真やメモは任意なので、1回で完了できます。"
                : "Record the step that finished today. Photos and notes stay optional, so the default path is a single action."}
            </Alert>
            <Button
              variant="contained"
              fullWidth
              startIcon={isBusy ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={() => {
                void runWithOptionalEvidence((evidenceHash) => onSubmit(nextMilestoneIndex, evidenceHash));
              }}
              disabled={isBusy}
              sx={{
                background: "linear-gradient(135deg, var(--status-success) 0%, #5A9E73 100%)",
                color: "var(--sumi-black)",
                fontWeight: 600,
                py: 1.5,
                borderRadius: 2,
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "var(--shadow-medium), 0 0 30px rgba(110, 191, 139, 0.3)",
                },
              }}
            >
              {isBusy
                ? isJapanese
                  ? "処理中..."
                  : "Processing..."
                : isJapanese
                ? `「${milestones[nextMilestoneIndex].name}」を記録して次へ進む`
                : `Record "${milestones[nextMilestoneIndex].name}" and continue`}
            </Button>
          </Box>
        )}

        {canRequestFinalHandoff && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {isJapanese
                ? "受け渡しが終わったら、買い手へ最終確認の連絡を送ってください。"
                : "Once the handoff is done, notify the buyer for final confirmation."}
            </Alert>
            <Button
              variant="contained"
              fullWidth
              startIcon={isBusy ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={() => {
                void runWithOptionalEvidence((evidenceHash) => onRequestFinalDelivery(evidenceHash));
              }}
              disabled={isBusy}
              sx={{
                background: "linear-gradient(135deg, var(--status-success) 0%, #5A9E73 100%)",
                color: "var(--sumi-black)",
                fontWeight: 600,
                py: 1.5,
                borderRadius: 2,
              }}
            >
              {isBusy
                ? isJapanese
                  ? "処理中..."
                  : "Processing..."
                : isJapanese
                ? "受け渡し完了を伝える"
                : "Notify final handoff"}
            </Button>
          </Box>
        )}

        {info.status === "active" &&
          userRole === "producer" &&
          atFinalMilestone &&
          finalRequested &&
          !finalExpired &&
          txStep !== "success" &&
          !milestonesLoading && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {isJapanese
                  ? "買い手の受け取り確認待ちです。期限を過ぎると最終確定に進めます。"
                  : "Waiting for the buyer's receipt confirmation. After the deadline, the flow can be finalized."}
              </Alert>
              {finalDeadlineLabel && (
                <Typography sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                  {isJapanese ? `最終確認の期限: ${finalDeadlineLabel}` : `Final confirmation deadline: ${finalDeadlineLabel}`}
                </Typography>
              )}
            </Box>
          )}

        {info.status === "active" &&
          userRole === "producer" &&
          atFinalMilestone &&
          finalRequested &&
          finalExpired &&
          txStep !== "success" &&
          !milestonesLoading && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                {isJapanese
                  ? "最終確認の期限を過ぎました。最終確定すると残りを受け取れます。"
                  : "The final confirmation deadline has passed. Finalize to release the remaining amount."}
              </Alert>
              <Button
                variant="contained"
                fullWidth
                startIcon={isBusy ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                onClick={onFinalizeAfterTimeout}
                disabled={isBusy}
                sx={{
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                  color: "var(--sumi-black)",
                  fontWeight: 600,
                  py: 1.5,
                  borderRadius: 2,
                }}
              >
                {isBusy
                  ? isJapanese
                    ? "処理中..."
                    : "Processing..."
                  : isJapanese
                  ? "期限後に残額を受け取る"
                  : "Finalize remaining payout"}
              </Button>
            </Box>
          )}

        {info.status === "active" &&
          userRole === "buyer" &&
          milestoneInBounds &&
          nextMilestoneIndex < milestones.length - 1 &&
          txStep !== "success" && (
            <Typography sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
              {isJapanese
                ? "生産者の記録待ちです。更新が入るとここで確認できます。"
                : "Waiting for the producer's next record. Updates will appear here."}
            </Typography>
          )}

        {info.status === "active" &&
          userRole === "buyer" &&
          atFinalMilestone &&
          !finalRequested &&
          txStep !== "success" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {isJapanese
                  ? "生産者から受け渡し完了の連絡が入ると、ここで受け取り確認できます。"
                  : "Once the producer notifies final handoff, receipt confirmation will appear here."}
              </Alert>
            </Box>
          )}

        {info.status === "active" &&
          userRole === "buyer" &&
          atFinalMilestone &&
          finalRequested &&
          !finalExpired &&
          txStep !== "success" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                {isJapanese
                  ? "受け取りが問題なければ確認してください。確認すると残りの支払いが完了します。"
                  : "Confirm receipt if the handoff looks good. This completes the remaining payment."}
              </Alert>
              {finalDeadlineLabel && (
                <Typography variant="caption" sx={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                  {isJapanese ? `最終確認の期限: ${finalDeadlineLabel}` : `Final confirmation deadline: ${finalDeadlineLabel}`}
                </Typography>
              )}
              <Button
                variant="contained"
                fullWidth
                startIcon={isBusy ? <CircularProgress size={20} /> : <LocalShippingIcon />}
                onClick={onConfirmDelivery}
                disabled={isBusy}
                sx={{
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                  color: "var(--sumi-black)",
                  fontWeight: 600,
                  py: 1.5,
                  borderRadius: 2,
                  boxShadow: "var(--shadow-subtle), var(--shadow-copper)",
                  "&:hover": {
                    background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-deep) 100%)",
                    transform: "translateY(-2px)",
                    boxShadow: "var(--shadow-medium), 0 0 40px var(--copper-glow)",
                  },
                }}
              >
                {isBusy
                  ? isJapanese
                    ? "処理中..."
                    : "Processing..."
                  : isJapanese
                  ? "受け取りを確認する"
                  : "Confirm receipt"}
              </Button>
            </Box>
          )}

        {info.status === "active" &&
          userRole === "buyer" &&
          atFinalMilestone &&
          finalRequested &&
          finalExpired &&
          txStep !== "success" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                {isJapanese
                  ? "最終確認の期限を過ぎました。このまま完了処理に進めます。"
                  : "The final confirmation deadline has passed. You can finalize the flow now."}
              </Alert>
              <Button
                variant="contained"
                fullWidth
                startIcon={isBusy ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                onClick={onFinalizeAfterTimeout}
                disabled={isBusy}
                sx={{
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                  color: "var(--sumi-black)",
                  fontWeight: 600,
                  py: 1.5,
                  borderRadius: 2,
                }}
              >
                {isBusy
                  ? isJapanese
                    ? "処理中..."
                    : "Processing..."
                  : isJapanese
                  ? "期限後に完了処理へ進む"
                  : "Finalize after timeout"}
              </Button>
            </Box>
          )}

        {info.status === "completed" && (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: "var(--status-success)", mb: 1 }} />
            <Typography sx={{ color: "var(--color-text)" }}>
              {isJapanese ? "この案件は完了しました" : "This listing is complete"}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
