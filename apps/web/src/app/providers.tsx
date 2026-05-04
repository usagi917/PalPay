"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type Config, type State } from "wagmi";
import { ThemeProvider } from "@/theme";
import { wagmiConfig } from "@/lib/wagmi";

type WalletProvidersProps = {
  children: ReactNode;
  initialState?: State;
};

export function Providers({
  children,
  initialState,
}: WalletProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [activeWagmiConfig, setActiveWagmiConfig] =
    useState<Config>(() => wagmiConfig);
  const [WalletProviders, setWalletProviders] =
    useState<ComponentType<{ children: ReactNode }> | null>(null);

  useEffect(() => {
    let isMounted = true;

    import("./wallet-providers").then(
      ({ default: LoadedWalletProviders, clientWagmiConfig }) => {
        if (!isMounted) return;
        setActiveWagmiConfig(clientWagmiConfig);
        setWalletProviders(
          () => LoadedWalletProviders as ComponentType<{ children: ReactNode }>,
        );
      },
    );

    return () => {
      isMounted = false;
    };
  }, []);

  const content = WalletProviders ? (
    <WalletProviders>{children}</WalletProviders>
  ) : (
    children
  );

  return (
    <WagmiProvider config={activeWagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{content}</ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
