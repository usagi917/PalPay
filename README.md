# Proof of Trust

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.en.md)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js)](apps/web/Dockerfile)
[![Solidity 0.8.24](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](foundry.toml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 和牛・日本酒・工芸品などの高額B2B取引を、マイルストーン連動決済で進めるエスクローDAppです。  
> Next.js 15 を Cloud Run で運用し、AIアシスタントは Vertex AI Gemini を利用します。

## 何を解決するか

長期の生産工程を伴う取引では、前払いリスクとキャッシュフローの課題が大きくなります。  
このプロジェクトは「工程進捗に応じた段階支払い」「証跡付きの状態遷移」「当事者間チャット」を1つのDAppに統合します。

## 主な機能

- 出品ごとに `MilestoneEscrowV6` をデプロイし、ERC-721 NFT を発行
- 状態遷移 `open -> locked -> active -> completed / cancelled` を実装
- `lock()` でERC-20預け入れ、`submit()` で段階支払い、`confirmDelivery()` で最終支払い
- Dynamic NFT API
  - `GET /api/nft/:tokenId`（メタデータ）
  - `GET /api/nft/:tokenId/image`（動的SVG画像）
- Agentページ（`/agent`）で出品支援・市場分析・リスク評価・次アクション提案
- XMTPベースのE2E暗号化チャット
- マイページ（`/my`）で出品者/購入者別の取引状況と集計を表示

## リポジトリ構成

```text
apps/web/    Next.js 15 フロントエンド + API routes + Cloud Run scripts
contracts/   Solidity コントラクト (ListingFactoryV6, MilestoneEscrowV6, MockERC20)
docs/        構成図、デモ台本、動画成果物
lib/         Foundryライブラリ（OpenZeppelinサブモジュール）
```

## 前提条件

- Node.js 20 以上
- `pnpm`
- MetaMask
- 対象チェーンのRPC URLとデプロイ済みコントラクトアドレス
- （任意）Foundry (`forge`)：コントラクトをビルドする場合
- （任意）`gcloud` CLI：`/agent` のローカル検証や Cloud Run デプロイを行う場合

`forge build` を使う場合は OpenZeppelin サブモジュールを初期化してください。

```bash
git submodule update --init --recursive
```

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

最低限、`apps/web/.env.local` に以下を設定してください。

- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_FACTORY_ADDRESS`
- `NEXT_PUBLIC_TOKEN_ADDRESS`

`/agent` も使う場合は、追加で以下が必要です。

- `GCP_PROJECT_ID`
- `GCP_LOCATION`（例: `us-central1`）
- `GEMINI_MODEL`（例: `gemini-2.5-flash`）
- ローカルADC認証: `gcloud auth application-default login`

起動後、`http://localhost:3000` を開いて確認します。

## Configuration

設定ファイル: `apps/web/.env.local`

### DApp / Agent 実行設定

| 変数名 | 必須 | 説明 |
| --- | --- | --- |
| `NEXT_PUBLIC_RPC_URL` | Yes | 接続先RPC URL |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | チェーンID |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Yes | `ListingFactoryV6` アドレス |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | Yes | 決済用ERC-20アドレス |
| `NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE` | No | TxリンクのベースURL |
| `NEXT_PUBLIC_XMTP_ENV` | No | `dev` または `production`（デフォルト: `dev`） |
| `CHAIN_ID` | No | APIルート側で使うチェーンID上書き |
| `GCP_PROJECT_ID` | Agent利用時必須 | Vertex AI利用先プロジェクト |
| `GCP_LOCATION` | Agent利用時必須 | Vertex AIロケーション |
| `GEMINI_MODEL` | Agent利用時推奨 | 利用するGeminiモデル（デフォルト: `gemini-2.5-flash`） |
| `NEXT_PUBLIC_AGENT_AUTH_REQUIRED` | No | `false` でフロントの署名フローを無効化（デフォルト: 有効） |

### Agentセキュリティ/制限（任意）

| 変数名 | デフォルト | 用途 |
| --- | --- | --- |
| `AGENT_AUTH_DISABLED` | `false` | `true` でサーバー側署名検証を無効化 |
| `AGENT_NONCE_TTL_MS` | `300000` | nonce有効期限 |
| `AGENT_AUTH_SKEW_MS` | `300000` | 署名timestamp許容誤差 |
| `AGENT_AUTH_TOKEN_TTL_MS` | `1800000` | セッショントークン有効期限 |
| `AGENT_MAX_BODY_BYTES` | `16000` | `/api/agent/chat` ボディ上限 |
| `AGENT_MAX_MESSAGE_CHARS` | `2000` | メッセージ文字数上限 |
| `AGENT_RATE_LIMIT_MAX` | `20` | レート制限回数 |
| `AGENT_RATE_LIMIT_WINDOW_MS` | `60000` | レート制限ウィンドウ |

## スマートコントラクト

- `ListingFactoryV6` が出品ごとに `MilestoneEscrowV6` を生成
- NFTはFactoryからEscrowにmintされ、`lock()` 時に購入者へ移転

状態遷移:

```text
OPEN --lock()--> LOCKED --approve()--> ACTIVE --submit(...)--> ... --confirmDelivery()--> COMPLETED
LOCKED --cancel()--> CANCELLED (全額返金)
```

カテゴリ別のマイルストーン分配（BPS, 合計10000）:

| categoryType | カテゴリ | ステップ数 | BPS配列 |
| --- | --- | --- | --- |
| `0` | wagyu | 11 | `300,500,500,500,500,500,500,500,700,1500,4000` |
| `1` | sake | 5 | `1000,1500,1500,2000,4000` |
| `2` | craft | 4 | `1000,2000,2500,4500` |

## API Endpoints

| Method | Path | 認証 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/agent/nonce?sessionId=...` | 不要 | 署名用nonce発行 |
| `POST` | `/api/agent/chat` | 初回は署名必須（`AGENT_AUTH_DISABLED=true` を除く） | Agentチャットとツール実行 |
| `GET` | `/api/agent/chat?sessionId=...` | セッショントークン | Agentセッション状態確認 |
| `DELETE` | `/api/agent/chat?sessionId=...` | セッショントークン | Agentセッション破棄 |
| `GET` | `/api/nft/:tokenId` | 不要 | NFTメタデータJSON |
| `GET` | `/api/nft/:tokenId/image` | 不要 | 動的NFT SVG画像 |

### Agent認証フロー（署名有効時）

1. `GET /api/agent/nonce?sessionId=...` でnonce取得
2. 以下形式のメッセージを `personal_sign`

```text
Proof of Trust Agent Authentication
Session: <sessionId>
Nonce: <nonce>
Timestamp: <unix_ms>
```

3. `POST /api/agent/chat` に `auth` を付けて送信
4. レスポンスの `sessionToken` を `X-Session-Token` ヘッダで再送

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
- Cloud Run へデプロイ

必要に応じて以下を上書きできます。

- `PROJECT_ID`, `REGION`, `SERVICE_NAME`, `REPOSITORY`, `IMAGE_NAME`, `IMAGE_TAG`

### 3) デプロイ後確認

```bash
bash scripts/verify-cloudrun.sh "https://<your-service>.run.app"
```

`TEST_TOKEN_ID` を設定すると `/api/nft/:tokenId` の200応答も確認します。

## Development

```bash
pnpm --dir apps/web dev
pnpm --dir apps/web dev:turbo
pnpm --dir apps/web build
pnpm --dir apps/web start
pnpm --dir apps/web lint
```

コントラクト（任意）:

```bash
forge build
```

デモ動画素材生成（任意）:

```bash
python3 apps/web/scripts/build_demo_video.py
```

## 関連ドキュメント

- `docs/architecture.mmd`
- `docs/demo-script.md`
- `docs/demo-video/README.md`
- `docs/zenn-article-draft.md`

## License

MIT License. See `LICENSE`.
