import { http, createPublicClient, type Address, type Chain } from "viem";
import { baseSepolia, polygon, polygonAmoy, sepolia } from "viem/chains";

export type StablecoinSymbol = "JPYC" | "USDC";

export type StablecoinConfig = {
  currency: StablecoinSymbol;
  symbol: StablecoinSymbol;
  decimals: number;
  tokenAddress: Address;
  factoryAddress: Address;
};

const emptyAddress = "" as Address;
const defaultSepoliaJpycTokenAddress = "0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB" as Address;
const defaultSepoliaUsdcTokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;

const SUPPORTED_CHAINS = Object.freeze({
  [sepolia.id]: sepolia as Chain,
  [baseSepolia.id]: baseSepolia as Chain,
  [polygonAmoy.id]: polygonAmoy as Chain,
  [polygon.id]: polygon as Chain,
});

const config = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "",
  chainId: parseInt(
    process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || String(sepolia.id),
    10,
  ),
  blockExplorerTxBase: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE || "",
};

const defaultTokenAddressForCurrentChain = (token: StablecoinSymbol): Address => {
  if (config.chainId === sepolia.id) {
    return token === "JPYC" ? defaultSepoliaJpycTokenAddress : defaultSepoliaUsdcTokenAddress;
  }
  return emptyAddress;
};

export const STABLECOINS = Object.freeze({
  JPYC: {
    currency: "JPYC",
    symbol: "JPYC",
    decimals: 18,
    tokenAddress: (process.env.NEXT_PUBLIC_JPYC_TOKEN_ADDRESS || defaultTokenAddressForCurrentChain("JPYC")) as Address,
    factoryAddress: (process.env.NEXT_PUBLIC_JPYC_FACTORY_ADDRESS || "") as Address,
  },
  USDC: {
    currency: "USDC",
    symbol: "USDC",
    decimals: 6,
    tokenAddress: (process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || defaultTokenAddressForCurrentChain("USDC")) as Address,
    factoryAddress: (process.env.NEXT_PUBLIC_USDC_FACTORY_ADDRESS || "") as Address,
  },
} satisfies Record<StablecoinSymbol, StablecoinConfig>);

const SEPOLIA_ONLY_TOKEN_ADDRESSES = new Set<string>([
  defaultSepoliaJpycTokenAddress.toLowerCase(),
  defaultSepoliaUsdcTokenAddress.toLowerCase(),
]);
const SEPOLIA_EXPLORER_PATTERNS = [/sepolia\.etherscan\.io/i];

const assertChainAddressConsistency = (): void => {
  if (config.chainId === sepolia.id) return;
  const chainLabel = SUPPORTED_CHAINS[config.chainId as keyof typeof SUPPORTED_CHAINS]?.name
    ?? `chain ${config.chainId}`;
  for (const token of Object.values(STABLECOINS) as StablecoinConfig[]) {
    if (!token.tokenAddress) continue;
    if (SEPOLIA_ONLY_TOKEN_ADDRESSES.has(token.tokenAddress.toLowerCase())) {
      throw new Error(
        `${token.symbol} token address (${token.tokenAddress}) is the Sepolia default but ` +
        `NEXT_PUBLIC_CHAIN_ID is ${config.chainId} (${chainLabel}). Set the ${token.symbol} ` +
        `address for ${chainLabel} via NEXT_PUBLIC_${token.symbol}_TOKEN_ADDRESS, or unset it.`,
      );
    }
  }
  if (
    config.blockExplorerTxBase &&
    SEPOLIA_EXPLORER_PATTERNS.some((pattern) => pattern.test(config.blockExplorerTxBase))
  ) {
    throw new Error(
      `NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE points to a Sepolia explorer ` +
      `(${config.blockExplorerTxBase}) but NEXT_PUBLIC_CHAIN_ID is ${config.chainId} ` +
      `(${chainLabel}). Update the explorer URL to match the active chain.`,
    );
  }
};

assertChainAddressConsistency();

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

export const getDefaultStablecoin = (): StablecoinConfig =>
  getConfiguredStablecoins()[0] ?? {
    ...STABLECOINS.JPYC,
    tokenAddress: STABLECOINS.JPYC.tokenAddress || emptyAddress,
    factoryAddress: STABLECOINS.JPYC.factoryAddress || emptyAddress,
  };

export const getChain = (): Chain => {
  const chain = SUPPORTED_CHAINS[config.chainId as keyof typeof SUPPORTED_CHAINS];
  if (!chain) {
    throw new Error(`Unsupported chain ID ${config.chainId}. Use Sepolia, Base Sepolia, Polygon Amoy, or Polygon mainnet.`);
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
