# Goal
このリポジトリ（https://github.com/usagi917/B2B_payment）をベースに、Google Cloud Japan AI Hackathon v4 の要件を満たす「Agentic売買→合意→エスクロー作成」デモを完成させる。
目的は“要件定義を固める壁打ち”と“開発プラン化”であり、いきなり実装に入らない。

# Hard Requirements (Hackathon)
- GCP アプリ実行: Cloud Run を必須採用（Next.jsをコンテナで稼働）
- GCP AI 技術: Gemini APIを必須採用
- デモで「エージェントっぽさ（tool use / plan / state）」が明確に見えること
- 署名/秘密鍵はエージェントが扱わない（Human-in-the-loop）

# Existing Repo Constraints
- 既存のNext.js構成を極力維持し、追加は局所化する
- 既存のNFT/Listing表示など、あるものを活かしてデモの完成度を上げる
- AIが失敗しても最低限の手動フローでデモが破綻しない設計にする

# Deliverables (What you must output)
以下をこの順番でMarkdownで出力すること。

## D1. Repo Snapshot (現状把握)
- 主要ディレクトリと役割（web / contracts / scripts など）
- 既にある「取引」「NFT」「メタデータ」「進捗」関連のエンドポイント/画面/コントラクトを列挙
- 既存の“デモで使える導線”を3つ挙げる

## D2. Product Definition (要件定義を固める)
- ターゲットユーザー（Buyer/Seller）とそれぞれのゴール
- MVPの価値提案（1〜2文）
- MVPスコープ（Must / Won’t）
- ユースケース（UC）を最大5本に絞って定義（入力→処理→出力→成功条件）

## D3. Agent Spec (エージェント仕様)
- Agentの役割（例: Deal Orchestrator）
- 入出力（JSON）: request/response を厳密に定義（キー名・型）
- Tools（function calling）を4〜6個に絞って定義
  - それぞれ: 目的 / 入力 / 出力 / 失敗時挙動
- 状態管理（会話/合意ドラフト/最終確定）の方針
- ガードレール（断定禁止、署名禁止、危険条件の検知）

## D4. Architecture (要件適合の構成)
- Cloud Run + Next.js + Gemini（Vertex AI or direct）の構成図（ASCIIで可）
- どのAPIがどこにあるか（Next.js route / server componentなど）
- 環境変数一覧（追加分だけ）
- 例外時フォールバック方針（AI失敗時）

## D5. Dev Plan (開発計画)
- P0（デモ成立）/ P1（映え強化）に分けたタスク分解
- 各タスク: 変更対象ファイル候補 / 実装手順 / 受け入れ条件
- 最小のCloud Runデプロイ手順（Docker→gcloud→deploy）
- デモ台本（3分）: 入力文と期待画面遷移を固定（2シナリオ）

# Operating Rules
- まず「要件を固める」こと。実装はP0計画までに留める（コードは書かない）。
- 不確実な点は「仮決め」として明示し、デモを壊さない安全側を採用する。
- 追加機能を増やしすぎない。エージェント性は“ツール実行ログ”で見せる。

# Demo Definition (Must show)
- 自然文 → 不足質問 → 合意ドラフト → マイルストーン表 → tx提案（署名前確認）
- 署名は人が行う（ウォレット）
- 作成後、Listing/NFT側で「進捗0%」「次アクション」が見える
