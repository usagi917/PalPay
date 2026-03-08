# Proof of Trust

[![日本語](https://img.shields.io/badge/lang-日本語-green.svg)](README.md)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js)](apps/web/Dockerfile)
[![Solidity 0.8.24](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](foundry.toml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A milestone-based escrow DApp for high-value B2B trade, combining staged payouts, dynamic NFTs, and party-to-party encrypted chat.

## Overview

`Proof of Trust` is designed for long production-cycle transactions such as wagyu, sake, and crafts, where prepayment risk and progress visibility are major concerns.

- Web app: Next.js 15 + React 19 + viem
- Contracts: `ListingFactoryV6` / `MilestoneEscrowV6` (Solidity 0.8.24)
- Settlement: ERC-20
- Ownership proof: ERC-721 (dynamic metadata / SVG)
- Chat: XMTP (E2E encrypted)

## Main Transaction Sequence (Mermaid)

```mermaid
sequenceDiagram
    participant S as Seller
    participant B as Buyer
    participant W as Web App
    participant F as ListingFactoryV6
    participant E as MilestoneEscrowV6
    participant T as ERC-20

    S->>W: 1. Create listing
    W->>F: createListing(...)
    Note over F,E: Mint NFT (held by Escrow)
    F-->>W: escrowAddress / tokenId

    B->>W: 2. Lock purchase
    W->>T: approve(escrow, totalAmount)
    W->>E: lock()
    T-->>E: ERC-20 (full amount)
    E-->>B: Transfer NFT
    Note right of E: open → locked

    B->>W: 3. Approve transaction start
    W->>E: approve()
    Note right of E: locked → active

    loop Intermediate milestones (except final)
        S->>W: 4. Report milestone completion
        W->>E: submit(index, evidenceHash)
        E-->>S: Partial payout (ERC-20)
    end

    S->>W: 5. Request final delivery
    W->>E: requestFinalDelivery(evidenceHash)
    B->>W: 6. Confirm final delivery
    W->>E: confirmDelivery()
    E-->>S: Remaining payout (ERC-20)
    Note right of E: active → completed
```

Notes:
- `cancel()` is buyer-only in `locked`, refunds the full amount, returns the NFT to the producer, and reopens the listing.
- After 14 days in `locked`, anyone can call `activateAfterTimeout()` to move the listing to `active`.
- After 14 days from `requestFinalDelivery()`, anyone can call `finalizeAfterTimeout()` to release the remaining payout.

## Key Features

- Deploys a dedicated `MilestoneEscrowV6` per listing and mints a linked NFT
- State transitions
  - `open -> locked -> active -> completed`
  - `locked -> open` (via `cancel()`, ready for relisting)
- Buyer deposits ERC-20 via `lock()`, then starts milestone flow with `approve()` or `activateAfterTimeout()`
- Producer reports intermediate milestones via `submit()`; the final step uses `requestFinalDelivery()` -> `confirmDelivery()` / `finalizeAfterTimeout()`
- Listing detail page renders on-chain event timeline
- NFT APIs
  - `GET /api/nft/:tokenId` (metadata)
  - `GET /api/nft/:tokenId/image` (dynamic SVG)
- XMTP chat (shown only to producer and current NFT holder)

## Repository Structure

```text
apps/web/    Next.js 15 frontend + API routes
contracts/   Solidity contracts (Factory/Escrow/MockERC20)
docs/        Architecture, demo script, and demo assets
lib/         Foundry libraries (OpenZeppelin submodule)
```

## Prerequisites

- Node.js 20+
- `pnpm`
- MetaMask
- RPC URL for your target chain
- Deployed contract addresses
  - `ListingFactoryV6`
  - settlement ERC-20 token

Supported chains (`apps/web/src/lib/config.ts`):

- Sepolia (`11155111`)
- Base Sepolia (`84532`)
- Base (`8453`)
- Polygon Amoy (`80002`)
- Avalanche Fuji (`43113`, default)

If you build contracts with Foundry, initialize submodules first.

```bash
git submodule update --init --recursive
```

## Installation

```bash
pnpm --dir apps/web install
```

## Quick Start

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm --dir apps/web dev
```

Open `http://localhost:3000`.

## Configuration (`.env.local`)

Config file: `apps/web/.env.local`

### Required (Core DApp)

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_RPC_URL` | Target RPC URL |
| `NEXT_PUBLIC_CHAIN_ID` | Chain ID |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | `ListingFactoryV6` address |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | Settlement ERC-20 address |

### Optional (Display / Runtime)

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE` | Base URL for tx links |
| `CHAIN_ID` | API-side chain override |
| `NEXT_PUBLIC_XMTP_ENV` | `dev` or `production` |

## Smart Contract Design (V6)

### Factory

- `ListingFactoryV6.createListing(...)` deploys a new escrow
- NFT is initially owned by escrow
- Secondary transfer is restricted to escrow-driven flows

### Escrow

- `lock()`
  - Buyer deposits ERC-20
  - NFT moves to buyer
  - `open -> locked`
- `approve()`
  - Buyer starts the transaction within the review window
  - `locked -> active`
- `activateAfterTimeout()`
  - Callable by anyone after 14 days in `locked`
  - `locked -> active`
- `submit(index, evidenceHash)`
  - Producer reports intermediate milestone completion
- `requestFinalDelivery(evidenceHash)`
  - Producer starts the buyer confirmation window for the final delivery
- `confirmDelivery()`
  - Buyer confirms final receipt before the deadline
  - `active -> completed`
- `finalizeAfterTimeout()`
  - Callable by anyone after the final confirmation deadline
  - `active -> completed`
- `cancel()`
  - Buyer-only in `locked`
  - Returns NFT to producer and refunds full amount
  - `locked -> open`

### Milestone Distribution (BPS, total = 10000)

| categoryType | Category | Steps | BPS array |
| --- | --- | --- | --- |
| `0` | wagyu | 10 | `200,300,400,500,600,650,700,750,900,5000` |
| `1` | sake | 5 | `1000,1500,1500,2000,4000` |
| `2` | craft | 4 | `1000,2000,2500,4500` |

## API

### NFT API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/nft/:tokenId` | NFT metadata JSON |
| `GET` | `/api/nft/:tokenId/image` | Dynamic SVG image |

You can explicitly target a factory via the `factoryAddress` query parameter.

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

## Related Docs

- `docs/architecture.mmd`
- `docs/demo-script.md`
- `docs/demo-video/README.md`
- `docs/zenn-article-draft.md`

## License

MIT License. See `LICENSE`.
