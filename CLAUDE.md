# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発の進め方

開発を進める際は `UPGRADE_PLAN.md` を参照すること。実装タスクと優先順位が記載されている。

## プロジェクト概要

Wagyu Milestone Escrow - 和牛・日本酒・工芸品を出品できる分散型マーケットプレイスdApp。マイルストーン完了ごとにJPYCが生産者へ自動送金される。管理者不在のトラストレス設計。

**コンセプト**: 1出品 = 1 Escrowコントラクト = 1 NFT。生産者がマイルストーン完了を自己申告し、即座に支払いが発生。

**主要機能**:
- マイルストーン開始前の購入者承認フロー (`approve()`)
- LOCKED状態でのキャンセル・全額返金 (`cancel()`)
- Producer/Buyer間のXMTPチャット（メールアドレス不要）
- 最終マイルストーンは購入者確認が必要 (`confirmDelivery()`)
- Dynamic NFT（オンチェーンメタデータ/SVG画像API）

## ビルド・実行コマンド

### スマートコントラクト (Foundry)

```bash
# ビルド
forge build

# テスト
forge test

# デプロイ（例）
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

Remix IDEでの手動デプロイも可能。

### dApp

```bash
cd apps/web
pnpm install
pnpm dev          # ローカル開発 (http://localhost:3000)
pnpm dev:turbo    # Turbopackモード
pnpm build        # 本番ビルド
pnpm lint         # ESLintチェック
```

## アーキテクチャ

```
hackathon/
├── contracts/                  # Solidityスマートコントラクト
│   ├── ListingFactoryV6.sol    # ERC721 Factory + MilestoneEscrowV6（現行）
│   ├── ListingFactoryV5.sol    # 旧バージョン
│   └── MockERC20.sol           # テスト用トークン
├── apps/web/                   # Next.js 15 dApp (App Router)
│   └── src/
│       ├── app/                # ルートとAPI
│       │   ├── api/nft/        # Dynamic NFTメタデータ/画像API
│       │   ├── listing/[address]/ # 出品詳細ページ
│       │   ├── my/             # マイページ
│       │   └── agent/          # AIエージェント画面
│       ├── components/         # UIコンポーネント
│       ├── hooks/              # useXmtpChat, useAgentSession
│       └── lib/
│           ├── hooks.ts        # 全コントラクトhooks（viem）
│           ├── abi.ts          # コントラクトABI
│           ├── config.ts       # チェーン/RPC設定
│           ├── xmtp.ts         # XMTPクライアント
│           └── i18n.ts         # 国際化（日/英）
├── lib/                        # OpenZeppelin contracts（submodule）
└── foundry.toml                # Foundry設定
```

### コントラクト状態遷移

```
OPEN → lock() → LOCKED → approve() → ACTIVE → submit() × N → confirmDelivery() → COMPLETED
                   ↓
               cancel() → CANCELLED（全額返金）
```

### 主要コントラクト関数

| 関数 | 呼び出し者 | 必要な状態 | 説明 |
|------|-----------|-----------|------|
| `lock()` | 誰でも | OPEN | 購入者がJPYC支払い、NFT受領 |
| `approve()` | Buyer | LOCKED | マイルストーン開始 |
| `cancel()` | Buyer | LOCKED | 全額返金 |
| `submit(index)` | Producer | ACTIVE | マイルストーン完了（最終以外） |
| `confirmDelivery()` | Buyer | ACTIVE | 最終マイルストーン確認 |

### フロントエンドHooks (src/lib/hooks.ts)

全hooksはviemベースで単一ファイルにエクスポート:

```typescript
// Factory操作
useCreateListing(), useListings(), useListingSummaries()

// Escrow操作
useEscrowInfo(address), useMilestones(address)
useEscrowActions(address) → { lock, approve, cancel, submit, confirmDelivery, txStep }
useEscrowEvents(address)

// トークン操作
useTokenBalance(address), useTokenAllowance(owner, spender)
usePurchaseValidation(user, escrow, amount)

// リアルタイムポーリング
useRealtimeEscrow(address), useRealtimeListingSummaries()
useMyListings(address)
```

## 環境変数

```bash
# 必須
NEXT_PUBLIC_RPC_URL=             # RPCエンドポイント（Sepolia/Base Sepolia/Polygon Amoy）
NEXT_PUBLIC_CHAIN_ID=11155111    # チェーンID
NEXT_PUBLIC_FACTORY_ADDRESS=     # ListingFactoryV6アドレス
NEXT_PUBLIC_TOKEN_ADDRESS=       # ERC20トークンアドレス

# オプション
NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE=  # 例: https://sepolia.etherscan.io/tx/
NEXT_PUBLIC_XMTP_ENV=dev             # XMTP環境（dev または production）
GEMINI_API_KEY=                      # AIエージェント機能用
GEMINI_MODEL=gemini-2.5-flash-preview-05-20
```

## マイルストーンテンプレート (bps, 10000=100%)

**wagyu** (11ステップ): 素牛導入(300) → ... → 納品完了(4000★)
**sake** (5ステップ): 仕込み(1000) → ... → 出荷(4000★)
**craft** (4ステップ): 制作開始(1000) → ... → 仕上げ(4500★)

★ = `confirmDelivery()`による購入者確認が必要

## デプロイ手順

1. MockERC20をデプロイ（または既存ERC20を使用）
2. ListingFactoryV6を `(tokenAddress, baseURI)` でデプロイ
3. `.env.local`に環境変数を設定
4. dAppをVercelにデプロイ
