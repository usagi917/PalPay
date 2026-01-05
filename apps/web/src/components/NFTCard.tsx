"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";

interface NFTCardProps {
  tokenId?: number;
}

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export function NFTCard({ tokenId = 1 }: NFTCardProps) {
  const { t } = useI18n();
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/nft/${tokenId}?t=${Date.now()}`);
        if (!response.ok) throw new Error("Failed to fetch metadata");
        const data = await response.json();
        setMetadata(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading NFT");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [tokenId, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="card p-5 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="skeleton w-9 h-9 rounded-lg" />
          <div className="skeleton w-32 h-5" />
        </div>
        <div className="skeleton w-full aspect-[4/5] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-5 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[#FFEBEE] flex items-center justify-center">
            <svg
              className="w-4 h-4 text-[var(--color-error)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="section-title">Dynamic NFT</h2>
        </div>
        <p className="text-sm text-[var(--color-error)]">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 btn btn-ghost text-sm"
        >
          {t("refresh")}
        </button>
      </div>
    );
  }

  return (
    <div className="card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-secondary)] flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="section-title">Dynamic NFT</h2>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-lg hover:bg-[var(--color-surface-variant)] transition-colors"
          title={t("refresh")}
        >
          <svg
            className="w-4 h-4 text-[var(--color-text-muted)]"
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

      {metadata && (
        <>
          {/* NFT Image */}
          <div className="relative rounded-xl overflow-hidden bg-[var(--color-surface-variant)] mb-4">
            <Image
              src={`${metadata.image}?t=${refreshKey}`}
              alt={metadata.name}
              width={420}
              height={720}
              sizes="(max-width: 1280px) 100vw, 50vw"
              className="w-full h-auto"
              unoptimized
            />
          </div>

        </>
      )}
    </div>
  );
}
