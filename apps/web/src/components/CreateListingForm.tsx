"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useCreateListing, useTokenInfo, categoryToType } from "@/lib/hooks";
import { getTxUrl } from "@/lib/config";
interface CreateListingFormProps {
  onSuccess?: () => void;
}

const CATEGORIES = [
  { value: "wagyu", labelJa: "和牛", labelEn: "Wagyu Beef" },
  { value: "sake", labelJa: "日本酒", labelEn: "Japanese Sake" },
  { value: "craft", labelJa: "工芸品", labelEn: "Traditional Craft" },
];

export function CreateListingForm({ onSuccess }: CreateListingFormProps) {
  const { locale } = useI18n();
  const { symbol, decimals } = useTokenInfo();

  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState("wagyu");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [imageURI, setImageURI] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSuccess = () => {
    setIsOpen(false);
    setTitle("");
    setDescription("");
    setAmount("");
    setImageURI("");
    setFormError(null);
    onSuccess?.();
  };

  const { createListing, isLoading, error, txHash } = useCreateListing(handleSuccess);

  const handleSubmit = async () => {
    setFormError(null);

    // タイトルのバリデーション
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError(locale === "ja" ? "タイトルを入力してください" : "Please enter a title");
      return;
    }
    if (trimmedTitle.length > 100) {
      setFormError(locale === "ja" ? "タイトルは100文字以内で入力してください" : "Title must be 100 characters or less");
      return;
    }

    // 説明のバリデーション（任意だが500文字以内）
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 500) {
      setFormError(locale === "ja" ? "説明は500文字以内で入力してください" : "Description must be 500 characters or less");
      return;
    }

    // 金額のバリデーション
    if (!amount) {
      setFormError(locale === "ja" ? "価格を入力してください" : "Please enter a price");
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError(locale === "ja" ? "価格は0より大きい値を入力してください" : "Price must be greater than 0");
      return;
    }

    let amountBigInt: bigint;
    try {
      amountBigInt = parseUnits(amount, decimals);
    } catch {
      setFormError(locale === "ja" ? "金額の形式が正しくありません" : "Invalid amount format");
      return;
    }

    const categoryType = categoryToType(category);
    await createListing(categoryType, trimmedTitle, trimmedDescription, amountBigInt, imageURI.trim());
  };

  const t = {
    createListing: locale === "ja" ? "新規出品" : "Create Listing",
    category: locale === "ja" ? "カテゴリ" : "Category",
    title: locale === "ja" ? "タイトル" : "Title",
    titlePlaceholder: locale === "ja" ? "商品名を入力" : "Enter product name",
    description: locale === "ja" ? "説明" : "Description",
    descriptionPlaceholder: locale === "ja" ? "商品の説明を入力" : "Enter product description",
    amount: locale === "ja" ? "価格" : "Price",
    amountPlaceholder: locale === "ja" ? "価格を入力" : "Enter price",
    imageURI: locale === "ja" ? "画像URL (任意)" : "Image URL (optional)",
    imageURIPlaceholder: locale === "ja" ? "https://example.com/image.jpg" : "https://example.com/image.jpg",
    submit: locale === "ja" ? "出品する" : "Submit Listing",
    cancel: locale === "ja" ? "キャンセル" : "Cancel",
    processing: locale === "ja" ? "処理中..." : "Processing...",
    viewTx: locale === "ja" ? "トランザクションを確認" : "View Transaction",
  };

  return (
    <Box sx={{ mb: 3 }}>
      <AnimatePresence>
        {!isOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsOpen(true)}
              sx={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                color: "var(--sumi-black)",
                fontWeight: 600,
                px: 3,
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
              {t.createListing}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card
              sx={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 3,
                overflow: "hidden",
                position: "relative",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(247, 243, 235, 0.02) 0%, transparent 50%)",
                  pointerEvents: "none",
                },
              }}
            >
              <CardContent sx={{ p: 3, position: "relative" }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    mb: 3,
                  }}
                >
                  {t.createListing}
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  {/* Category */}
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: "var(--color-text-muted)" }}>
                      {t.category}
                    </InputLabel>
                    <Select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      label={t.category}
                      sx={{
                        color: "var(--color-text)",
                        background: "var(--color-bg-elevated)",
                        borderRadius: 2,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "var(--color-border)",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "var(--color-border-strong)",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "var(--color-primary)",
                        },
                      }}
                    >
                      {CATEGORIES.map((cat) => (
                        <MenuItem key={cat.value} value={cat.value}>
                          {locale === "ja" ? cat.labelJa : cat.labelEn}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Title */}
                  <TextField
                    label={t.title}
                    placeholder={t.titlePlaceholder}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    fullWidth
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        color: "var(--color-text)",
                        background: "var(--color-bg-elevated)",
                        borderRadius: 2,
                        "& fieldset": {
                          borderColor: "var(--color-border)",
                        },
                        "&:hover fieldset": {
                          borderColor: "var(--color-border-strong)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "var(--color-primary)",
                          boxShadow: "0 0 0 3px var(--color-primary-surface)",
                        },
                      },
                      "& .MuiInputLabel-root": {
                        color: "var(--color-text-muted)",
                        "&.Mui-focused": {
                          color: "var(--color-primary)",
                        },
                      },
                    }}
                  />

                  {/* Description */}
                  <TextField
                    label={t.description}
                    placeholder={t.descriptionPlaceholder}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    multiline
                    rows={3}
                    fullWidth
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        color: "var(--color-text)",
                        background: "var(--color-bg-elevated)",
                        borderRadius: 2,
                        "& fieldset": {
                          borderColor: "var(--color-border)",
                        },
                        "&:hover fieldset": {
                          borderColor: "var(--color-border-strong)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "var(--color-primary)",
                          boxShadow: "0 0 0 3px var(--color-primary-surface)",
                        },
                      },
                      "& .MuiInputLabel-root": {
                        color: "var(--color-text-muted)",
                        "&.Mui-focused": {
                          color: "var(--color-primary)",
                        },
                      },
                    }}
                  />

                  {/* Amount */}
                  <TextField
                    label={`${t.amount} (${symbol || "JPYC"})`}
                    placeholder={t.amountPlaceholder}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    type="number"
                    required
                    fullWidth
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        color: "var(--color-text)",
                        background: "var(--color-bg-elevated)",
                        borderRadius: 2,
                        "& fieldset": {
                          borderColor: "var(--color-border)",
                        },
                        "&:hover fieldset": {
                          borderColor: "var(--color-border-strong)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "var(--color-primary)",
                          boxShadow: "0 0 0 3px var(--color-primary-surface)",
                        },
                      },
                      "& .MuiInputLabel-root": {
                        color: "var(--color-text-muted)",
                        "&.Mui-focused": {
                          color: "var(--color-primary)",
                        },
                      },
                    }}
                  />

                  {/* Image URI */}
                  <TextField
                    label={t.imageURI}
                    placeholder={t.imageURIPlaceholder}
                    value={imageURI}
                    onChange={(e) => setImageURI(e.target.value)}
                    fullWidth
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        color: "var(--color-text)",
                        background: "var(--color-bg-elevated)",
                        borderRadius: 2,
                        "& fieldset": {
                          borderColor: "var(--color-border)",
                        },
                        "&:hover fieldset": {
                          borderColor: "var(--color-border-strong)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "var(--color-primary)",
                          boxShadow: "0 0 0 3px var(--color-primary-surface)",
                        },
                      },
                      "& .MuiInputLabel-root": {
                        color: "var(--color-text-muted)",
                        "&.Mui-focused": {
                          color: "var(--color-primary)",
                        },
                      },
                    }}
                  />

                  {/* Error */}
                  {(formError || error) && (
                    <Alert
                      severity="error"
                      sx={{
                        borderRadius: 2,
                        background: "var(--status-error-surface)",
                        color: "var(--status-error)",
                        border: "1px solid rgba(214, 104, 83, 0.25)",
                      }}
                    >
                      {formError || error}
                    </Alert>
                  )}

                  {/* Success */}
                  {txHash && (
                    <Alert
                      severity="success"
                      sx={{
                        borderRadius: 2,
                        background: "var(--status-success-surface)",
                        color: "var(--status-success)",
                        border: "1px solid rgba(110, 191, 139, 0.25)",
                      }}
                    >
                      <a
                        href={getTxUrl(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "inherit" }}
                      >
                        {t.viewTx}
                      </a>
                    </Alert>
                  )}

                  {/* Buttons */}
                  <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setIsOpen(false)}
                      disabled={isLoading}
                      sx={{
                        flex: 1,
                        borderColor: "var(--color-border-strong)",
                        color: "var(--color-text-secondary)",
                        borderRadius: 2,
                        py: 1.25,
                        "&:hover": {
                          borderColor: "var(--color-primary)",
                          color: "var(--color-primary)",
                          background: "var(--color-primary-surface)",
                        },
                      }}
                    >
                      {t.cancel}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={isLoading || !title.trim() || !amount}
                      sx={{
                        flex: 1,
                        background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
                        color: "var(--sumi-black)",
                        fontWeight: 600,
                        borderRadius: 2,
                        py: 1.25,
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
                      {isLoading ? (
                        <>
                          <CircularProgress size={20} sx={{ mr: 1, color: "var(--sumi-black)" }} />
                          {t.processing}
                        </>
                      ) : (
                        t.submit
                      )}
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
