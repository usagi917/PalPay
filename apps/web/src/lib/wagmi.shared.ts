import { cookieStorage, createStorage, http } from "wagmi";
import { baseSepolia, polygon, polygonAmoy, sepolia } from "wagmi/chains";
import { getChain } from "./config";

export const supportedChains = [sepolia, baseSepolia, polygonAmoy, polygon] as const;

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || undefined;
const activeChainId = getChain().id;

export const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || undefined;

const transportFor = (chainId: number) =>
  chainId === activeChainId ? http(rpcUrl) : http();

export const wagmiStorage = createStorage({ storage: cookieStorage });

export const wagmiBaseConfig = {
  chains: supportedChains,
  multiInjectedProviderDiscovery: true,
  ssr: true,
  storage: wagmiStorage,
  transports: {
    [sepolia.id]: transportFor(sepolia.id),
    [baseSepolia.id]: transportFor(baseSepolia.id),
    [polygonAmoy.id]: transportFor(polygonAmoy.id),
    [polygon.id]: transportFor(polygon.id),
  },
};
