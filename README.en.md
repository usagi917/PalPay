# Proof of Trust

[![日本語](https://img.shields.io/badge/lang-日本語-green.svg)](README.md)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js)](apps/web/Dockerfile)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A milestone-based escrow DApp for high-value B2B transactions (wagyu, sake, and crafts).  
> The Next.js app runs on Cloud Run, and the AI assistant uses Vertex AI Gemini.

## Google Cloud Requirement Coverage

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| A: Runtime product usage | Next.js running on Cloud Run | `apps/web/Dockerfile`, `apps/web/scripts/deploy-cloudrun.sh` |
| B: AI product usage | Vertex AI (`@google/genai`, `vertexai: true`) | `apps/web/src/lib/agent/gemini.ts`, `apps/web/src/app/api/agent/chat/route.ts` |

## Key Features

- Deploys one `MilestoneEscrowV6` contract per listing and mints an ERC721 NFT
- Supports the state flow `open -> locked -> active -> completed / cancelled`
- Handles ERC20 lock on `lock()`, milestone-based releases, and final settlement via `confirmDelivery()`
- Dynamic NFT APIs
  - `GET /api/nft/:tokenId`
  - `GET /api/nft/:tokenId/image`
- XMTP-based encrypted P2P chat (`NEXT_PUBLIC_XMTP_ENV=dev/production`)
- Agent page (`/agent`) for listing support, market analysis, risk assessment, and next-action suggestions

## Repository Structure

```text
apps/web/    Next.js 15 frontend + API routes
contracts/   Solidity contracts (ListingFactoryV5/V6, MockERC20)
docs/        Submission docs, diagrams, and demo assets
```

## Prerequisites

- Node.js 20+ (`apps/web/Dockerfile`)
- `pnpm`
- MetaMask
- RPC URL and deployed contract addresses for your target chain
  - `NEXT_PUBLIC_FACTORY_ADDRESS`
  - `NEXT_PUBLIC_TOKEN_ADDRESS`
- If you use `/agent`
  - A GCP project with `run`, `cloudbuild`, `artifactregistry`, and `aiplatform` APIs enabled
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

At minimum, set the following values in `apps/web/.env.local`:

- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_FACTORY_ADDRESS`
- `NEXT_PUBLIC_TOKEN_ADDRESS`

If you also use `/agent`, add:

- `GCP_PROJECT_ID`
- `GCP_LOCATION` (for example: `us-central1`)
- `GEMINI_MODEL` (for example: `gemini-2.5-flash`)
- Local ADC auth: `gcloud auth application-default login`

Then open `http://localhost:3000`.

## Configuration

Config file: `apps/web/.env.local`

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_RPC_URL` | Yes | RPC URL for the target network |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | Chain ID (example: Base Sepolia = `84532`) |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Yes | `ListingFactoryV6` address |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | Yes | ERC20 token address for settlement |
| `NEXT_PUBLIC_XMTP_ENV` | No | `dev` or `production` |
| `NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE` | No | Base URL for transaction links |
| `CHAIN_ID` | No | Chain ID override for API routes |
| `GCP_PROJECT_ID` | Required for Agent | GCP project used by Vertex AI |
| `GCP_LOCATION` | Required for Agent | Vertex AI location |
| `GEMINI_MODEL` | Required for Agent | Gemini model name |

## API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/agent/nonce?sessionId=...` | Issue a nonce for request signing |
| `POST` | `/api/agent/chat` | Agent chat endpoint (including tool execution) |
| `GET` | `/api/nft/:tokenId` | NFT metadata JSON |
| `GET` | `/api/nft/:tokenId/image` | NFT SVG image |

## Cloud Run Deployment

### 1) Setup

```bash
gcloud config set project <YOUR_PROJECT_ID>
gcloud auth login
gcloud auth application-default login
gcloud services enable run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com
```

### 2) Deploy

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

`deploy-cloudrun.sh` will:

- create/check the Artifact Registry repository
- build the image via `cloudbuild.yaml`
- deploy to Cloud Run

### 3) Post-deploy verification

```bash
bash scripts/verify-cloudrun.sh "https://<your-service>.run.app"
```

Set `TEST_TOKEN_ID` if you also want to check `/api/nft/:tokenId`.

## Development

```bash
cd apps/web
pnpm dev
pnpm build
pnpm lint
```

Optional contract build:

```bash
forge build
```

## Submission Assets

- Zenn draft (Japanese): `docs/zenn-article-draft.md`
- Silent subtitle demo script: `docs/demo-script.md`
- Mermaid architecture diagram: `docs/architecture.mmd`
- Demo video assets: `docs/demo-video/README.md`

Links to update before final submission:

- Cloud Run URL: `https://wagyu-escrow-cu4mgmypmq-uc.a.run.app`
- Zenn URL: `TBD`
- YouTube URL: `TBD`

## License

MIT License. See `LICENSE`.
