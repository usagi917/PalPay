import { createPublicClient, http, type Address, formatUnits, type Chain } from "viem";
import { polygonAmoy, baseSepolia, base, sepolia } from "viem/chains";
import { FACTORY_ABI, ESCROW_ABI } from "@/lib/abi";
import { MILESTONE_NAMES } from "@/lib/constants";
import type {
  ListingDraft,
  ListingSummaryForAgent,
  MilestonePreview,
  TxPrepareResult,
  CategoryType,
} from "./types";

// Get chain from environment
function getChain(): Chain {
  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "80002");
  const chains: Record<number, Chain> = {
    11155111: sepolia,
    84532: baseSepolia,
    8453: base,
    80002: polygonAmoy,
  };
  return chains[chainId] || polygonAmoy;
}

// Create public client for reading blockchain
function getClient() {
  const chain = getChain();
  return createPublicClient({
    chain,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || undefined),
  });
}

// Category type mapping
const categoryTypeMap: Record<string, number> = {
  wagyu: 0,
  sake: 1,
  craft: 2,
};

// Tool implementations
export async function getListings(params: {
  category?: string;
  status?: string;
  limit?: number;
}): Promise<ListingSummaryForAgent[]> {
  const client = getClient();
  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address;

  if (!factoryAddress) {
    throw new Error("Factory address not configured");
  }

  // Get all listing addresses
  const addresses = await client.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "getListings",
  }) as Address[];

  const limit = params.limit || 10;
  const listings: ListingSummaryForAgent[] = [];

  for (const escrowAddress of addresses.slice(0, Math.min(addresses.length, limit * 2))) {
    try {
      // Get core info
      const [core, meta, progress] = await Promise.all([
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "getCore",
        }) as Promise<[Address, Address, Address, Address, bigint, bigint, bigint, number]>,
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "getMeta",
        }) as Promise<[string, string, string, string, string]>,
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "getProgress",
        }) as Promise<[bigint, bigint]>,
      ]);

      const [, , producer, buyer, tokenId, totalAmount] = core;
      const [category, title, description, imageURI, statusStr] = meta;
      const [completed, total] = progress;

      const status = statusStr.toLowerCase();
      const categoryLower = category.toLowerCase();

      // Apply filters
      if (params.category && categoryLower !== params.category.toLowerCase()) {
        continue;
      }
      if (params.status && status !== params.status.toLowerCase()) {
        continue;
      }

      listings.push({
        escrowAddress,
        tokenId: tokenId.toString(),
        producer,
        buyer,
        totalAmount: formatUnits(totalAmount, 18),
        status,
        category: categoryLower,
        title,
        description,
        imageURI,
        progress: {
          completed: Number(completed),
          total: Number(total),
        },
      });

      if (listings.length >= limit) break;
    } catch (e) {
      console.error(`Error reading listing ${escrowAddress}:`, e);
    }
  }

  return listings;
}

export async function getListingDetail(params: {
  escrowAddress: string;
  tokenId?: string;
}): Promise<ListingSummaryForAgent | null> {
  const client = getClient();
  const escrowAddress = params.escrowAddress as Address;

  try {
    const [core, meta, progress] = await Promise.all([
      client.readContract({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "getCore",
      }) as Promise<[Address, Address, Address, Address, bigint, bigint, bigint, number]>,
      client.readContract({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "getMeta",
      }) as Promise<[string, string, string, string, string]>,
      client.readContract({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "getProgress",
      }) as Promise<[bigint, bigint]>,
    ]);

    const [, , producer, buyer, tokenId, totalAmount] = core;
    const [category, title, description, imageURI, statusStr] = meta;
    const [completed, total] = progress;

    return {
      escrowAddress,
      tokenId: tokenId.toString(),
      producer,
      buyer,
      totalAmount: formatUnits(totalAmount, 18),
      status: statusStr.toLowerCase(),
      category: category.toLowerCase(),
      title,
      description,
      imageURI,
      progress: {
        completed: Number(completed),
        total: Number(total),
      },
    };
  } catch (e) {
    console.error(`Error getting listing detail:`, e);
    return null;
  }
}

export function getMilestonesForCategory(params: {
  category: string;
}): MilestonePreview[] {
  const categoryType = categoryTypeMap[params.category.toLowerCase()] ?? 3;
  const names = MILESTONE_NAMES[categoryType] || MILESTONE_NAMES[3];

  // Default BPS distribution (basis points, total = 10000)
  const bpsDistributions: Record<number, number[]> = {
    0: [500, 500, 800, 800, 800, 800, 800, 800, 1000, 1500, 1700], // wagyu: 11 milestones
    1: [2000, 2000, 2500, 1500, 2000], // sake: 5 milestones
    2: [2500, 2500, 2500, 2500], // craft: 4 milestones
    3: [10000], // other: 1 milestone
  };

  const bps = bpsDistributions[categoryType] || bpsDistributions[3];

  return names.map((name, index) => ({
    name,
    bps: bps[index] || Math.floor(10000 / names.length),
    description: `${name}完了時に${(bps[index] || Math.floor(10000 / names.length)) / 100}%の支払いが実行されます`,
  }));
}

export function prepareListingDraft(params: {
  category: string;
  title: string;
  description: string;
  totalAmount: string;
  imageURI?: string;
}): ListingDraft {
  const category = params.category.toLowerCase() as CategoryType;
  const milestones = getMilestonesForCategory({ category });

  return {
    category,
    title: params.title,
    description: params.description,
    totalAmount: params.totalAmount,
    imageURI: params.imageURI,
    milestones,
  };
}

export function prepareTransaction(params: {
  action: string;
  escrowAddress?: string;
  draft?: Partial<ListingDraft>;
}): TxPrepareResult {
  const action = params.action as TxPrepareResult["action"];

  const result: TxPrepareResult = {
    action,
  };

  if (params.escrowAddress) {
    result.escrowAddress = params.escrowAddress as Address;
  }

  switch (action) {
    case "createListing":
      if (params.draft) {
        result.params = {
          categoryType: categoryTypeMap[params.draft.category || "wagyu"],
          title: params.draft.title,
          description: params.draft.description,
          totalAmount: params.draft.totalAmount,
          imageURI: params.draft.imageURI || "",
        };
      }
      break;

    case "lock":
      result.requiresApproval = true;
      break;

    case "approve":
    case "cancel":
    case "confirmDelivery":
      // These just need the escrow address
      break;
  }

  return result;
}

// Execute tool by name
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "get_listings":
      return getListings(args as Parameters<typeof getListings>[0]);

    case "get_listing_detail":
      return getListingDetail(args as Parameters<typeof getListingDetail>[0]);

    case "get_milestones_for_category":
      return getMilestonesForCategory(args as Parameters<typeof getMilestonesForCategory>[0]);

    case "prepare_listing_draft":
      return prepareListingDraft(args as Parameters<typeof prepareListingDraft>[0]);

    case "prepare_transaction":
      return prepareTransaction(args as Parameters<typeof prepareTransaction>[0]);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
