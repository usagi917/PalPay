"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";

type WalletProvidersProps = {
  children: ReactNode;
  initialState?: unknown;
};

export function Providers({
  children,
  initialState,
}: WalletProvidersProps) {
  const [WalletProviders, setWalletProviders] =
    useState<ComponentType<WalletProvidersProps> | null>(null);

  useEffect(() => {
    let isMounted = true;

    import("./wallet-providers").then(({ default: LoadedWalletProviders }) => {
      if (!isMounted) return;
      setWalletProviders(
        () => LoadedWalletProviders as ComponentType<WalletProvidersProps>,
      );
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!WalletProviders) {
    return null;
  }

  return <WalletProviders initialState={initialState}>{children}</WalletProviders>;
}
