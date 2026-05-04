"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, type Config, type State } from "wagmi";
import { ThemeProvider } from "@/theme";
import "@rainbow-me/rainbowkit/styles.css";

export default function WalletProviders({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: State;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [wagmiConfig, setWagmiConfig] = useState<Config | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let isMounted = true;

    import("@/lib/wagmi.client").then(({ clientWagmiConfig }) => {
      if (!isMounted) return;
      setWagmiConfig(clientWagmiConfig);
      setMounted(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!wagmiConfig) {
    return null;
  }

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {mounted ? (
          <RainbowKitProvider theme={lightTheme()} modalSize="compact">
            <ThemeProvider>{children}</ThemeProvider>
          </RainbowKitProvider>
        ) : null}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
