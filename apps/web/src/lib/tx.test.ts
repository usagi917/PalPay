import { parseGwei } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecommendedGasFees } from "./tx";

describe("getRecommendedGasFees", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves low network estimates instead of applying high floors", async () => {
    const estimatedFees = {
      maxFeePerGas: parseGwei("0.2"),
      maxPriorityFeePerGas: parseGwei("0.01"),
    };

    await expect(
      getRecommendedGasFees({
        estimateFeesPerGas: async () => estimatedFees,
      }),
    ).resolves.toEqual(estimatedFees);
  });

  it("lets the wallet choose fees when estimation fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      getRecommendedGasFees({
        estimateFeesPerGas: async () => {
          throw new Error("RPC unavailable");
        },
      }),
    ).resolves.toEqual({});
  });

  it("lets the wallet choose fees when estimates are incomplete", async () => {
    await expect(
      getRecommendedGasFees({
        estimateFeesPerGas: async () => ({
          maxFeePerGas: parseGwei("0.5"),
        }),
      }),
    ).resolves.toEqual({});
  });

  it("keeps estimated max fee at least as high as priority fee", async () => {
    await expect(
      getRecommendedGasFees({
        estimateFeesPerGas: async () => ({
          maxFeePerGas: parseGwei("0.5"),
          maxPriorityFeePerGas: parseGwei("1"),
        }),
      }),
    ).resolves.toEqual({
      maxFeePerGas: parseGwei("1"),
      maxPriorityFeePerGas: parseGwei("1"),
    });
  });
});
