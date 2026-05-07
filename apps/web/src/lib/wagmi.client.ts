"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  baseAccount,
  injectedWallet,
  metaMaskWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig } from "wagmi";
import { wagmiBaseConfig, walletConnectProjectId } from "./wagmi.shared";

const recommendedWallets = walletConnectProjectId
  ? [metaMaskWallet, baseAccount, walletConnectWallet]
  : [injectedWallet, baseAccount];

export const clientWagmiConfig = createConfig({
  ...wagmiBaseConfig,
  connectors: connectorsForWallets(
    [
      {
        groupName: "Recommended",
        wallets: recommendedWallets,
      },
    ],
    {
      appName: "palpay",
      projectId: walletConnectProjectId ?? "",
    },
  ),
});
