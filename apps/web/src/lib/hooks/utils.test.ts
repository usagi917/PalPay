import { describe, expect, it } from "vitest";
import { formatAmount } from "./utils";

describe("formatAmount", () => {
  it("formats 18-decimal JPYC amounts without a fraction when exact", () => {
    expect(formatAmount(1_000n * 10n ** 18n, 18, "JPYC")).toBe("1000 JPYC");
  });

  it("formats 6-decimal USDC amounts with two decimal places", () => {
    expect(formatAmount(12_345_678n, 6, "USDC")).toBe("12.34 USDC");
  });
});
