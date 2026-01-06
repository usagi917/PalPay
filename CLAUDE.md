# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
plan-v3.mdを確認して実行すること

## Project Overview

Wagyu Milestone Escrow v3 - A decentralized marketplace dApp where producers list products (wagyu, sake, craft) and buyers purchase them. JPYC is automatically released to producers as milestones are completed. No admin role - fully trustless.

**Key concept**: 1 listing = 1 Escrow contract = 1 NFT. Producer self-reports milestone completion, triggering immediate JPYC payment.

**v3 New Features**:
- Buyer approval flow before milestone starts
- Cancel with full refund (LOCKED state only)
- XMTP chat between Producer/Buyer (no email needed)
- Buyer confirmation required for final milestone (delivery)
- Adjusted reward distribution (small first, large last)

## Architecture

```
hackson/
├── contracts/              # Solidity smart contracts (Remix IDE)
│   ├── ListingFactoryV3.sol  # ERC721 + creates Escrow per listing
│   ├── MilestoneEscrowV3.sol # Per-listing escrow with approval flow
│   └── MockERC20.sol         # Test token
└── apps/web/               # Next.js dApp (App Router, TypeScript)
```

### Contract Architecture (v3)

**ListingFactoryV3 (ERC721)**
- `createListing(category, title, description, totalAmount, imageURI)` → deploys new MilestoneEscrowV3 + mints NFT
- NFT initially owned by Escrow contract, transferred to Buyer on `lock()`
- `listings[]` array for enumeration, `tokenIdToEscrow` mapping

**MilestoneEscrowV3 (per listing)**
- **Roles**: Producer (fixed at creation), Buyer (set on lock)
- **No Admin** - fully decentralized
- **State flow**: OPEN → LOCKED → ACTIVE → COMPLETED (or CANCELLED)
- **Milestones**: Auto-generated from category template (wagyu/sake/craft)
- `lock()`: Buyer sends JPYC, receives NFT, status → LOCKED
- `approve()`: Buyer approves, status → ACTIVE, milestones start
- `cancel()`: Buyer cancels (LOCKED only), full refund, status → CANCELLED
- `submit(index)`: Producer completes milestone (except last), receives JPYC
- `confirmDelivery()`: Buyer confirms final milestone, Producer receives final payment

### State Flow

```
OPEN → lock() → LOCKED → approve() → ACTIVE → submit() × N → confirmDelivery() → COMPLETED
                   ↓
               cancel() → CANCELLED (full refund)
```

### Milestone Templates (bps, 10000=100%) - v3 Adjusted

**wagyu** (11 steps): 素牛導入(300), 肥育開始(500), 肥育中1-6(500×6), 出荷準備(700), 出荷(1500), 納品完了(4000★)

**sake** (5 steps): 仕込み(1000), 発酵(1500), 熟成(1500), 瓶詰め(2000), 出荷(4000★)

**craft** (4 steps): 制作開始(1000), 窯焼き(2000), 絵付け(2500), 仕上げ(4500★)

★ = Requires Buyer confirmation via `confirmDelivery()`

### dApp (apps/web/)

- **Stack**: Next.js 15 (App Router), TypeScript, viem, MUI, Framer Motion, XMTP
- **Pages**:
  - `/` - Listing index + create form
  - `/listing/[address]` - Detail page with actions (lock/submit)
  - `/my` - My Page (producer/buyer dashboard with XMTP chat)
- **No backend/DB**: All state from on-chain reads, events, and XMTP

### XMTP Chat

- Producer/Buyer communicate via dApp (no email needed)
- 1:1 chat per NFT/Escrow
- E2E encrypted
- Free to use
- ConversationId: `wagyu-escrow:{escrowAddress}`

## Build & Run Commands

### Smart Contracts (Remix IDE)

1. Copy contract files to Remix (https://remix.ethereum.org)
2. Compile with Solidity 0.8.20+
3. Test with "Remix VM (Shanghai)"
4. Deploy to Polygon Amoy with "Injected Provider - MetaMask"

### dApp

```bash
cd apps/web
pnpm install
pnpm dev          # Local development (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # Lint check
```

## Environment Variables

```bash
# Polygon Amoy (testnet)
NEXT_PUBLIC_RPC_URL=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_FACTORY_ADDRESS=<ListingFactoryV3 address>
NEXT_PUBLIC_TOKEN_ADDRESS=<MockERC20 or JPYC address>
NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE=https://amoy.polygonscan.com/tx/

# Polygon PoS (mainnet)
# NEXT_PUBLIC_RPC_URL=https://polygon-rpc.com
# NEXT_PUBLIC_CHAIN_ID=137
```

## Key Implementation Details

### Contract Security
- State updates before external calls (CEI pattern)
- `lock()`: Once only, anyone can become Buyer
- `approve()`: Buyer only, LOCKED state only
- `cancel()`: Buyer only, LOCKED state only, full refund
- `submit()`: Producer only, ACTIVE state, excludes final milestone
- `confirmDelivery()`: Buyer only, ACTIVE state, final milestone only

### NFT Flow
1. `createListing()` → NFT minted to Escrow contract address
2. `lock()` → NFT transferred from Escrow to Buyer
3. `cancel()` → NFT returned to Escrow (or burned)
4. Standard ERC721 transfer allowed after (secondary market ready)

### Frontend Hooks Pattern
```typescript
// Factory operations
useCreateListing(category, title, description, totalAmount, imageURI)
useListings() → address[]
useListingSummaries() → ListingSummary[]

// Per-Escrow operations
useEscrowInfo(address) → { producer, buyer, totalAmount, status, ... }
useMilestones(address) → Milestone[]
useEscrowActions(address) → { lock, approve, cancel, submit, confirmDelivery, txStep, ... }
useEscrowEvents(address) → Event[]

// Token operations
useTokenBalance(address) → balance
useTokenAllowance(owner, spender) → allowance
usePurchaseValidation(user, escrow, amount) → { hasEnoughBalance, needsApproval, ... }

// Real-time & My Page
useRealtimeEscrow(address, options) → auto-polling escrow state
useRealtimeListingSummaries(options) → auto-polling listings
useMyListings(address) → { asProducer, asBuyer, stats }

// XMTP Chat
useXmtpChat(escrowAddress) → { messages, sendMessage, isLoading }
```

### Transaction Progress (TxStep)
```typescript
type TxStep = "idle" | "checking" | "approving" | "approve-confirming"
            | "signing" | "confirming" | "success" | "error";
```
- `checking`: Balance/allowance validation
- `approving`: Waiting for ERC20 approve signature
- `approve-confirming`: Waiting for approve tx confirmation
- `signing`: Waiting for main tx signature
- `confirming`: Waiting for main tx confirmation

### Escrow Status
```typescript
enum Status { OPEN, LOCKED, ACTIVE, COMPLETED, CANCELLED }
```
- `OPEN`: Listed, waiting for buyer
- `LOCKED`: Buyer paid, waiting for approval (chat enabled)
- `ACTIVE`: Approved, milestones in progress
- `COMPLETED`: All milestones done
- `CANCELLED`: Buyer cancelled, refunded

## Deployment

1. Deploy MockERC20 via Remix → note token address
2. Deploy ListingFactoryV3 with (tokenAddress)
3. Set NEXT_PUBLIC_FACTORY_ADDRESS and NEXT_PUBLIC_TOKEN_ADDRESS
4. Deploy dApp to Vercel

## Dependencies

```bash
# XMTP for chat
pnpm add @xmtp/xmtp-js
```
