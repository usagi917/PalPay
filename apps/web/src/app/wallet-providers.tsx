"use client";

import type { ReactNode } from "react";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { clientWagmiConfig } from "@/lib/wagmi.client";
import "@rainbow-me/rainbowkit/styles.css";

export { clientWagmiConfig };

export default function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <RainbowKitProvider theme={lightTheme()} modalSize="compact">
      {children}
    </RainbowKitProvider>
  );
}
