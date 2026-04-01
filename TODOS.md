# TODOS

## インメモリセッション → 永続ストア
**What:** agentSecurity.ts のノンス/レート制限、route.ts のセッションを永続ストアに移行
**Why:** 現在 globalThis Map で保持しており、サーバー再起動やスケールアウトでデータ消失
**Pros:** 本番運用可能になる。水平スケーリング対応
**Cons:** Redis/DB導入のインフラコスト。開発環境の複雑化
**Context:** agentSecurity.ts:14-19 と route.ts:30-43。HMRは globalThis で生き延びるが、コールドスタートで消える
**Depends on:** インフラ選定（Redis vs DB vs Vercel KV）

## XMTP暗号鍵のlocalStorage保存
**What:** xmtp.ts の DB暗号化キーを localStorage から安全なストレージに移行
**Why:** localStorage はXSSで漏洩する。暗号化キーが平文で保存されている
**Pros:** セキュリティ向上。XSS耐性
**Cons:** Web Crypto API or IndexedDB への移行工数。ブラウザ互換性確認が必要
**Context:** xmtp.ts:110-123。getOrCreateDbEncryptionKey() が32バイト鍵をhex文字列でlocalStorageに保存
**Depends on:** なし

## エスクロー紛争解決モデル
**What:** バイヤー/プロデューサー間の紛争を仲裁するメカニズムの追加
**Why:** 現状は「バイヤーが確認、またはタイムアウトで売り手勝利」のみ。"Proof of Trust"と名乗るには不十分
**Pros:** 公平性向上。プロダクトの信頼性
**Cons:** コントラクトV7相当の変更。仲裁者の選定・報酬設計が必要
**Context:** ListingFactoryV6.sol:215,263,318。activateAfterTimeout/finalizeAfterTimeoutが一方的
**Depends on:** プロダクト設計判断。法的要件の確認

## フロントエンドテスト基盤
**What:** vitest/playwright を導入し、エージェント・UI のテストカバレッジを確保
**Why:** apps/web にテストファイルが1つもない。型チェックだけでは実行時の問題を検出できない
**Pros:** リグレッション防止。リファクタリング安全性
**Cons:** テスト基盤のセットアップ工数。CI時間の増加
**Context:** package.json にテストフレームワークの依存すらない状態
**Depends on:** なし

## インデクシング層
**What:** The Graph 等を使ったオンチェーンデータのインデクシング
**Why:** 現在 getListings() で全アドレスを直接チェーンから読んでおり、50件キャップ。スケールしない
**Pros:** 高速クエリ。フィルタリング。ページネーション対応
**Cons:** The Graph のサブグラフ構築・デプロイ工数。追加インフラ
**Context:** tools.ts:104-117 の fetchAllListingAddresses が MAX_LISTINGS_FETCH=50 でキャップ
**Depends on:** サービス選定（The Graph vs Goldsky vs カスタムインデクサー）
