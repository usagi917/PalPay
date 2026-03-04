"use client";

import { useState } from "react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";

interface HeroNFTProps {
  tokenId?: number;
  factoryAddress?: string;
}

export function HeroNFT({ tokenId = 1, factoryAddress }: HeroNFTProps) {
  const { t } = useI18n();
  const [refreshKey, setRefreshKey] = useState(0);
  const query = factoryAddress
    ? `?factoryAddress=${encodeURIComponent(factoryAddress)}&t=${refreshKey}`
    : `?t=${refreshKey}`;

  return (
    <div className="hero-nft-frame">
      <Image
        src={`/api/nft/${tokenId}/image${query}`}
        alt="Dynamic NFT"
        width={420}
        height={720}
        sizes="(max-width: 768px) 70vw, 380px"
        className="hero-nft-image"
        unoptimized
      />
      <button
        type="button"
        onClick={() => setRefreshKey((prev) => prev + 1)}
        className="hero-nft-refresh"
        title={t("refresh")}
        aria-label={t("refresh")}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
  );
}
