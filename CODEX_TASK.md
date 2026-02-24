あなたはシニアPdM兼アーキテクトです。対象リポジトリを読み、ハッカソン応募のために「要件定義を固め、実装計画に落とす」出力を作ってください。

# Inputs
- リポジトリ: usagi917/B2B_payment
- 制約/必須要件: CODEX_TASK.md を参照

# Work
1) リポジトリを調査して Repo Snapshot を作成
2) その現状にフィットする形で Product Definition を確定（Must/Won’t、UC、成功条件）
3) Agent Spec を JSON / Tools / Guardrails まで仕様化
4) 要件適合のArchitectureを確定（Cloud Run + Gemini）
5) P0/P1開発計画と3分デモ台本（入力文まで固定）を出す

# Output format
- CODEX_TASK.md の Deliverables（D1〜D5）に厳密に従い、Markdownで出力する
- テーブル可。曖昧な表現を避け、型・I/O・成功条件を明記する
- 「追加で必要な確認事項」がある場合は末尾に最大5個だけ列挙（ただし出力は止めない）
