# Proof of Trust

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.en.md)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js)](apps/web/Dockerfile)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 和牛・日本酒・工芸品などの高額B2B取引を、マイルストーン連動決済で進めるエスクローDApp。  
> Next.js アプリを Cloud Run で運用し、AIアシスタントは Vertex AI Gemini を利用します。

## Google Cloud Requirement Coverage

| 要件 | 実装 | 根拠 |
| --- | --- | --- |
| A: 実行プロダクト利用 | Cloud Run 上で Next.js を実行 | `apps/web/Dockerfile`, `apps/web/scripts/deploy-cloudrun.sh` |
| B: AIプロダクト利用 | Vertex AI (`@google/genai`, `vertexai: true`) | `apps/web/src/lib/agent/gemini.ts`, `apps/web/src/app/api/agent/chat/route.ts` |

## 主な機能

- 1出品ごとに `MilestoneEscrowV6` をデプロイし、ERC721 NFT を発行
- 状態遷移 `open -> locked -> active -> completed / cancelled` をサポート
- `lock()` 時のERC20ロック、マイルストーン完了ごとの段階支払い、`confirmDelivery()` による最終確定
- Dynamic NFT API
  - `GET /api/nft/:tokenId`
  - `GET /api/nft/:tokenId/image`
- XMTPベースのP2P暗号化チャット（`NEXT_PUBLIC_XMTP_ENV=dev/production`）
- Agentページ（`/agent`）で出品支援・市場分析・リスク評価・次アクション提案

## リポジトリ構成

```text
apps/web/    Next.js 15 フロントエンド + API routes
contracts/   Solidity コントラクト (ListingFactoryV5/V6, MockERC20)
```

## 前提条件

- Node.js 20 以上（`apps/web/Dockerfile`）
- `pnpm`
- MetaMask
- 対象チェーンの RPC URL とデプロイ済みコントラクトアドレス
  - `NEXT_PUBLIC_FACTORY_ADDRESS`
  - `NEXT_PUBLIC_TOKEN_ADDRESS`
- `/agent` を使う場合
  - GCP プロジェクト（`run`, `cloudbuild`, `artifactregistry`, `aiplatform` API有効）
  - `gcloud` CLI

## Installation

```bash
cd apps/web
pnpm install
```

## Quick Start (Local)

```bash
cd apps/web
cp .env.example .env.local
pnpm dev
```

`apps/web/.env.local` に最低限以下を設定してください。

- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_FACTORY_ADDRESS`
- `NEXT_PUBLIC_TOKEN_ADDRESS`

`/agent` も使う場合は、追加で以下が必要です。

- `GCP_PROJECT_ID`
- `GCP_LOCATION`（例: `us-central1`）
- `GEMINI_MODEL`（例: `gemini-2.5-flash`）
- ローカル ADC 認証: `gcloud auth application-default login`

ブラウザで `http://localhost:3000` を開いて動作確認します。

## Configuration

設定ファイル: `apps/web/.env.local`

| 変数名 | 必須 | 説明 |
| --- | --- | --- |
| `NEXT_PUBLIC_RPC_URL` | Yes | 接続先RPC URL |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | チェーンID（例: Base Sepolia = `84532`） |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Yes | `ListingFactoryV6` アドレス |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | Yes | 決済用ERC20アドレス |
| `NEXT_PUBLIC_XMTP_ENV` | No | `dev` または `production` |
| `NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE` | No | TxリンクのベースURL |
| `CHAIN_ID` | No | APIルート側で使うチェーンID上書き |
| `GCP_PROJECT_ID` | Agent利用時必須 | Vertex AI利用先のGCPプロジェクト |
| `GCP_LOCATION` | Agent利用時必須 | Vertex AIロケーション |
| `GEMINI_MODEL` | Agent利用時必須 | 利用するGeminiモデル名 |

## API Endpoints

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/agent/nonce?sessionId=...` | 署名用nonceの発行 |
| `POST` | `/api/agent/chat` | Agentチャット（ツール実行含む） |
| `GET` | `/api/nft/:tokenId` | NFT metadata JSON |
| `GET` | `/api/nft/:tokenId/image` | NFT SVG画像 |

## Cloud Run Deployment

### 1) 事前設定

```bash
gcloud config set project <YOUR_PROJECT_ID>
gcloud auth login
gcloud auth application-default login
gcloud services enable run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com
```

### 2) デプロイ

```bash
cd apps/web

export NEXT_PUBLIC_RPC_URL="https://sepolia.base.org"
export NEXT_PUBLIC_CHAIN_ID="84532"
export NEXT_PUBLIC_FACTORY_ADDRESS="<FACTORY_ADDRESS>"
export NEXT_PUBLIC_TOKEN_ADDRESS="<TOKEN_ADDRESS>"
export GCP_PROJECT_ID="<YOUR_PROJECT_ID>"
export GCP_LOCATION="us-central1"
export GEMINI_MODEL="gemini-2.5-flash"
export NEXT_PUBLIC_XMTP_ENV="dev"

bash scripts/deploy-cloudrun.sh
```

`deploy-cloudrun.sh` は以下を実行します。

- Artifact Registry リポジトリ作成/確認
- `cloudbuild.yaml` で Docker build
- Cloud Run サービスへデプロイ

### 3) デプロイ後確認

```bash
bash scripts/verify-cloudrun.sh "https://<your-service>.run.app"
```

必要に応じて `TEST_TOKEN_ID` を指定すると `/api/nft/:tokenId` も確認できます。

## Development

```bash
cd apps/web
pnpm dev
pnpm build
pnpm lint
```

コントラクトをビルドする場合（任意）:

```bash
forge build
```


## License

MIT License. See `LICENSE`.
