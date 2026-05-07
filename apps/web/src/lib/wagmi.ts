import { createConfig } from "wagmi";
import { wagmiBaseConfig } from "./wagmi.shared";

export const wagmiConfig = createConfig({
  ...wagmiBaseConfig,
  connectors: [],
});
