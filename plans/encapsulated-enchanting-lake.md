# B2B Escrow チャットUI化 実装計画

## 概要

現在のマーケットプレイス型UIをチャットUI（AIエージェント対話型）に拡張する。
既存UIは残し、`/agent` に新しいチャットUIを追加。

### 対応ユーザーロール

| ロール | チャットでできること |
|--------|---------------------|
| **出品者（Producer）** | 自然言語で出品条件を説明 → ドラフト生成 → 署名して出品 |
| **購入者（Buyer）** | 出品検索・詳細確認 → 購入意思表明 → 署名して購入（lock） |

両方のロールが同じチャットUIで操作可能。ウォレット接続アドレスで自動判別。

## 決定事項

- **Gemini API認証**: Direct API Key
- **UI構成**: `/agent` を新設（既存UIは並行運用）
- **作業場所**: `/Users/you/programming/hackathon` にクローン

---

## 実装ステータス

### ✅ 完了（2026-02-05）

| Phase | 内容 | ステータス |
|-------|------|-----------|
| Phase 1 | リポジトリセットアップ | ✅ 完了 |
| Phase 2 | Agent API 実装 | ✅ 完了 |
| Phase 3 | チャットUI 実装 | ✅ 完了 |
| Phase 4 | Header リンク追加・ページ統合 | ✅ 完了 |

### 作成したファイル一覧

```
apps/web/src/
├── app/
│   ├── agent/
│   │   └── page.tsx              ✅ チャットページ
│   └── api/
│       └── agent/
│           └── chat/
│               └── route.ts      ✅ Gemini API (POST/GET/DELETE)
├── components/
│   ├── Header.tsx                ✅ /agentリンク追加済み
│   └── agent/
│       ├── AgentChat.tsx         ✅ メインチャットコンテナ
│       ├── MessageList.tsx       ✅ メッセージ一覧
│       ├── MessageInput.tsx      ✅ 入力フォーム（クイックアクション付き）
│       ├── ThinkingPanel.tsx     ✅ tool use / state 表示
│       ├── DraftPreview.tsx      ✅ 出品ドラフトプレビュー
│       ├── MilestoneTable.tsx    ✅ マイルストーン表
│       ├── TxConfirmPanel.tsx    ✅ TX署名確認パネル
│       └── index.ts              ✅ エクスポート
├── hooks/
│   └── useAgentSession.ts        ✅ セッション管理フック
└── lib/
    └── agent/
        ├── types.ts              ✅ 型定義
        ├── tools.ts              ✅ Tool実装（5個）
        ├── prompts.ts            ✅ システムプロンプト
        ├── gemini.ts             ✅ Gemini SDK初期化
        └── index.ts              ✅ エクスポート
```

### ビルド確認

```
✅ pnpm build 成功
✅ TypeScriptエラーなし
✅ ESLint警告なし
```

---

## 🔜 次にすべきこと

### 1. 環境変数の設定（必須・即時）

```bash
cd apps/web
cp .env.example .env.local
```

`.env.local` に以下を設定:
```
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash-preview-05-20
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://...
NEXT_PUBLIC_CHAIN_ID=80002
```

### 2. ローカル動作確認（必須）

```bash
cd apps/web
pnpm dev
# http://localhost:3000/agent にアクセス
```

**確認項目:**
- [ ] ウォレット接続が動作する
- [ ] チャット入力 → Gemini応答が返る
- [ ] Tool useがThinkingPanelに表示される
- [ ] ドラフト生成 → DraftPreview表示
- [ ] TxConfirmPanelで署名フローが動作

### 3. Phase 5: Cloud Run デプロイ（未着手）

#### 3.1 Dockerfile作成

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
CMD ["node", "server.js"]
```

#### 3.2 next.config.ts修正

`output: 'standalone'` を追加する必要あり

#### 3.3 デプロイコマンド

```bash
gcloud run deploy b2b-escrow --source apps/web \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=..."
```

### 4. P1改善（オプション）

- [ ] ストリーミングUI（Gemini streaming response対応）
- [ ] アニメーション強化
- [ ] エラーハンドリングUI強化
- [ ] モバイルレスポンシブ対応強化

---

## デモ台本（3分）

### シナリオ1: 出品（1分30秒）

| 時間 | 入力 | 画面 |
|------|------|------|
| 0:00 | ウォレット接続 | MetaMask接続 |
| 0:15 | 「神戸牛A5を50万円で売りたい」 | ThinkingPanel: tool use表示 |
| 0:30 | 「最高級の神戸牛です」 | DraftPreview + MilestoneTable表示 |
| 0:50 | 「これで出品」 | TxConfirmPanel表示 |
| 1:10 | 署名ボタン | MetaMask署名 → 成功 |

### シナリオ2: 購入（1分30秒）

| 時間 | 入力 | 画面 |
|------|------|------|
| 0:00 | ウォレット接続（別アカウント） | 接続完了 |
| 0:15 | 「和牛の出品を見せて」 | 出品一覧表示 |
| 0:30 | 「最初のを購入したい」 | 詳細 + マイルストーン説明 |
| 0:50 | 「これで購入」 | TxConfirmPanel（lock） |
| 1:10 | 署名ボタン | approve → lock → 成功 |

---

## 優先度チェックリスト

### P0（デモ成立）
- [x] リポジトリクローン
- [x] Agent Chat API
- [x] チャットUIページ
- [x] ThinkingPanel（tool use表示）
- [x] DraftPreview
- [x] TxConfirmPanel
- [x] Header リンク追加
- [ ] **環境変数設定**
- [ ] **ローカル動作確認**
- [ ] **Cloud Runデプロイ**

### P1（映え強化）
- [ ] ストリーミングUI
- [ ] アニメーション強化
- [ ] エラーハンドリングUI強化

---

## 技術メモ

### Gemini Tools定義

| Tool | 目的 | Human署名 |
|------|------|-----------|
| `get_listings` | 出品一覧取得 | 不要 |
| `get_listing_detail` | 出品詳細取得 | 不要 |
| `prepare_listing_draft` | 出品ドラフト生成 | 不要 |
| `get_milestones_for_category` | マイルストーン取得 | 不要 |
| `prepare_transaction` | TX準備（署名前確認UI表示） | **必要** |

### AgentState遷移

```
idle → gathering_info → draft_ready → tx_prepared → completed
```

### 署名が必要な操作（Human-in-the-loop）

| 操作 | 関数 | 署名者 |
|------|------|--------|
| 出品作成 | `createListing()` | Producer |
| 購入ロック | `lock()` | Buyer |
| 取引承認 | `approve()` | Buyer |
| 最終納品確認 | `confirmDelivery()` | Buyer |
| キャンセル | `cancel()` | Buyer |
