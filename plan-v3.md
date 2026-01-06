# Wagyu Milestone Escrow v3 - 承認フロー + XMTPチャット

## 概要

v2からの主な変更点：
1. **承認フロー追加**: 購入後、購入者が承認するまでマイルストーンは開始しない
2. **キャンセル機能**: 承認前なら購入者がキャンセル可能（全額返金）
3. **XMTPチャット**: dApp内でProducer/Buyer間のメッセージング（メールアドレス不要）
4. **報酬配分調整**: 最初のマイルストーンは小さく、最後は大きく
5. **最終マイルストーン承認**: 納品完了は購入者の承認が必要

---

## 新しい状態遷移

```
OPEN (出品中)
  │
  │ lock() - Buyerが購入（JPYC支払い）
  ▼
LOCKED (承認待ち) ← 新状態
  │
  ├─── approve() - Buyerが承認 ───→ ACTIVE (進行中)
  │                                    │
  │                                    │ submit(index) × N回
  │                                    │ ※最終は confirmDelivery() が必要
  │                                    ▼
  │                                 COMPLETED (完了)
  │
  └─── cancel() - Buyerがキャンセル → CANCELLED (返金済)
```

---

## コントラクト変更 (MilestoneEscrowV3)

### 新しい状態管理

```solidity
enum Status { OPEN, LOCKED, ACTIVE, COMPLETED, CANCELLED }
Status public status;
```

### 新しい関数

```solidity
// 購入者が条件に合意してマイルストーン開始
function approve() external {
    require(msg.sender == buyer, "Only buyer");
    require(status == Status.LOCKED, "Not locked");

    status = Status.ACTIVE;
    emit Approved(buyer);
}

// 購入者がキャンセル（LOCKED状態のみ）
function cancel() external {
    require(msg.sender == buyer, "Only buyer");
    require(status == Status.LOCKED, "Not locked");

    status = Status.CANCELLED;

    // 全額返金
    IERC20(tokenAddress).transfer(buyer, totalAmount);

    // NFTをEscrowに戻す（またはburn）
    IERC721(factory).transferFrom(buyer, address(this), tokenId);

    emit Cancelled(buyer, totalAmount);
}

// 最終マイルストーンの納品確認（購入者のみ）
function confirmDelivery() external {
    require(msg.sender == buyer, "Only buyer");
    require(status == Status.ACTIVE, "Not active");

    uint256 lastIndex = milestones.length - 1;
    require(!milestones[lastIndex].completed, "Already completed");

    // 最後以外が全て完了していること
    for (uint256 i = 0; i < lastIndex; i++) {
        require(milestones[i].completed, "Previous milestones incomplete");
    }

    milestones[lastIndex].completed = true;

    uint256 amount = (totalAmount * milestones[lastIndex].bps) / 10000;
    IERC20(tokenAddress).transfer(producer, amount);

    status = Status.COMPLETED;
    emit Completed(lastIndex, milestones[lastIndex].name, amount);
    emit DeliveryConfirmed(buyer);
}
```

### submit() の変更

```solidity
function submit(uint256 index) external {
    require(msg.sender == producer, "Only producer");
    require(status == Status.ACTIVE, "Not active");  // LOCKEDではなくACTIVE
    require(index < milestones.length - 1, "Use confirmDelivery for last");  // 最後は除外
    require(!milestones[index].completed, "Already completed");

    milestones[index].completed = true;

    uint256 amount = (totalAmount * milestones[index].bps) / 10000;
    IERC20(tokenAddress).transfer(producer, amount);

    emit Completed(index, milestones[index].name, amount);
}
```

### 新しいイベント

```solidity
event Approved(address indexed buyer);
event Cancelled(address indexed buyer, uint256 refundAmount);
event DeliveryConfirmed(address indexed buyer);
```

---

## 報酬配分の調整

### wagyu (和牛) - 11ステップ（v3）

```
1.  素牛導入   300 bps (3%)    ← 小さく
2.  肥育開始   500 bps (5%)
3.  肥育中1    500 bps (5%)
4.  肥育中2    500 bps (5%)
5.  肥育中3    500 bps (5%)
6.  肥育中4    500 bps (5%)
7.  肥育中5    500 bps (5%)
8.  肥育中6    500 bps (5%)
9.  出荷準備   700 bps (7%)
10. 出荷      1500 bps (15%)
11. 納品完了  4000 bps (40%)   ← 大きく（要Buyer承認）
─────────────────────────
合計        10000 bps (100%)
```

### sake (日本酒) - 5ステップ（v3）

```
1. 仕込み   1000 bps (10%)   ← 小さく
2. 発酵     1500 bps (15%)
3. 熟成     1500 bps (15%)
4. 瓶詰め   2000 bps (20%)
5. 出荷     4000 bps (40%)   ← 大きく（要Buyer承認）
─────────────────────────
合計       10000 bps (100%)
```

### craft (工芸品) - 4ステップ（v3）

```
1. 制作開始  1000 bps (10%)   ← 小さく
2. 窯焼き    2000 bps (20%)
3. 絵付け    2500 bps (25%)
4. 仕上げ    4500 bps (45%)   ← 大きく（要Buyer承認）
─────────────────────────
合計        10000 bps (100%)
```

---

## XMTPチャット機能

### 概要

- Producer/Buyer間でdApp内メッセージング
- 各NFT（エスクロー）に紐づいた1対1チャット
- メールアドレス登録不要（ウォレットアドレスがID）
- E2E暗号化（第三者は読めない）
- 無料

### 実装

```typescript
// lib/xmtp.ts
import { Client } from "@xmtp/xmtp-js";

export async function getXmtpClient(signer: Signer) {
  return await Client.create(signer, { env: "production" });
}

export async function getConversation(
  client: Client,
  peerAddress: string,
  escrowAddress: string
) {
  return await client.conversations.newConversation(peerAddress, {
    conversationId: `wagyu-escrow:${escrowAddress}`,
    metadata: { escrowAddress },
  });
}
```

### Hooks

```typescript
// hooks/useXmtpChat.ts
export function useXmtpChat(escrowAddress: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  // 初期化
  useEffect(() => {
    // XMTPクライアント接続
    // 会話取得 or 作成
    // メッセージストリーム開始
  }, [escrowAddress]);

  const sendMessage = async (content: string) => {
    await conversation?.send(content);
  };

  return { messages, sendMessage, isLoading };
}
```

### UI

```
┌─────────────────────────────────────────────────────────────┐
│ マイページ > 購入したNFT > 和牛A5ランク                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  状態: LOCKED（承認待ち）                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 💬 出品者とのチャット                                 │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 👤 あなた: 配送先は東京都渋谷区...です                │   │
│  │ 🧑‍🌾 出品者: 承知しました。1/20発送予定です            │   │
│  │ 👤 あなた: 了解です！                                │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ [メッセージを入力...                    ] [送信]      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [✓ 承認してマイルストーン開始]  [✗ キャンセルして返金]       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## フロントエンド変更

### 新しいページ/コンポーネント

```
apps/web/src/
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx      # チャットUI
│   │   ├── MessageList.tsx     # メッセージ一覧
│   │   └── MessageInput.tsx    # 入力フォーム
│   └── escrow/
│       ├── ApproveButton.tsx   # 承認ボタン
│       ├── CancelButton.tsx    # キャンセルボタン
│       └── ConfirmDeliveryButton.tsx  # 納品確認ボタン
├── hooks/
│   ├── useXmtpChat.ts          # XMTPチャット
│   └── useEscrowActions.ts     # approve, cancel, confirmDelivery追加
└── lib/
    └── xmtp.ts                 # XMTPクライアント
```

### hooks更新

```typescript
// useEscrowActions に追加
useEscrowActions(address) → {
  lock,
  submit,
  approve,      // 新規
  cancel,       // 新規
  confirmDelivery,  // 新規
  txStep,
  error,
}
```

---

## 実装タスク

### Phase 1: コントラクト改修
- [ ] MilestoneEscrowV3.sol 作成
  - [ ] Status enum追加
  - [ ] approve() 実装
  - [ ] cancel() 実装
  - [ ] confirmDelivery() 実装
  - [ ] submit() 修正（最終マイルストーン除外）
  - [ ] マイルストーンbps調整
- [ ] ListingFactoryV3.sol 更新（新Escrowをdeploy）
- [ ] Remixでテスト
- [ ] Amoyにデプロイ

### Phase 2: XMTPチャット
- [ ] @xmtp/xmtp-js インストール
- [ ] lib/xmtp.ts 作成
- [ ] useXmtpChat.ts フック作成
- [ ] ChatWindow.tsx コンポーネント作成
- [ ] MessageList.tsx 作成
- [ ] MessageInput.tsx 作成

### Phase 3: フロントエンド更新
- [ ] useEscrowActions にapprove/cancel/confirmDelivery追加
- [ ] マイページUI更新
  - [ ] LOCKED状態の表示
  - [ ] チャットウィンドウ組み込み
  - [ ] 承認/キャンセルボタン
- [ ] 詳細ページ更新
  - [ ] 状態表示（OPEN/LOCKED/ACTIVE/COMPLETED/CANCELLED）
  - [ ] 最終マイルストーンの「納品確認」ボタン

### Phase 4: テスト
- [ ] 承認フローテスト
- [ ] キャンセルフローテスト
- [ ] チャット機能テスト
- [ ] 納品確認フローテスト

---

## テストシナリオ

### 正常フロー
1. Producer が出品（OPEN）
2. Buyer が購入 lock()（LOCKED）
3. XMTPでチャット開始
4. 条件合意 → Buyer が approve()（ACTIVE）
5. Producer が submit() × (N-1)回
6. 最終マイルストーン → Buyer が confirmDelivery()（COMPLETED）

### キャンセルフロー
1. Producer が出品（OPEN）
2. Buyer が購入 lock()（LOCKED）
3. XMTPでチャット
4. 条件合わず → Buyer が cancel()（CANCELLED）
5. JPYC全額返金確認
6. NFTがEscrowに戻る確認

### タイムアウト（将来実装）
- LOCKED状態で7日経過 → 自動キャンセル
- 最終マイルストーン提出後14日 → 自動承認

---

## セキュリティ考慮

| リスク | 対策 |
|--------|------|
| Buyerが承認しない | タイムアウト自動承認（将来実装） |
| Buyerがキャンセル悪用 | 少額のキャンセル手数料（将来実装） |
| チャット内容の改ざん | XMTPのE2E暗号化 |
| 第三者によるチャット閲覧 | conversationIdでエスクロー単位に分離 |
| Producerが納品しない | 最終報酬を大きく設定（インセンティブ） |

---

## 依存パッケージ追加

```bash
pnpm add @xmtp/xmtp-js
```

---

## 環境変数（変更なし）

```bash
NEXT_PUBLIC_RPC_URL=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_FACTORY_ADDRESS=<V3 Factory address>
NEXT_PUBLIC_TOKEN_ADDRESS=<MockERC20 address>
NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE=https://amoy.polygonscan.com/tx/
```
