# Fix: 初回チャット時の "Invalid nonce" 401 エラー

## 根本原因

Next.js App Router dev modeでは、各APIルートが別々のwebpackチャンクとしてコンパイルされる。`agentSecurity.ts` の `nonceStore`（インメモリMap）が**ルートごとに別インスタンスとして複製**されるため:

1. `/api/agent/nonce` の `issueNonce()` → **Map A** に書き込み
2. `/api/agent/chat` の `consumeNonce()` → **Map B** を参照 → nonceが見つからない → `"Invalid nonce"` 401

さらに、クライアント側のリトライロジックが初回nonce認証失敗をカバーしていない（sessionTokenがnullの場合リトライしない）。

## 修正内容（3ファイル）

### 1. `apps/web/src/lib/server/agentSecurity.ts` — `globalThis` シングルトン化

```typescript
// Before (壊れる):
const nonceStore = new Map<string, NonceRecord>();
const rateLimitStore = new Map<string, RateLimitRecord>();

// After (globalThis で永続化):
const g = globalThis as unknown as {
  __agentNonceStore?: Map<string, NonceRecord>;
  __agentRateLimitStore?: Map<string, RateLimitRecord>;
};
const nonceStore = (g.__agentNonceStore ??= new Map<string, NonceRecord>());
const rateLimitStore = (g.__agentRateLimitStore ??= new Map<string, RateLimitRecord>());
```

関数シグネチャ・エクスポートは変更なし。

### 2. `apps/web/src/app/api/agent/chat/route.ts` — sessions Mapも同様に

```typescript
// Before:
const sessions = new Map<string, { ... }>();

// After:
type SessionRecord = { history: Content[]; state: AgentState; ... };
const g = globalThis as unknown as { __agentSessions?: Map<string, SessionRecord> };
const sessions = (g.__agentSessions ??= new Map<string, SessionRecord>());
```

### 3. `apps/web/src/hooks/useAgentSession.ts` — リトライ条件の修正（148行目）

```typescript
// Before (tokenがnullだとリトライしない):
if (isAuthError && token && authRequired) {

// After (nonce認証失敗時もリトライ):
if (isAuthError && authRequired && (token || auth)) {
```

## 変更しないもの

- `nonce/route.ts` — `issueNonce()` の呼び出し元、変更不要
- `auth.ts`, `types.ts` — 変更不要
- `AgentChat.tsx` — 変更不要
- APIコントラクト — 変更なし

## 検証手順

1. `cd apps/web && pnpm dev`
2. ウォレットを接続してエージェントチャット画面を開く
3. 初回メッセージ送信 → 401エラーなく成功することを確認
4. サーバーファイルを編集してHMRを発火 → 再度メッセージ送信 → 成功を確認
5. `pnpm build` でビルドエラーがないことを確認
