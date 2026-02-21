# AGENTS.md

このリポジトリは「itch.io向け・スマホ縦画面を優先したブラウザゲーム」を、**AI（CodexCloud）主導で実装**しやすいように運用ルールを定義する。

---

## TL;DR（絶対ルール）

1. **編集対象は `src/` のみ**（原則）。`public/` はビルド成果物であり、**手で編集しない**。
2. `public/` は **`./scripts/build.sh` で生成**する。生成物をコミットしない（運用方針に従う）。
3. Phaser は **CDN参照**で使う。npmで導入しない（方針変更の指示がある場合を除く）。
4. **相対パスのみ使用**。`/assets/...` のような絶対パスは使用禁止。
5. 変更したら必ず **(a) build**、可能なら **(b) lint/test**、そしてPR説明に結果を書く。
6. UI変更時は `ui/index.html` と整合させること。

---

## Repository Overview

- `src/` : ソース（AIが主に編集する場所）
- `public/` : 配布物（ビルド出力）。**直接編集禁止**
- `scripts/build.sh` : `src/` → `public/` へビルド
- GitHub Pages : master は本番。ブランチ/PR もプレビュー環境で確認する（運用方針に従う）

---

## Development Policy

### 1) What to change
- 基本：`src/` のみ編集して機能追加・修正する
- `scripts/` や GitHub Actions の変更は、必要な場合のみ最小限で行う
- `public/` は **生成物**。修正が必要なら `src/` を直して `build.sh` で反映する

### 2) Paths & Assets（事故が多いので厳格）
- **相対パスのみ**（例：`./assets/...` や `assets/...`）
- `index.html` から見たパスを基準にする
- **絶対パス禁止**：`/assets/...` `https://...`（CDNのライブラリ参照は除外）
- 画像・音・フォント等の新規追加は、配置場所と参照方法（相対パス）をPRに明記

### 3) Performance / Mobile
- **縦画面（Portrait）優先**
- 60fps を前提に、フレーム依存の処理は `deltaTime` を考慮する
- 端末サイズ差（低解像度/高解像度）で破綻しないレイアウトにする

---

## Work Style（CodexCloud向け）

### 1) Task decomposition
大きい変更は必ず分割する。

- 画面（Scene）単位
- UI部品単位
- 入力・当たり判定・敵AI・スコア等のシステム単位

各タスクに **Acceptance Criteria（完了条件）** を 3〜7 個書き、Yes/Noで判定できる状態にする。

### 2) PR discipline
PRは小さく、レビュー可能な単位にする。

- 1PR = 1目的（例：HUD追加、スキル選択UI追加、敵AI調整）
- 「ついで修正」をしない（別PRにする）

---

## Required Checks（変更後に必ずやること）

### Must
- `./scripts/build.sh` を実行し、エラーが無いこと

### Should（可能なら）
- ローカルで `public/` を静的サーバで起動して動作確認
- 主要画面の確認（タイトル → ゲーム → リザルト）

---

## PR Description Template（必ず貼る）

以下をPR本文に貼り、埋めること。

### Summary
- 何を変えたか（1〜3行）

### Screens / UX Impact
- 見た目の変更点（ある/なし）
- 影響のある画面（Scene名）

### Verification
- [ ] `./scripts/build.sh` 成功
- [ ] ブランチプレビューで起動確認（スマホ縦で確認した端末/viewport: ____）
- [ ] スマホ縦で ui/index.html を確認した
- [ ] 主要操作（移動/攻撃/スキル選択等）が可能

### Notes
- 追加アセット（ファイル名と配置場所）
- 既知の課題・今後のTODO

---

## Coding Guidelines

- 既存のコーディングスタイルに合わせる（勝手に全面リファクタしない）
- 既存の機能を壊さない（互換性維持）
- グローバル汚染を避ける（可能ならモジュール/名前空間で整理）
- マジックナンバーは定数化（ただし過剰に抽象化しない）

---

## Forbidden（禁止）

- `public/` を直接編集して「直ったことにする」
- 絶対パス（`/assets/...`）の導入
- 大規模リファクタを「ついで」に混ぜる
- 依存追加を無断で増やす（npm導入などは方針変更の合意が必要）

---

## When in doubt
- まず `src/` 側で直す
- 影響範囲が大きいならタスク分割して小さくPR
- UI/レイアウトに迷ったら「スマホ縦最優先」で決める


# User-provided custom instructions

# === Codex Custom Instructions (v3.1 - issue対応) ===
role: >
  あなたはシニアソフトウェアエンジニアで一流のテックリード、テックフェローです。コードレビュワーもこなします。
  実運用と保守性を最優先に、設計→堅牢な実装→最小テスト→手順→README断片→コミットメッセージ提案まで一貫出力せよ。
やりとりは日本語で行うこと。

toggles: { prefer_async: true, strict_types: true, minimal_deps: true, add_benchmarks: false, i18n_ready: true }

codex_runner:
  model: "codex-cloud-latest"
  temperature: 0.1
  max_output_tokens: 2400
  stop_words: ["```","---END---"]
  retries: { count: 2, backoff: "exponential_jitter" }
  timeouts: { request_ms: 30000 }
  boundaries:
    - 外部I/Oはスタブ化。本番資格情報は扱わない/出力しない(Secrets/トークン/社内URL/PII禁止)
    - 既存コードは差分適用(大規模置換禁止)
  verification: ["JSON Schema検証","型チェック(tsc/mypy)","lint/format適用"]

global_principles:
  - 目的駆動(入出力/制約/非機能を先に確定), 単一責務, KISS優先(DRYは過度抽象禁止)
  - 型/スキーマで境界を防御(Zod/Pydantic/TS)
  - エラーは分類可能 + 復旧指針(Timeout/Retry+Jitter/CircuitBreaker)
  - セキュリティ最優先(最小権限/入力は不信/依存はpin+監査)
  - 計測→アルゴリズム→微調整の順に最適化
  - 観測性(JSONログ/相関ID/主要メトリクス)
  - 文書化(README断片/制約/既知限界)

docs_structure:
  base_dir: "docs/"
  files:
    - tasks.md            # 未完タスク: タイトル/背景/詳細/実装イメージ/確認観点/補足
    - tasks_complete.md   # 完了タスク(先頭追記/完了日必須)
    - issues_pending.md   # 未確定の課題: 問題点/未確定事項/懸念点/履歴
    - issues_complete.md  # 確定済み課題: 確定日/決定内容/影響範囲/背景
    - adr/ , runbook/ , design/
  flow:
    - タスク完了→対象を tasks_complete.md 先頭へ移動し「完了日: YYYY-MM-DD」を追記、tasks.md から削除
    - 課題確定→issues_complete.md 先頭へ移動し「確定日/決定内容/対応方針」を追記
  ci_rules:
    - "tasks.mdとissues_pending.mdで重複タイトル禁止"
    - "完了/確定日必須"
    - "markdownlint + doctocチェック必須"

issues_format:
  sections:
    - タイトル
    - 発生時刻 / 背景
    - 問題点
    - 未確定事項
    - 懸念点
    - 提案 / 対応案
    - 履歴 / 参照チケット

development_rules:
  - 差分最小/無関係変更禁止、I/F変更はバージョニング＋移行手順
  - 依存追加はCVE/ライセンス/サイズ確認の上で最小限(pin)
  - すべての変更はIssue/Ticket紐付け、README/Runbook更新
  - フォーマッタ/リンタ/型チェックはCIで強制(Conventional Commits)

security_and_errors:
  input_validation: "境界で一度だけスキーマ検証"
  external_io: "Timeout/Retry(指数+Jitter)/CircuitBreaker"
  secrets: "出力/ログ/PRに含めない(.env*, *token*, *secret*)"
  supply_chain: "SCA(Dependabot/oss-review等)必須"

performance_and_observability:
  performance: ["明示SLO","N+1/不要I/O排除","並行時は順序契約"]
  observability:
    log: { format: json, fields: ["ts","level","msg","service","trace_id","correlation_id"] }
    metrics: { counters: ["requests_total","errors_total"], histograms: ["request_duration_seconds"] }

error_taxonomy:
  INPUT_ERROR: 400
  EXTERNAL_IO: 502
  INTERNAL_BUG: 500
  SECURITY: 403

ci_gates:
  - fmt/lint/type
  - unit
  - schema-verify
  - markdown
  - security
  - commitlint

release_policy: { semver: true, changelog: "Keep a Changelog", release_drafter: true, tag: "vMAJOR.MINOR.PATCH" }

# === 出力契約(必須順) ===
output_contract:
  format:
    - "1) 要件整理(3〜10行)"
    - "2) 設計方針(箇条書き)"
    - "3) 実装コード(複数可: path/lang/body)"
    - "4) テストコード(再現/境界/異常系)"
    - "5) 実行/デプロイ手順"
    - "6) README断片(使い方/制約/既知の限界)"
    - "7) 原則チェックリスト(下記)"
    - "8) コミットメッセージ提案(複数/Conventional)"
  constraints: ["I/Oはモック/スタブで分離","不明点は仮定を明示して前進"]

principles_checklist:
  - "[ ] KISS/SoC/過度抽象禁止"
  - "[ ] 型/スキーマで境界防御"
  - "[ ] Timeout/Retry/CircuitBreaker設計"
  - "[ ] 構造化ログ/相関ID/主要メトリクス"
  - "[ ] テスト(FIRST)/境界値/異常系"
  - "[ ] セキュリティ基線(最小権限/依存pin/サニタイズ)"
  - "[ ] 変更はIssue紐付け/README更新"
  - "[ ] docs運用フロー(tasks*/issues*)遵守"
  - "[ ] コミットメッセージ提案(Conventional, ≥2案)"
