import { http, createPublicClient, createWalletClient, custom, type Address, type Chain } from "viem";
import { sepolia, baseSepolia, polygonAmoy, base, avalancheFuji } from "viem/chains";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  providers?: unknown[];
};

const isEthereumProvider = (value: unknown): value is EthereumProvider => {
  if (!value || typeof value !== "object") return false;
  return typeof (value as { request?: unknown }).request === "function";
};

// Supported chains
export const SUPPORTED_CHAINS = Object.freeze({
  [sepolia.id]: sepolia as Chain,
  [baseSepolia.id]: baseSepolia as Chain,
  [base.id]: base as Chain,
  [polygonAmoy.id]: polygonAmoy as Chain,
  [avalancheFuji.id]: avalancheFuji as Chain,
});

// Environment variables
export const config = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "",
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "43113"),
  // v2: Factory address (replaces single contract address)
  factoryAddress: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || "") as Address,
  tokenAddress: (process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "") as Address,
  blockExplorerTxBase: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE || "",
  // Legacy: for backward compatibility
  contractAddress: (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "") as Address,
};

export const getChain = (): Chain => {
  // Ensure config.chainId is of a valid type and guard against type errors
  const chainId = config.chainId as keyof typeof SUPPORTED_CHAINS;
  return SUPPORTED_CHAINS[chainId] || avalancheFuji;
};

export const createClient = () => {
  const chain = getChain();
  return createPublicClient({
    chain,
    transport: http(config.rpcUrl || undefined),
  });
};

// モバイルデバイス検出
export const isMobile = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

// MetaMaskアプリ内ブラウザかどうか判定
export const isMetaMaskBrowser = (): boolean => {
  if (typeof window === "undefined" || !window.ethereum) {
    return false;
  }
  const ethereum = window.ethereum as unknown;
  return isEthereumProvider(ethereum) && !!ethereum.isMetaMask;
};

// MetaMask Deep Linkを開く（モバイルブラウザ用）
export const openMetaMaskDeepLink = (): void => {
  if (typeof window === "undefined") return;

  // 現在のURLからホスト名とパスを取得
  const dappUrl = window.location.href.replace(/^https?:\/\//, "");

  // MetaMask Deep Link
  const deepLink = `https://metamask.app.link/dapp/${dappUrl}`;

  window.location.href = deepLink;
};

// MetaMaskプロバイダーを明示的に取得
export const getMetaMaskProvider = (): typeof window.ethereum | null => {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  const injected = window.ethereum as unknown;
  const rawProviders =
    injected && typeof injected === "object"
      ? (injected as EthereumProvider).providers
      : undefined;

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

const FALLBACK_CHAIN_LABELS: Record<number, string> = {
  1: "Ethereum Mainnet",
};

const getChainLabel = (chainId: number): string => {
  const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
  return chain?.name || FALLBACK_CHAIN_LABELS[chainId] || `Chain ID ${chainId}`;
};

export const ensureWalletChain = async (provider: typeof window.ethereum): Promise<void> => {
  if (!provider) {
    throw new Error("MetaMaskが見つかりません");
  }
  const targetChain = getChain();
  const targetChainId = config.chainId;
  const targetChainHex = `0x${targetChainId.toString(16)}`;

  const currentChainHex = await provider.request({ method: "eth_chainId" }) as string;
  const currentChainId = parseInt(currentChainHex, 16);

  if (currentChainId === targetChainId) {
    return;
  }

  const targetLabel = targetChain?.name || `Chain ID ${targetChainId}`;
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
              blockExplorerUrls: targetChain.blockExplorers
                ? [targetChain.blockExplorers.default.url]
                : undefined,
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

  const verifiedHex = await provider.request({ method: "eth_chainId" }) as string;
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

// Category labels
export const CATEGORY_LABELS: Record<string, { ja: string; en: string }> = {
  wagyu: { ja: "和牛", en: "Wagyu" },
  sake: { ja: "日本酒", en: "Sake" },
  craft: { ja: "工芸品", en: "Craft" },
};

// Status labels (V6: added locked)
export const STATUS_LABELS: Record<string, { ja: string; en: string; color: string }> = {
  open: { ja: "購入受付中", en: "Available", color: "success" },
  locked: { ja: "条件確認中", en: "Under Review", color: "warning" },
  active: { ja: "進行中", en: "In Progress", color: "info" },
  completed: { ja: "取引完了", en: "Completed", color: "default" },
  cancelled: { ja: "キャンセル済", en: "Cancelled", color: "error" },
};
