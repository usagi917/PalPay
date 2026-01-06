import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { polygonAmoy } from "viem/chains";
import { FACTORY_ABI, ESCROW_ABI, ERC20_ABI } from "@/lib/abi";
import { SUPPORTED_CHAINS, CATEGORY_LABELS } from "@/lib/config";

const resolveChain = () => {
  const chainId = Number(
    process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || polygonAmoy.id
  );
  const chainKey = chainId as keyof typeof SUPPORTED_CHAINS;
  return SUPPORTED_CHAINS[chainKey] ?? polygonAmoy;
};

const normalizeDecimals = (decimals: bigint | number): number =>
  typeof decimals === "bigint" ? Number(decimals) : decimals;

const formatTokenAmount = (amount: bigint, decimalsInput: bigint | number) => {
  const decimals = normalizeDecimals(decimalsInput);
  if (decimals <= 0) return amount.toString();
  const divisor = 10n ** BigInt(decimals);
  return (amount / divisor).toString();
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  try {
    const { tokenId } = await params;
    const tokenIdNum = parseInt(tokenId);

    if (isNaN(tokenIdNum) || tokenIdNum < 0) {
      return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address;

    if (!rpcUrl || !factoryAddress) {
      return NextResponse.json({ error: "Missing configuration" }, { status: 500 });
    }

    const client = createPublicClient({
      chain: resolveChain(),
      transport: http(rpcUrl),
    });

    // Get escrow address from factory
    const escrowAddress = await client.readContract({
      address: factoryAddress,
      abi: FACTORY_ABI,
      functionName: "tokenIdToEscrow",
      args: [BigInt(tokenIdNum)],
    }) as Address;

    if (escrowAddress === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    // Get escrow info (split into core and meta)
    const [core, meta, progress] = await Promise.all([
      client.readContract({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "getCore",
      }),
      client.readContract({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "getMeta",
      }),
      client.readContract({
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: "getProgress",
      }),
    ]) as [
      [Address, Address, Address, Address, bigint, bigint, bigint, number],
      [string, string, string, string, string],
      [bigint, bigint]
    ];

    const [, tokenAddress, producer, buyer, , totalAmount, releasedAmount, statusEnum] = core;
    const [category, title, description, imageURI, status] = meta;
    const [completedCount, totalCount] = progress;
    const progressPercent = totalCount > 0n
      ? Number((completedCount * 100n) / totalCount)
      : 0;

    // Get token info
    const [symbol, decimals] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "symbol",
      }),
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "decimals",
      }),
    ]) as [string, bigint | number];

    // Determine status label
    const statusLabels: Record<string, string> = {
      open: "Open",
      active: "In Progress",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    const statusLabel = statusLabels[status] || status;

    // Category label
    const categoryLabel = CATEGORY_LABELS[category]?.en || category;

    // Build attributes
    const attributes = [
      { trait_type: "Category", value: categoryLabel },
      { trait_type: "Status", value: statusLabel },
      { trait_type: "Progress", value: `${progressPercent}%` },
      { trait_type: "Milestones Completed", value: Number(completedCount) },
      { trait_type: "Total Milestones", value: Number(totalCount) },
      { trait_type: "Total Amount", value: `${formatTokenAmount(totalAmount, decimals)} ${symbol}` },
      { trait_type: "Released Amount", value: `${formatTokenAmount(releasedAmount, decimals)} ${symbol}` },
      { trait_type: "Token", value: symbol },
      { trait_type: "Producer", value: producer },
    ];

    if (statusEnum >= 1 && buyer !== "0x0000000000000000000000000000000000000000") {
      attributes.push({ trait_type: "Buyer", value: buyer });
    }

    // Build metadata
    const baseUrl = request.nextUrl.origin;
    const metadata = {
      name: title || `Listing #${tokenId.padStart(3, "0")}`,
      description: description || `Milestone-based escrow for ${categoryLabel}. Progress: ${progressPercent}% (${completedCount}/${totalCount} milestones completed).`,
      image: imageURI || `${baseUrl}/api/nft/${tokenId}/image`,
      external_url: `${baseUrl}/listing/${escrowAddress}`,
      attributes,
    };

    return NextResponse.json(metadata, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("NFT metadata error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 }
    );
  }
}
