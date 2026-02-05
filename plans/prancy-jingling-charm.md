# Agent Chat UI/UX Fix: DraftPreview をチャットにインライン表示

## 問題

| フロー | カード表示場所 | UX |
|--------|---------------|-----|
| 購入 (Buyer) | TxConfirmPanel → チャット内インライン | 良い |
| 販売 (Producer) | DraftPreview + MilestoneTable → 右サイドパネルのみ | 悪い |

**具体的な問題点**:
- チャットしていると販売カードが上にスクロールしないと見えない
- モバイルでは右パネルが完全非表示（`display: { xs: "none", md: "flex" }`）なので DraftPreview が一切見えない
- 購入フローと販売フローで表示場所が一貫していない

## 解決方針

DraftPreview を TxConfirmPanel と同じパターンで**チャットメッセージ内にインライン表示**する。右サイドパネルからは DraftPreview / MilestoneTable を削除。

## 修正ファイル（3ファイル）

### 1. `apps/web/src/components/agent/MessageList.tsx`（主要変更）

TxConfirmPanel のインライン表示パターンをそのまま踏襲して DraftPreview を追加:

- `DraftPreview` を import
- `lastDraftMessageId` を `useMemo` で算出（`toolCalls` に `prepare_listing_draft` を含む最後のメッセージ）
- `shouldShowDraftCard` / `shouldRenderDraftFallback` フラグ追加
- `messages.map()` 内で `lastDraftMessageId` に一致するメッセージの直後に DraftPreview をレンダリング（`ml: "48px"`, `maxWidth: "75%"`）
- フォールバック: 該当メッセージがない場合はメッセージリスト末尾にレンダリング
- auto-scroll の依存配列に `fallbackDraft` を追加

### 2. `apps/web/src/components/agent/DraftPreview.tsx`

MilestoneTable の折りたたみ表示を追加:

- `useState` で `expanded` 状態管理を追加
- `MilestoneTable` を import
- マイルストーンチップの下に「詳細を見る / 閉じる」トグルを追加
- `Collapse` コンポーネント内に `MilestoneTable` を配置

### 3. `apps/web/src/components/agent/AgentChat.tsx`

右サイドパネルから DraftPreview / MilestoneTable を削除:

- `DraftPreview`, `MilestoneTable` の import を削除
- 右パネル内の `{draft && (<DraftPreview> + <MilestoneTable>)}` ブロックを削除
- ThinkingPanel + 空状態のみ残す

## 変更不要

- `types.ts`: `ChatMessage.draft` フィールドは既存
- `route.ts`: APIは既に `session.draft` をメッセージに付与（L486）
- `useAgentSession.ts`: `fallbackDraft` は既に MessageList に渡されている
- `MilestoneTable.tsx`: 変更なし（DraftPreview 内から参照するだけ）

## 変更後のチャット表示イメージ（販売フロー）

```
[User]: 神戸牛A5ランクを50万円で売りたいです
[Assistant]: 情報を整理中...
[User]: タイトルは◯◯
[Assistant]: ドラフトを作成しました (toolCall: prepare_listing_draft)
  ┌─────────────────────────────────┐
  │ 🥩 出品ドラフト                    │
  │ タイトル / 説明 / 金額 / マイルストーン │
  │ [▶ 詳細を見る]  ← 折りたたみ         │
  └─────────────────────────────────┘
[User]: この内容で出品して
[Assistant]: 署名の準備ができました (toolCall: prepare_transaction)
  ┌─────────────────────────────────┐
  │ 署名準備完了 - 出品作成              │
  │ [キャンセル] [ウォレットで署名]        │
  └─────────────────────────────────┘
```

## 検証方法

1. `cd apps/web && pnpm dev` でローカル起動
2. 販売フロー: 「和牛を売りたい」→ 情報入力 → DraftPreview がチャット内にインライン表示されることを確認
3. 購入フロー: 「出品を見る」→ 購入 → TxConfirmPanel が従来通りインライン表示されることを確認
4. モバイルビューポート（DevTools）で DraftPreview が見えることを確認
5. 右サイドパネルに DraftPreview / MilestoneTable が表示されないことを確認
6. DraftPreview 内の「詳細を見る」でマイルストーンテーブルが展開/折りたたみされることを確認
7. `pnpm build` でビルドエラーがないことを確認
