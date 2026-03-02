import { formatUnits, parseUnits } from "viem";

const JPYC_DECIMALS = 18;

export function formatJpycAmount(amount: string | bigint, locale: "ja" | "en"): string {
  const localeCode = locale === "ja" ? "ja-JP" : "en-US";
  if (typeof amount === "bigint") {
    return amount.toLocaleString(localeCode);
  }

  const trimmed = amount.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    return trimmed;
  }

  const sign = match[1];
  const integerPart = BigInt(match[2]).toLocaleString(localeCode);
  const fractionPart = match[3];
  return fractionPart ? `${sign}${integerPart}.${fractionPart}` : `${sign}${integerPart}`;
}

export function parseJpycAmountToWei(amount?: string): bigint {
  if (!amount) {
    return 0n;
  }
  try {
    return parseUnits(amount.trim(), JPYC_DECIMALS);
  } catch {
    return 0n;
  }
}

export function formatJpycWeiAmount(amountWei: bigint, locale: "ja" | "en"): string {
  return formatJpycAmount(formatUnits(amountWei, JPYC_DECIMALS), locale);
}
