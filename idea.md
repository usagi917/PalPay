結論：**Vercelで公開できる最小MVPとして「1ロット=1スマコン（工程駆動エスクロー）」＋「DBなし1ページdApp（ウォレット接続のみ）」に絞った、バイブコーディング用の要件定義を下記に固定します。**

---

## 理由

* ハッカソンMVPの勝ち筋は「工程＝支払い条件」「証跡＝紛争防止」の切り分けを、**壊れないE2E**で見せること。
* Vercel前提ではバックエンド/DBを捨てて、**オンチェーンイベント＝不変ログ**に寄せるのが最短。
* dAppsとしてはログイン不要で、**ウォレット＝主体**として扱える。

---

## 手順（この要件定義の使い方）

1. 下の要件定義をそのままコーディングAI（Cursor/ChatGPT/Codex等）に貼る
2. 生成されたリポジトリでローカル起動→テスト→テストネットデプロイ→Vercelデプロイ
3. 受け入れ基準（DoD）チェックを満たしたらMVP完成

---

## 比較（MVPのスコープ選択）

* 採用（本書）：**スマコン＋Vercel dAppのみ**（DB/サーバーなし）
* 不採用：SQLite/サーバー/複数ロット管理（Vercel最短を阻害）
* 将来：Factoryでロット量産、KYC/組織権限、オフチェーン証跡保管

---

## バイブコーディング用 要件定義（MVP固定・コピペ可）

### 1. プロジェクト概要

* 名称：Proof of Trust MVP（工程駆動・条件付き前払い決済OS）
* 目的：和牛の肥育工程を「支払い条件」として扱い、前払い資金を工程進行に応じて段階解放する
* 価値：前払いの信用を「人」から「工程ログ＋自動精算（スマコン）」へ移す
* 前提：投資商品ではなく、B2B取引の決済インフラ（利回り/転売/分割所有なし）

### 2. MVPスコープ（必須/非対象）

#### 必須（MVP）

* 1ロット=1スマートコントラクト（Escrow）
* ERC20トークンでロック/解放/返金（JPYC相当は“任意のtoken address”として注入）
* 工程テンプレ（E1〜E6＋E3月次6回）固定
* 証跡は「支払い条件ではなく」説明用：`evidenceHash(bytes32)` をオンチェーンイベントに記録
* dApp（Vercel）：1ページで Lock / Submit / Approve / Cancel / イベントタイムライン表示

#### 非対象（MVPではやらない）

* 投資性（利回り、転売、分割所有、勧誘）
* IoT自動測定、体重などの数値義務
* 画像アップロード/保管（URL保存すら不要。ハッシュのみ）
* ロット作成UI（Factory）、複数ロット一覧
* DB/サーバー、KYC、与信、請求書、会計

### 3. 成果物（Deliverables）

* `contracts/`：Solidityスマコン（OpenZeppelin利用、監査未実施MVP）
* `apps/web/`：Next.js（App Router, TypeScript）の1ページdApp
* `contracts/test/`：主要フローのテスト（Foundry推奨）
* `contracts/script/`：デプロイ用スクリプト（Foundry推奨）
* `README.md`：ローカル起動/デプロイ/Vercel手順、デモ手順、注意事項

### 4. ロール定義（認証/認可）

* 認証：ウォレット接続のみ（ログインなし）
* 認可：スマコンに固定アドレスとして埋め込む（デプロイ時に指定）

  * Buyer：ロック、承認
  * Producer：工程申請
  * Admin：キャンセル（中断確定）

### 5. ユースケース（E2E）

1. BuyerがERC20を`approve`してから、Escrowに総額を`lock`
2. Producerが工程`submit(index, evidenceHash)`で申請
3. Buyerが`approve(index)`で承認 → 工程の解放率ぶん ERC20 がProducerへ送金
4. Adminが`cancel(reason)`で中断 → 未解放分がBuyerへ返金
5. dAppがイベントログを読み取り、タイムラインに「誰が・いつ・何を」表示

### 6. 工程テンプレ（固定・合計100%）

* E1 契約・個体登録：10%
* E2 初期検疫・導入：10%
* E3 月次肥育記録：5%×6（E3_01〜E3_06）
* E4 出荷準備：10%
* E5 出荷：20%
* E6 受領・検収（買い手承認）：20%
* 解放率は bps（10000=100%）で管理し、合計が10000であることをコンストラクタで検証

### 7. スマートコントラクト要件（Solidity）

#### 7.1 コントラクト形態

* `MilestoneEscrow`：1ロット=1コントラクト
* コンストラクタ引数

  * `token`（ERC20アドレス）
  * `buyer` / `producer` / `admin`（固定）
  * `totalAmount`（総額）

#### 7.2 状態（State）

* `lockedAmount` / `releasedAmount` / `refundedAmount`
* `cancelled`（bool）
* `Milestone[] milestones`

  * `code(bytes32)`：例 `E1`, `E3_01`
  * `bps(uint16)`：解放率
  * `state(enum PENDING|SUBMITTED|APPROVED)`
  * `evidenceHash(bytes32)`：証跡（支払い条件ではない）
  * `submittedAt(uint64)` / `approvedAt(uint64)`

#### 7.3 関数（Functions）

* `lock()`：Buyerのみ。初回のみ。`transferFrom(buyer -> contract, totalAmount)`
* `submit(index, evidenceHash)`：Producerのみ。`PENDING -> SUBMITTED`
* `approve(index)`：Buyerのみ。`SUBMITTED -> APPROVED`、解放率ぶんProducerへ送金
* `cancel(reason)`：Adminのみ。`cancelled=true`、未解放分をBuyerへ返金
* view系

  * `milestonesLength()`
  * `milestone(index)`

#### 7.4 アクセス制御（Guards）

* ロック前は`submit/approve/cancel`不可（`NOT_LOCKED`）
* `approve`はSUBMITTEDのみ
* 二重実行防止（`ALREADY_LOCKED` / `BAD_STATE` / `ALREADY_CANCELLED`）
* `cancelled`後は一切の進行操作不可
* 送金は`SafeERC20`で実施

#### 7.5 イベント（Events）

* `Locked(amount, actor)`
* `Submitted(index, code, evidenceHash, actor)`
* `Released(index, code, amount, actor)`
* `Cancelled(reason, refundAmount, actor)`
* dAppのタイムラインは**イベントのみ**から生成する（DBなし）

#### 7.6 セキュリティ（最低限）

* 外部呼び出し（ERC20送金）を伴うため、状態更新→送金の順序を固定
* 監査未実施であることをREADMEとUIに明記
* 本番資金は扱わない（テストネット/デモ限定）

### 8. dApp要件（Next.js / Vercel）

#### 8.1 画面（1ページ）

* ルート：`/`
* セクション

  1. Connect Wallet（チェーンIDチェック、間違っていれば切替案内）
  2. Contract Summary（token/total/locked/released/refunded/cancelled）
  3. Role表示（接続アドレスが buyer/producer/admin のどれか）
  4. Actions

     * Buyer：Lock、Approve
     * Producer：Submit
     * Admin：Cancel
  5. Milestones一覧（index, code, bps, state, evidenceHash, submittedAt/approvedAt）
  6. Timeline（イベントを時系列表示：type/actor/amount/code/txHash/time）
  7. 免責・非投資宣言（必須文言）

#### 8.2 免責・非投資文言（UIに固定表示）

* 「これは投資商品ではなくB2B取引の決済インフラです」
* 「利回り・転売・分割所有・投資勧誘は扱いません」
* 「工数は支払い条件ではなく証跡（説明責任）のためのログです」
* 「監査済みコントラクトではありません（デモ用）」

#### 8.3 依存（推奨）

* EVM接続：`viem`（最小）
* ウォレット：MetaMask前提で可
* UI：Tailwind（最小でOK。shadcn/uiは任意）

#### 8.4 環境変数（Vercel/ローカル共通）

* `NEXT_PUBLIC_RPC_URL`
* `NEXT_PUBLIC_CHAIN_ID`
* `NEXT_PUBLIC_CONTRACT_ADDRESS`
* `NEXT_PUBLIC_TOKEN_ADDRESS`
* 任意：`NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE`

#### 8.5 エラー/UX要件（最低限）

* 未接続、チェーン不一致、権限なし、承認前などを明確なメッセージで表示
* `lock`前に ERC20 `approve` が必要であることを案内（dApp内でapprove導線を用意してもよい）

### 9. 開発・実行環境

* Node.js 18+、pnpm
* Foundry（forge/anvil）推奨
* リポジトリ構成例（ファイル名は英数字のみ）

  * `contracts/`
  * `apps/web/`

### 10. テスト要件（Foundry）

#### 10.1 必須テストケース

* lock

  * buyer以外がlock不可
  * 二重lock不可
* submit

  * lock前submit不可
  * producer以外submit不可
  * 状態遷移 PENDING->SUBMITTED
* approve

  * SUBMITTED以外approve不可
  * buyer以外approve不可
  * 解放額がbps計算どおり
  * 二重approve不可
* cancel

  * admin以外cancel不可
  * 未解放分がbuyerへ返金される
  * cancel後にsubmit/approve不可
* bps合計が100%であること

### 11. デプロイ要件

* スマコン：任意のEVMテストネット（チェーンは固定しない）

  * デプロイ後に `CONTRACT_ADDRESS` をdAppへ注入
* dApp：Vercelにデプロイ（静的+クライアントRPC）

  * 環境変数をVercelに設定して公開URLを得る

### 12. 受け入れ基準（Definition of Done）

* ローカルで以下が再現できる

  * Buyerがlockできる
  * Producerがsubmitできる
  * Buyerがapproveして解放送金が発生する
  * Adminがcancelして未解放分が返金される
  * dAppにタイムラインがイベントから表示される
* Vercelの公開URLで同等の操作が可能（RPC/環境変数が機能）
* UIに非投資宣言・監査未実施が明記されている

### 13. リスク/留意点

* JPYCを名指しする場合でも、MVPでは「任意ERC20」で抽象化し、チェーン前提の断定を避ける
* スマコンは監査未実施。実資金運用は禁止（テストネット限定）
* イベントログ取得はRPC品質に依存。UIはリトライ/ローディングを備える

### 14. 拡張案（将来）

* Factoryコントラクトでロット量産（複数ロット一覧UI）
* オフチェーン証跡（画像/メモ）をIPFS等に置き、ハッシュで紐付け
* 役割のAllowlist化、組織運用（複数担当者、2段階承認、マルチシグ）
* 工芸/製造への横展開：条件テンプレ差し替え

---

## 例（この要件でのデモ台本）

* Buyer接続 → approve(token) → lock
* Producer接続 → E1 submit（evidenceHash入力）
* Buyer接続 → E1 approve（解放を確認）
* Admin接続 → cancel（未解放分返金を確認）
* Timelineで全履歴（txHash含む）を提示
