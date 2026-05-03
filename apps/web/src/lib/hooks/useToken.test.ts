import { describe, expect, it } from "vitest";
import { getTokenReadError } from "./useToken";

describe("getTokenReadError", () => {
  it("classifies viem zero-data contract reads as missing token contracts", () => {
    const error = new Error('The contract function "balanceOf" returned no data ("0x").');
    error.name = "ContractFunctionZeroDataError";

    expect(getTokenReadError(error)).toBe("missing-token-contract");
  });

  it("classifies wrapped viem zero-data errors as missing token contracts", () => {
    const error = new Error("Contract function execution failed.");
    error.name = "ContractFunctionExecutionError";
    error.cause = new Error("The address is not a contract.");

    expect(getTokenReadError(error)).toBe("missing-token-contract");
  });

  it("keeps unrelated read failures generic", () => {
    expect(getTokenReadError(new Error("HTTP request failed."))).toBe("read-failed");
  });
});
