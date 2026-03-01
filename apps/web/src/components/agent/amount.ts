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

export function parseWholeJpycAmount(amount?: string): bigint {
  if (!amount) {
    return 0n;
  }
  const trimmed = amount.trim();
  if (!/^\d+$/.test(trimmed)) {
    return 0n;
  }
  return BigInt(trimmed);
}
