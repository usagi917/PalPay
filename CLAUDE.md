# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発の進め方

開発を進める際は `plans/whimsical-pondering-swing.md` を参照すること。第4回 Agentic AI Hackathon with Google Cloud 応募に向けた改善計画・日別スケジュールが記載されている。

**応募カテゴリ**: 2. 業務システム
**期限**: 2026年2月15日
**ブロッカー**:
1. ~~`@google/generative-ai` → `@google/genai` (Vertex AI) へのSDK移行~~ **完了**
2. ~~Cloud Runデプロイ（Dockerfile + standalone出力）~~ **実装済み（デプロイ待ち）**
3. 提出物準備（Zenn記事・デモ動画・アーキテクチャ図）

## プロジェクト概要

Proof of Trust - 和牛・日本酒・工芸品を出品できる分散型マーケットプレイスdApp。マイルストーン完了ごとにJPYCが生産者へ自動送金される。管理者不在のトラストレス設計。

**コンセプト**: 1出品 = 1 Escrowコントラクト = 1 NFT。生産者がマイルストーン完了を自己申告し、即座に支払いが発生。

**主要機能**:
- マイルストーン開始前の購入者承認フロー (`approve()`)
- LOCKED状態でのキャンセル・全額返金 (`cancel()`)
- Producer/Buyer間のXMTPチャット（メールアドレス不要）
- 最終マイルストーンは購入者確認が必要 (`confirmDelivery()`)
- Dynamic NFT（オンチェーンメタデータ/SVG画像API）
- AIエージェント（Vertex AI Gemini 2.5 Flash + Function Calling）

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
│           ├── i18n.ts         # 国際化（日/英）
│           └── agent/          # AIエージェント
│               ├── gemini.ts   # @google/genai SDK初期化・チャットセッション
│               ├── tools.ts    # Function Callingツール定義・実行
│               └── prompts.ts  # システムプロンプト
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

## AIエージェントツール

`@google/genai` SDK（Vertex AIバックエンド）でFunction Callingを使用。ツール定義は `parametersJsonSchema` (JSON Schema形式) を使用。

| ツール | 説明 | 種別 |
|--------|------|------|
| `get_listings` | 全出品一覧を取得 | read-only |
| `get_listing_detail` | 出品詳細・マイルストーン情報を取得 | read-only |
| `prepare_listing_draft` | 出品ドラフトを生成（UIに表示） | draft |
| `get_milestones_for_category` | カテゴリ別テンプレートを取得 | read-only |
| `prepare_transaction` | トランザクション準備（署名前確認UI） | action |
| `analyze_market` | カテゴリ別の市場分析・価格提案 | read-only |
| `assess_risk` | 購入リスク評価（出品者実績分析） | read-only |
| `suggest_next_action` | ユーザーへのプロアクティブ提案 | read-only |

## 環境変数

```bash
# 必須
NEXT_PUBLIC_RPC_URL=             # RPCエンドポイント（Sepolia/Base Sepolia/Polygon Amoy/Avalanche Fuji）
NEXT_PUBLIC_CHAIN_ID=43113       # チェーンID（デフォルト: Avalanche Fuji）
NEXT_PUBLIC_FACTORY_ADDRESS=     # ListingFactoryV6アドレス
NEXT_PUBLIC_TOKEN_ADDRESS=       # ERC20トークンアドレス

# Google Cloud（Vertex AI）
GCP_PROJECT_ID=                  # GCPプロジェクトID
GCP_LOCATION=      # Vertex AIリージョン
GEMINI_MODEL=gemini-2.5-flash

# オプション
NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE=  # 例: https://testnet.snowtrace.io/tx/
NEXT_PUBLIC_XMTP_ENV=dev             # XMTP環境（dev または production）
```

**認証**: Cloud Run上ではADC（Application Default Credentials）が自動適用。ローカル開発は `gcloud auth application-default login` を実行。

## マイルストーンテンプレート (bps, 10000=100%)

**wagyu** (11ステップ): 素牛導入(300) → ... → 納品完了(4000★)
**sake** (5ステップ): 仕込み(1000) → ... → 出荷(4000★)
**craft** (4ステップ): 制作開始(1000) → ... → 仕上げ(4500★)

★ = `confirmDelivery()`による購入者確認が必要

## デプロイ手順

### スマートコントラクト
1. MockERC20をデプロイ（または既存ERC20を使用）
2. ListingFactoryV6を `(tokenAddress, baseURI)` でデプロイ

### dApp（Cloud Run）
1. `apps/web/next.config.ts` に `output: "standalone"` を設定
2. `apps/web/Dockerfile` でマルチステージビルド（pnpm対応）
3. GCPサービスアカウントに `roles/aiplatform.user` を付与
4. デプロイ:
```bash
cd apps/web
gcloud builds submit --tag gcr.io/$PROJECT_ID/wagyu-escrow
gcloud run deploy wagyu-escrow \
  --image gcr.io/$PROJECT_ID/wagyu-escrow \
  --platform managed --region us-central1 \
  --allow-unauthenticated --memory 512Mi
```

**注意**: `NEXT_PUBLIC_*` 環境変数はビルド時に埋め込まれる。Cloud Buildの `--substitutions` か `.env.production` で対応。

## Avalanche Fuji テストネット情報

**現在のデフォルトチェーン**: Avalanche Fuji（Avalanche Build Games 2026 対応）

| 項目 | 値 |
|------|-----|
| Chain ID | `43113` |
| RPC URL | `https://api.avax-test.network/ext/bc/C/rpc` |
| Block Explorer | `https://testnet.snowtrace.io` |
| Faucet | `https://faucet.avax.network/` |
| Native Token | AVAX (18 decimals) |
| EVM互換 | 完全互換（Coreth） |
| viem チェーン名 | `avalancheFuji` (from `viem/chains`) |
