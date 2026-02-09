import { createPublicClient, http, type Address, formatUnits, type Chain } from "viem";
import { polygonAmoy, baseSepolia, base, sepolia } from "viem/chains";
import { FACTORY_ABI, ESCROW_ABI } from "@/lib/abi";
import { MILESTONE_NAMES } from "@/lib/constants";
import {
  CATEGORY_TYPE_MAP,
  type ListingDraft,
  type ListingSummaryForAgent,
  type MilestonePreview,
  type TxPrepareResult,
  type CategoryType,
} from "./types";

const TOOL_TIMEOUT_MS = 8_000;
const MAX_LISTINGS_FETCH = 50;
const CATEGORY_ALIASES: Record<string, CategoryType> = {
  wagyu: "wagyu",
  "和牛": "wagyu",
  sake: "sake",
  "日本酒": "sake",
  craft: "craft",
  crafts: "craft",
  "工芸": "craft",
  "工芸品": "craft",
  other: "other",
  "その他": "other",
};

function normalizeCategory(category?: string): CategoryType {
  if (!category) return "other";
  const normalized = category.trim().toLowerCase();
  return CATEGORY_ALIASES[normalized] ?? "other";
}

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

// Read escrow contract data and map to ListingSummaryForAgent
async function readEscrowSummary(
  client: ReturnType<typeof getClient>,
  escrowAddress: Address,
): Promise<ListingSummaryForAgent> {
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
}

// Wrap a promise with a timeout that returns partial result on expiry
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } finally {
    clearTimeout(timer!);
  }
}

// Fetch all listing addresses from factory (capped)
async function fetchAllListingAddresses(): Promise<Address[]> {
  const client = getClient();
  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address;
  if (!factoryAddress) throw new Error("Factory address not configured");

  const addresses = await client.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "getListings",
  }) as Address[];

  return addresses.slice(0, MAX_LISTINGS_FETCH);
}

// Fetch all listing summaries (with parallel reads)
async function fetchAllListingSummaries(): Promise<ListingSummaryForAgent[]> {
  const client = getClient();
  const addresses = await fetchAllListingAddresses();

  const results = await Promise.allSettled(
    addresses.map((addr) => readEscrowSummary(client, addr))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ListingSummaryForAgent> => r.status === "fulfilled")
    .map((r) => r.value);
}

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

  const addresses = await client.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "getListings",
  }) as Address[];

  const limit = params.limit || 10;
  const listings: ListingSummaryForAgent[] = [];

  for (const escrowAddress of addresses.slice(0, Math.min(addresses.length, limit * 2))) {
    try {
      const listing = await readEscrowSummary(client, escrowAddress);

      // Apply filters
      if (params.category && listing.category !== params.category.toLowerCase()) {
        continue;
      }
      if (params.status && listing.status !== params.status.toLowerCase()) {
        continue;
      }

      listings.push(listing);
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
  try {
    return await readEscrowSummary(client, params.escrowAddress as Address);
  } catch (e) {
    console.error(`Error getting listing detail:`, e);
    return null;
  }
}

export function getMilestonesForCategory(params: {
  category: string;
}): MilestonePreview[] {
  const categoryType = CATEGORY_TYPE_MAP[normalizeCategory(params.category)];
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
  const category = normalizeCategory(params.category);
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
  amount?: string;
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
        const category = normalizeCategory(params.draft.category);
        result.params = {
          categoryType: CATEGORY_TYPE_MAP[category],
          title: params.draft.title,
          description: params.draft.description,
          totalAmount: params.draft.totalAmount,
          imageURI: params.draft.imageURI || "",
        };
      }
      break;

    case "lock":
      result.requiresApproval = true;
      if (result.escrowAddress) {
        result.params = {
          escrowAddress: result.escrowAddress,
          ...(params.amount ? { amount: params.amount } : {}),
        };
      }
      break;

    case "approve":
    case "cancel":
    case "confirmDelivery":
      if (result.escrowAddress) {
        result.params = { escrowAddress: result.escrowAddress };
      }
      break;
  }

  return result;
}

// --- New agentic tools ---

interface MarketAnalysis {
  category: string;
  count: number;
  averagePrice: number;
  medianPrice: number;
  highestPrice: number;
  lowestPrice: number;
  statusBreakdown: Record<string, number>;
}

interface MarketAnalysisResult {
  analyses: MarketAnalysis[];
  partial?: boolean;
}

export async function analyzeMarket(params: {
  category?: string;
}): Promise<MarketAnalysisResult> {
  const doAnalysis = async () => {
    const listings = await fetchAllListingSummaries();

    const categories = params.category
      ? [params.category.toLowerCase()]
      : [...new Set(listings.map((l) => l.category))];

    const analyses: MarketAnalysis[] = categories.map((cat) => {
      const catListings = listings.filter((l) => l.category === cat);
      const prices = catListings.map((l) => parseFloat(l.totalAmount)).filter((p) => !isNaN(p));
      prices.sort((a, b) => a - b);

      const statusBreakdown: Record<string, number> = {};
      for (const l of catListings) {
        statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1;
      }

      const sum = prices.reduce((a, b) => a + b, 0);
      const median = prices.length > 0
        ? prices.length % 2 === 0
          ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
          : prices[Math.floor(prices.length / 2)]
        : 0;

      return {
        category: cat,
        count: catListings.length,
        averagePrice: prices.length > 0 ? Math.round(sum / prices.length) : 0,
        medianPrice: Math.round(median),
        highestPrice: prices.length > 0 ? prices[prices.length - 1] : 0,
        lowestPrice: prices.length > 0 ? prices[0] : 0,
        statusBreakdown,
      };
    });

    return { analyses };
  };

  return withTimeout<MarketAnalysisResult>(doAnalysis(), TOOL_TIMEOUT_MS, {
    analyses: [],
    partial: true,
  });
}

interface RiskAssessment {
  riskLevel: "low" | "medium" | "high";
  score: number;
  producerAddress: string;
  reasons: string[];
  stats: {
    totalListings: number;
    completed: number;
    cancelled: number;
    active: number;
    averageProgress: number;
  };
}

export async function assessRisk(params: {
  escrowAddress?: string;
  producerAddress?: string;
}): Promise<RiskAssessment> {
  const doAssess = async (): Promise<RiskAssessment> => {
    let producerAddr = params.producerAddress;

    // If escrowAddress given, first get the producer from it
    if (params.escrowAddress && !producerAddr) {
      const detail = await getListingDetail({ escrowAddress: params.escrowAddress });
      if (!detail) throw new Error("Listing not found");
      producerAddr = detail.producer;
    }

    if (!producerAddr) throw new Error("Producer address required");

    const allListings = await fetchAllListingSummaries();
    const producerListings = allListings.filter(
      (l) => l.producer.toLowerCase() === producerAddr!.toLowerCase()
    );

    const completed = producerListings.filter((l) => l.status === "completed").length;
    const cancelled = producerListings.filter((l) => l.status === "cancelled").length;
    const active = producerListings.filter((l) => l.status === "active").length;
    const total = producerListings.length;

    const progressValues = producerListings
      .filter((l) => l.progress.total > 0)
      .map((l) => l.progress.completed / l.progress.total);
    const avgProgress = progressValues.length > 0
      ? progressValues.reduce((a, b) => a + b, 0) / progressValues.length
      : 0;

    const reasons: string[] = [];
    let score = 50; // Start neutral

    if (total === 0) {
      reasons.push("出品実績がありません（新規出品者）");
      score = 60; // Slightly risky
    } else {
      const completionRate = completed / total;
      const cancelRate = cancelled / total;

      if (completionRate >= 0.8) {
        score -= 20;
        reasons.push(`高い完了率: ${Math.round(completionRate * 100)}%`);
      } else if (completionRate >= 0.5) {
        score -= 5;
        reasons.push(`完了率: ${Math.round(completionRate * 100)}%`);
      } else if (total > 1) {
        score += 15;
        reasons.push(`低い完了率: ${Math.round(completionRate * 100)}%`);
      }

      if (cancelRate > 0.3) {
        score += 20;
        reasons.push(`キャンセル率が高い: ${Math.round(cancelRate * 100)}%`);
      } else if (cancelRate > 0) {
        score += 5;
        reasons.push(`キャンセル履歴あり: ${cancelled}件`);
      }

      if (active > 3) {
        score += 10;
        reasons.push(`同時進行の出品が多い: ${active}件`);
      }

      if (avgProgress > 0.7) {
        score -= 10;
        reasons.push(`平均進捗率が高い: ${Math.round(avgProgress * 100)}%`);
      }
    }

    const riskLevel: RiskAssessment["riskLevel"] =
      score <= 35 ? "low" : score <= 60 ? "medium" : "high";

    return {
      riskLevel,
      score: Math.max(0, Math.min(100, score)),
      producerAddress: producerAddr,
      reasons,
      stats: {
        totalListings: total,
        completed,
        cancelled,
        active,
        averageProgress: Math.round(avgProgress * 100),
      },
    };
  };

  return withTimeout(doAssess(), TOOL_TIMEOUT_MS, {
    riskLevel: "medium",
    score: 50,
    producerAddress: params.producerAddress || params.escrowAddress || "",
    reasons: ["タイムアウトのため完全な分析ができませんでした。慎重に判断してください。"],
    stats: { totalListings: 0, completed: 0, cancelled: 0, active: 0, averageProgress: 0 },
  });
}

interface NextActionSuggestion {
  role: "producer" | "buyer" | "both" | "none";
  actions: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    description: string;
    escrowAddress?: string;
    title?: string;
  }>;
  summary: string;
}

export async function suggestNextAction(params: {
  userAddress: string;
}): Promise<NextActionSuggestion> {
  const doSuggest = async (): Promise<NextActionSuggestion> => {
    const allListings = await fetchAllListingSummaries();
    const addr = params.userAddress.toLowerCase();

    const asProducer = allListings.filter((l) => l.producer.toLowerCase() === addr);
    const asBuyer = allListings.filter((l) => l.buyer.toLowerCase() === addr);

    const actions: NextActionSuggestion["actions"] = [];

    // Producer actions
    for (const l of asProducer) {
      if (l.status === "active" && l.progress.completed < l.progress.total) {
        const isLast = l.progress.completed === l.progress.total - 1;
        actions.push({
          priority: "high",
          action: isLast ? "最終マイルストーン - 購入者の確認を待つ" : "マイルストーン完了報告",
          description: `「${l.title}」の次のマイルストーンを報告できます（${l.progress.completed}/${l.progress.total}完了）`,
          escrowAddress: l.escrowAddress,
          title: l.title,
        });
      }
      if (l.status === "open") {
        actions.push({
          priority: "low",
          action: "購入者待ち",
          description: `「${l.title}」は購入者を待っています`,
          escrowAddress: l.escrowAddress,
          title: l.title,
        });
      }
    }

    // Buyer actions
    for (const l of asBuyer) {
      if (l.status === "locked") {
        actions.push({
          priority: "high",
          action: "承認が必要",
          description: `「${l.title}」のマイルストーン開始を承認してください`,
          escrowAddress: l.escrowAddress,
          title: l.title,
        });
      }
      if (l.status === "active" && l.progress.completed === l.progress.total - 1) {
        actions.push({
          priority: "high",
          action: "納品確認が必要",
          description: `「${l.title}」の最終マイルストーンの納品確認をしてください`,
          escrowAddress: l.escrowAddress,
          title: l.title,
        });
      }
      if (l.status === "active") {
        actions.push({
          priority: "low",
          action: "進捗確認",
          description: `「${l.title}」は進行中です（${l.progress.completed}/${l.progress.total}完了）`,
          escrowAddress: l.escrowAddress,
          title: l.title,
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const isProducer = asProducer.length > 0;
    const isBuyer = asBuyer.length > 0;
    const role = isProducer && isBuyer ? "both" : isProducer ? "producer" : isBuyer ? "buyer" : "none";

    const highPriority = actions.filter((a) => a.priority === "high");
    const summary = highPriority.length > 0
      ? `緊急のアクションが${highPriority.length}件あります。`
      : actions.length > 0
        ? `${actions.length}件のアクティブな取引があります。`
        : "現在アクティブな取引はありません。新しい出品や購入を始めましょう。";

    return { role, actions, summary };
  };

  return withTimeout(doSuggest(), TOOL_TIMEOUT_MS, {
    role: "none",
    actions: [],
    summary: "タイムアウトのため状況を完全に取得できませんでした。もう一度お試しください。",
  });
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

    case "analyze_market":
      return analyzeMarket(args as Parameters<typeof analyzeMarket>[0]);

    case "assess_risk":
      return assessRisk(args as Parameters<typeof assessRisk>[0]);

    case "suggest_next_action":
      return suggestNextAction(args as Parameters<typeof suggestNextAction>[0]);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
