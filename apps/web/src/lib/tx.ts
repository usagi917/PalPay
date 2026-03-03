import type { createWallet } from "./config";

type WalletClient = NonNullable<ReturnType<typeof createWallet>>;
type WriteContractParams = Parameters<WalletClient["writeContract"]>[0];
type ErrorLike = {
  message?: string;
  shortMessage?: string;
  details?: string;
  cause?: unknown;
  code?: number | string;
};

const GAS_ESTIMATION_ERROR_PATTERNS = [
  "exceeds max transaction gas limit",
  "gas required exceeds allowance",
  "exceeds block gas limit",
  "intrinsic gas too low",
  "failed to estimate gas",
];

const USER_REJECTED_ERROR_PATTERNS = [
  "user rejected",
  "user denied",
  "rejected the request",
  "denied transaction signature",
];

const extractErrorText = (error: unknown): string => {
  if (!error || typeof error !== "object") return String(error ?? "");
  const err = error as ErrorLike;

  const parts = [
    err.message,
    err.shortMessage,
    err.details,
    err.cause instanceof Error ? err.cause.message : typeof err.cause === "string" ? err.cause : undefined,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return parts.join(" | ").toLowerCase();
};

const hasErrorCode = (error: unknown, targetCode: number): boolean => {
  let current = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") return false;

    const code = (current as ErrorLike).code;
    if (typeof code === "number" && code === targetCode) return true;
    if (typeof code === "string" && Number(code) === targetCode) return true;

    current = (current as ErrorLike).cause;
  }

  return false;
};

export const getErrorText = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return String(error);
};

export const isGasEstimationError = (error: unknown): boolean => {
  const text = extractErrorText(error);
  return GAS_ESTIMATION_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
};

export const isUserRejectedError = (error: unknown): boolean => {
  if (hasErrorCode(error, 4001)) return true;
  const text = extractErrorText(error);
  return USER_REJECTED_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
};

export const formatTxError = (
  error: unknown,
  fallbackMessage: string,
  userRejectedMessage = "ウォレットで署名がキャンセルされました。",
): string => {
  if (isUserRejectedError(error)) {
    return userRejectedMessage;
  }

  const message = getErrorText(error);
  return message.trim() ? message : fallbackMessage;
};

export const writeContractWithGasFallback = async (
  wallet: WalletClient,
  params: WriteContractParams,
  fallbackGas?: bigint,
) => {
  try {
    return await wallet.writeContract(params);
  } catch (error) {
    if (!fallbackGas || !isGasEstimationError(error)) {
      throw error;
    }

    console.warn("Gas estimation failed. Retrying with fallback gas.", {
      functionName: (params as { functionName?: string }).functionName,
      fallbackGas: fallbackGas.toString(),
    });

    return wallet.writeContract({
      ...params,
      gas: fallbackGas,
    } as WriteContractParams);
  }
};
