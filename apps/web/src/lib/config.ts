import { http, createPublicClient, createWalletClient, custom, type Address, type Chain } from "viem";
import { baseSepolia, sepolia } from "viem/chains";

export type StablecoinSymbol = "JPYC" | "USDC";

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  providers?: unknown[];
};

export type StablecoinConfig = {
  currency: StablecoinSymbol;
  symbol: StablecoinSymbol;
  decimals: number;
  tokenAddress: Address;
  factoryAddress: Address;
};

const emptyAddress = "" as Address;

const isEthereumProvider = (value: unknown): value is EthereumProvider => {
  if (!value || typeof value !== "object") return false;
  return typeof (value as { request?: unknown }).request === "function";
};

export const SUPPORTED_CHAINS = Object.freeze({
  [sepolia.id]: sepolia as Chain,
  [baseSepolia.id]: baseSepolia as Chain,
});

export const config = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "",
  chainId: parseInt(
    process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || String(baseSepolia.id),
    10,
  ),
  blockExplorerTxBase: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE || "",
};

export const STABLECOINS = Object.freeze({
  JPYC: {
    currency: "JPYC",
    symbol: "JPYC",
    decimals: 18,
    tokenAddress: (process.env.NEXT_PUBLIC_JPYC_TOKEN_ADDRESS || "") as Address,
    factoryAddress: (process.env.NEXT_PUBLIC_JPYC_FACTORY_ADDRESS || "") as Address,
  },
  USDC: {
    currency: "USDC",
    symbol: "USDC",
    decimals: 6,
    tokenAddress: (process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || "") as Address,
    factoryAddress: (process.env.NEXT_PUBLIC_USDC_FACTORY_ADDRESS || "") as Address,
  },
} satisfies Record<StablecoinSymbol, StablecoinConfig>);

export const getConfiguredStablecoins = (): StablecoinConfig[] =>
  (Object.values(STABLECOINS) as StablecoinConfig[]).filter(
    (token) => Boolean(token.tokenAddress) && Boolean(token.factoryAddress),
  );

export const getStablecoinConfig = (currency: StablecoinSymbol): StablecoinConfig => STABLECOINS[currency];

export const getStablecoinByToken = (tokenAddress: Address): StablecoinConfig | null => {
  const lower = tokenAddress.toLowerCase();
  return (
    (Object.values(STABLECOINS) as StablecoinConfig[]).find(
      (token) => token.tokenAddress && token.tokenAddress.toLowerCase() === lower,
    ) ?? null
  );
};

export const getStablecoinByFactory = (factoryAddress: Address): StablecoinConfig | null => {
  const lower = factoryAddress.toLowerCase();
  return (
    (Object.values(STABLECOINS) as StablecoinConfig[]).find(
      (token) => token.factoryAddress && token.factoryAddress.toLowerCase() === lower,
    ) ?? null
  );
};

export const getDefaultStablecoin = (): StablecoinConfig =>
  getConfiguredStablecoins()[0] ?? {
    ...STABLECOINS.JPYC,
    tokenAddress: STABLECOINS.JPYC.tokenAddress || emptyAddress,
    factoryAddress: STABLECOINS.JPYC.factoryAddress || emptyAddress,
  };

export const getChain = (): Chain => {
  const chain = SUPPORTED_CHAINS[config.chainId as keyof typeof SUPPORTED_CHAINS];
  if (!chain) {
    throw new Error(`Unsupported testnet chain ID ${config.chainId}. Use Sepolia or Base Sepolia.`);
  }
  return chain;
};

export const createClient = () => {
  const chain = getChain();
  return createPublicClient({
    chain,
    transport: http(config.rpcUrl || undefined),
  });
};

export const isMobile = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const openMetaMaskDeepLink = (): void => {
  if (typeof window === "undefined") return;
  const dappUrl = window.location.href.replace(/^https?:\/\//, "");
  window.location.href = `https://metamask.app.link/dapp/${dappUrl}`;
};

export const getMetaMaskProvider = (): typeof window.ethereum | null => {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  const injected = window.ethereum as unknown;
  const rawProviders =
    injected && typeof injected === "object" ? (injected as EthereumProvider).providers : undefined;

  const providers: unknown[] = Array.isArray(rawProviders) ? rawProviders : [injected];

  for (const provider of providers) {
    if (isEthereumProvider(provider) && provider.isMetaMask) {
      return provider;
    }
  }

  for (const provider of providers) {
    if (isEthereumProvider(provider)) {
      return provider;
    }
  }

  return null;
};

export const createWallet = (providerOverride?: typeof window.ethereum) => {
  const provider = providerOverride || getMetaMaskProvider();
  if (!provider) {
    return null;
  }
  const chain = getChain();
  return createWalletClient({
    chain,
    transport: custom(provider),
  });
};

const getChainLabel = (chainId: number): string => {
  const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
  return chain?.name || `Chain ID ${chainId}`;
};

export const ensureWalletChain = async (provider: typeof window.ethereum): Promise<void> => {
  if (!provider) {
    throw new Error("MetaMaskが見つかりません");
  }
  const targetChain = getChain();
  const targetChainId = config.chainId;
  const targetChainHex = `0x${targetChainId.toString(16)}`;

  const currentChainHex = (await provider.request({ method: "eth_chainId" })) as string;
  const currentChainId = parseInt(currentChainHex, 16);

  if (currentChainId === targetChainId) {
    return;
  }

  const targetLabel = targetChain.name || `Chain ID ${targetChainId}`;
  const currentLabel = getChainLabel(currentChainId);

  const trySwitch = async () => {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainHex }],
    });
  };

  try {
    await trySwitch();
  } catch (switchError: unknown) {
    const err = switchError as { code?: number };
    if (err.code === 4001) {
      throw new Error(`ネットワーク切替がキャンセルされました。MetaMaskで${targetLabel}に切り替えてください（現在: ${currentLabel}）。`);
    }
    if (err.code === -32002) {
      throw new Error(`ネットワーク切替の確認待ちがあります。MetaMaskを開き、${targetLabel}への切替を確認してください。`);
    }
    if (err.code === 4902) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: targetChainHex,
              chainName: targetLabel,
              nativeCurrency: targetChain.nativeCurrency,
              rpcUrls: [config.rpcUrl || targetChain.rpcUrls.default.http[0]],
              blockExplorerUrls: targetChain.blockExplorers ? [targetChain.blockExplorers.default.url] : undefined,
            },
          ],
        });
        await trySwitch();
      } catch (addError: unknown) {
        const addErr = addError as { code?: number };
        if (addErr.code === 4001) {
          throw new Error(`ネットワーク追加がキャンセルされました。MetaMaskで${targetLabel}を追加して切り替えてください。`);
        }
        throw new Error(`ネットワーク追加に失敗しました。MetaMaskで${targetLabel}を追加・切り替えてください。`);
      }
    } else {
      throw new Error(`ネットワーク切替に失敗しました。MetaMaskを${targetLabel}に切り替えてください（現在: ${currentLabel}）。`);
    }
  }

  const verifiedHex = (await provider.request({ method: "eth_chainId" })) as string;
  const verifiedId = parseInt(verifiedHex, 16);
  if (verifiedId !== targetChainId) {
    const verifiedLabel = getChainLabel(verifiedId);
    throw new Error(`ネットワークが${targetLabel}ではありません（現在: ${verifiedLabel}）。MetaMaskで切り替えてください。`);
  }
};

export const getTxUrl = (txHash: string): string => {
  if (config.blockExplorerTxBase) {
    return `${config.blockExplorerTxBase}${txHash}`;
  }
  const chain = getChain();
  if (chain.blockExplorers?.default) {
    return `${chain.blockExplorers.default.url}/tx/${txHash}`;
  }
  return "";
};

export const getAddressUrl = (address: string): string => {
  const chain = getChain();
  if (chain.blockExplorers?.default) {
    return `${chain.blockExplorers.default.url}/address/${address}`;
  }
  return "";
};

export const STATUS_LABELS: Record<string, { ja: string; en: string; color: string }> = {
  open: { ja: "購入受付中", en: "Available", color: "success" },
  locked: { ja: "条件確認中", en: "Under Review", color: "warning" },
  active: { ja: "進行中", en: "In Progress", color: "info" },
  completed: { ja: "取引完了", en: "Completed", color: "default" },
};
