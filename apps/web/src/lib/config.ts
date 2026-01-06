import { http, createPublicClient, createWalletClient, custom, type Address, type Chain } from "viem";
import { sepolia, baseSepolia, polygonAmoy, base } from "viem/chains";

// Supported chains
export const SUPPORTED_CHAINS = Object.freeze({
  [sepolia.id]: sepolia as Chain,
  [baseSepolia.id]: baseSepolia as Chain,
  [base.id]: base as Chain,
  [polygonAmoy.id]: polygonAmoy as Chain,
});

// Environment variables
export const config = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "",
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "80002"),
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
  return SUPPORTED_CHAINS[chainId] || polygonAmoy;
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
  const ethereum = window.ethereum as { isMetaMask?: boolean };
  return !!ethereum.isMetaMask;
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

  const ethereum = window.ethereum as typeof window.ethereum & {
    providers?: Array<typeof window.ethereum & { isMetaMask?: boolean }>;
    isMetaMask?: boolean;
  };

  // 複数のウォレットがインストールされている場合
  if (ethereum.providers?.length) {
    const metaMask = ethereum.providers.find((p) => p.isMetaMask);
    if (metaMask) return metaMask;
  }

  // 単体のMetaMaskの場合
  if (ethereum.isMetaMask) {
    return ethereum;
  }

  return ethereum;
};

export const createWallet = () => {
  const provider = getMetaMaskProvider();
  if (!provider) {
    return null;
  }
  const chain = getChain();
  return createWalletClient({
    chain,
    transport: custom(provider),
  });
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
  open: { ja: "出品中", en: "Open", color: "success" },
  locked: { ja: "承認待ち", en: "Pending Approval", color: "warning" },
  active: { ja: "進行中", en: "Active", color: "info" },
  completed: { ja: "完了", en: "Completed", color: "default" },
  cancelled: { ja: "キャンセル", en: "Cancelled", color: "error" },
};
