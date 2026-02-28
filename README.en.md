# Proof of Trust

[![日本語](https://img.shields.io/badge/lang-日本語-green.svg)](README.md)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js)](apps/web/Dockerfile)
[![Solidity 0.8.24](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](foundry.toml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A milestone-based escrow DApp for high-value B2B transactions (wagyu, sake, and crafts).  
> It runs on Next.js 15 + Cloud Run, with an AI assistant powered by Vertex AI Gemini.

## Problem It Solves

Long production cycles create high prepayment risk and severe cash-flow gaps.  
This project combines milestone-linked payouts, evidence-backed state transitions, and party-to-party chat in one DApp.

## Key Features

- Deploys one `MilestoneEscrowV6` contract per listing and mints an ERC-721 NFT
- Implements state flow: `open -> locked -> active -> completed / cancelled`
- Handles ERC-20 deposit on `lock()`, stepwise payout on `submit()`, and final payout on `confirmDelivery()`
- Dynamic NFT APIs
  - `GET /api/nft/:tokenId` (metadata)
  - `GET /api/nft/:tokenId/image` (dynamic SVG)
- Agent page (`/agent`) for listing support, market analysis, risk assessment, and next-action suggestions
- XMTP-based end-to-end encrypted chat
- My page (`/my`) with producer/buyer summaries and stats

## Repository Structure

```text
apps/web/    Next.js 15 frontend + API routes + Cloud Run scripts
contracts/   Solidity contracts (ListingFactoryV6, MilestoneEscrowV6, MockERC20)
docs/        Architecture, demo script, and demo assets
lib/         Foundry libraries (OpenZeppelin submodule)
```

## Prerequisites

- Node.js 20+
- `pnpm`
- MetaMask
- RPC URL + deployed contract addresses for your target chain
- (Optional) Foundry (`forge`) if you build contracts locally
- (Optional) `gcloud` CLI for `/agent` local verification or Cloud Run deployment

If you run `forge build`, initialize the OpenZeppelin submodule first:

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

At minimum, set these values in `apps/web/.env.local`:

- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_FACTORY_ADDRESS`
- `NEXT_PUBLIC_TOKEN_ADDRESS`

If you also use `/agent`, add:

- `GCP_PROJECT_ID`
- `GCP_LOCATION` (example: `us-central1`)
- `GEMINI_MODEL` (example: `gemini-2.5-flash`)
- Local ADC auth: `gcloud auth application-default login`

Then open `http://localhost:3000`.

## Configuration

Config file: `apps/web/.env.local`

### DApp / Agent runtime

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_RPC_URL` | Yes | RPC URL for the target chain |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | Chain ID |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Yes | `ListingFactoryV6` address |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | Yes | Settlement ERC-20 token address |
| `NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE` | No | Base URL for transaction links |
| `NEXT_PUBLIC_XMTP_ENV` | No | `dev` or `production` (default: `dev`) |
| `CHAIN_ID` | No | API route chain ID override |
| `GCP_PROJECT_ID` | Required for Agent | GCP project used by Vertex AI |
| `GCP_LOCATION` | Required for Agent | Vertex AI location |
| `GEMINI_MODEL` | Recommended for Agent | Gemini model name (default: `gemini-2.5-flash`) |
| `NEXT_PUBLIC_AGENT_AUTH_REQUIRED` | No | Set `false` to disable client-side signature flow (default: enabled) |

### Agent security and limits (optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `AGENT_AUTH_DISABLED` | `false` | Set `true` to disable server-side signature validation |
| `AGENT_NONCE_TTL_MS` | `300000` | Nonce TTL |
| `AGENT_AUTH_SKEW_MS` | `300000` | Allowed auth timestamp skew |
| `AGENT_AUTH_TOKEN_TTL_MS` | `1800000` | Session token TTL |
| `AGENT_MAX_BODY_BYTES` | `16000` | Request body limit for `/api/agent/chat` |
| `AGENT_MAX_MESSAGE_CHARS` | `2000` | Per-message character limit |
| `AGENT_RATE_LIMIT_MAX` | `20` | Rate-limit allowance |
| `AGENT_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |

## Smart Contracts

- `ListingFactoryV6` creates one `MilestoneEscrowV6` per listing
- NFT is minted to escrow first, then transferred to buyer on `lock()`

State transitions:

```text
OPEN --lock()--> LOCKED --approve()--> ACTIVE --submit(...)--> ... --confirmDelivery()--> COMPLETED
LOCKED --cancel()--> CANCELLED (full refund)
```

Category milestone distributions (BPS, total = 10000):

| categoryType | Category | Steps | BPS array |
| --- | --- | --- | --- |
| `0` | wagyu | 11 | `300,500,500,500,500,500,500,500,700,1500,4000` |
| `1` | sake | 5 | `1000,1500,1500,2000,4000` |
| `2` | craft | 4 | `1000,2000,2500,4500` |

## API Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/agent/nonce?sessionId=...` | None | Issue signing nonce |
| `POST` | `/api/agent/chat` | Signature required on first call (unless `AGENT_AUTH_DISABLED=true`) | Agent chat + tool execution |
| `GET` | `/api/agent/chat?sessionId=...` | Session token | Inspect Agent session state |
| `DELETE` | `/api/agent/chat?sessionId=...` | Session token | Clear Agent session |
| `GET` | `/api/nft/:tokenId` | None | NFT metadata JSON |
| `GET` | `/api/nft/:tokenId/image` | None | Dynamic NFT SVG |

### Agent auth flow (when signature is enabled)

1. Fetch nonce from `GET /api/agent/nonce?sessionId=...`
2. `personal_sign` the message below

```text
Proof of Trust Agent Authentication
Session: <sessionId>
Nonce: <nonce>
Timestamp: <unix_ms>
```

3. Send `auth` payload in `POST /api/agent/chat`
4. Reuse `sessionToken` via `X-Session-Token` header

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

- create/check Artifact Registry repository
- build image via `cloudbuild.yaml`
- deploy to Cloud Run

You can override defaults with:

- `PROJECT_ID`, `REGION`, `SERVICE_NAME`, `REPOSITORY`, `IMAGE_NAME`, `IMAGE_TAG`

### 3) Post-deploy verification

```bash
bash scripts/verify-cloudrun.sh "https://<your-service>.run.app"
```

Set `TEST_TOKEN_ID` if you also want to verify `/api/nft/:tokenId`.

## Development

```bash
pnpm --dir apps/web dev
pnpm --dir apps/web dev:turbo
pnpm --dir apps/web build
pnpm --dir apps/web start
pnpm --dir apps/web lint
```

Contracts (optional):

```bash
forge build
```

Demo asset generation (optional):

```bash
python3 apps/web/scripts/build_demo_video.py
```

## Related Docs

- `docs/architecture.mmd`
- `docs/demo-script.md`
- `docs/demo-video/README.md`
- `docs/zenn-article-draft.md`

## License

MIT License. See `LICENSE`.
