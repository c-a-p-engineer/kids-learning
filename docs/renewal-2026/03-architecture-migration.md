# PROJECT DOPAGAKI — アーキテクチャ刷新・移行計画

**実装との差分（2026-10-26）:** V2最初の10ゲームは、フレームワーク追加を避けたVanilla TypeScript + Viteで構築。Preact/IndexedDBは未採用、記録は新localStorageキーで管理。完全版は引き続き候補です。現行アーキテクチャは docs/architecture.md を正とします。現行11ゲームは退避ブランチに保存し、新版から旧ソースを撤去済み。旧データ移行・長編RPG・ユーザー評価は今後の課題です。


状態: 2026-10-26 初期設計決定 / 実装未着手
基準: master @ 85a5d2cf5f7c5bc709bb267fb1601f7224defdb5
教育成果物: 02-game-design.md / 現行資産: 00-legacy-inventory.md

## 1. 判断：バックエンドを作らず、クライアントアーキテクチャを入れ替える

**推奨: TypeScript + Vite継続。UIはPreactを候補採用し、教育ドメインはフレームワーク非依存の純粋関数で実装する。ゲーム固有描画はCanvas2D/SVGを必要時使用する。**

これは現行の src/main.ts に集まったルーティング・表示・描画と、ゲームごとの保存・採点・難易度を分離するための構造変更。Preactは採用候補であり、新依存導入は実装時に実測比較して確定する。

### 候補比較

| 候補 | 利点 | 費用/危険 | 判断 |
|---|---|---|---|
| 現行Vanilla TSのまま小改修 | 移行費用小、既存実装との親和性 | ゲーム間で状態・UI・記録重複が残りやすい | V1の小修正なら良いが今回の長期統合には不足 |
| React + TS | ecosystemと採用事例が豊富、画面状態を分離しやすい | runtime/依存が相対的に大きくなりやすい | 拡張性は有力。軽量端末を第一目標とするため次点 |
| **Preact + TS** | 軽量なコンポーネント設計、Viteと相性が良い、static SPAで成立 | 互換APIの差異、追加移行作業、採用実績と保守 | **第一候補**（V2 shell） |
| Phaserへ一括移行 | 2D演出・スプライト・入力統合に優れる | 描画系に全て寄せるとフォーム/アクセシビリティ/学習記録が重くなる | 全体基盤としては不採用。必要なゲームシーンのみ限定検討 |
| サーバー/生成AI付きプラットフォーム | 端末横断同期や高度推薦の拡張余地 | 個人情報、運用費、子どものデータ取り扱い、障害点 | 今回不採用 |

### 継続するもの

- GitHub Pagesによる静的配信、直URLの404復元、相対アセットパス
- TypeScriptによる課題エンジンの型保証、Vite build
- Web Speech / Audio / pointer / canvas等のネイティブ端末APIは必要に応じて再利用
- 既存11教材の問題内容・採点意図・学習履歴、操作アクセシビリティ
- 保護者のみが設定・バックアップ・削除を操作

## 2. 推奨モジュール境界

構想ディレクトリ（未作成）:

    src/v2/
      bootstrap/
        app.ts                 # 初期化と環境切替
        routes.ts              # Pages互換ルーティング
      domain/
        items.ts               # Item / Skill / Gradeなどの純粋データ型
        attempt-reducer.ts     # 二重送信を排除する回答確定器
        mastery.ts             # ヒント有無/後日正答からの習得推定
        review-scheduler.ts    # 分散復習のスケジュール
        quest-planner.ts       # 3〜5問の学習バランス
        reward-policy.ts       # 教育イベントに結びつく決定論的報酬
      activities/
        number-shield/
        listening-spell/
        rail-sequence/
        shape-repair/
        clock-train/
        stroke-magic/
        traffic-stop/
        balloon-play/
      presentation/
        app-shell/
        quest-map/
        answer-ui/
        results/
        parent-dashboard/
      effects/
        effect-presets.ts
        audio-gateway.ts
        haptics-gateway.ts
        scene-engine.ts
      infrastructure/
        legacy-readers/
        attempt-repository.ts
        storage-migrations.ts
        offline-capabilities.ts

**依存方向: Presentation / Activities / Infrastructure → Domain。DomainはDOM、Storage、PreactやPhaserを参照しない。**

- ゲームを差し替えても学習記録・復習予定・報酬基準は変わらない。
- 報酬ポリシーは学習判定から呼び出し、子どもの連打や表示フレーム数から付与しない。
- 演出は単純なUI状態イベントを消費し、音・振動・派手さが無効でも採点に影響しない。
- 弱い端末では基本CSS/Canvasで成立し、WebGL系描画は採否を実測してから追加する。

## 3. インターフェース契約（型定義案）

    type AttemptOutcome = "correct" | "incorrect" | "skipped";
    type ReviewReason = "new" | "due" | "retry" | "challenge";

    interface LearningItem {
      itemId: string;
      revision: number;
      skillId: string;
      activityId: string;
      difficulty: number;
      instructions: LocalizedInstruction;
      content: ItemContent;
      hints: HintStage[];
    }

    interface AttemptEvent {
      eventId: string;           // idempotency key
      itemId: string;
      itemRevision: number;
      skillId: string;
      anonymousProfileId: string;
      sessionId: string;
      occurredAt: number;
      outcome: AttemptOutcome;
      hintCount: number;
      responseVariantId?: string;
      reviewReason: ReviewReason;
    }

    interface SkillReviewState {
      skillId: string;
      nextDueAt: number;
      intervalIndex: number;
      observedIndependentRecall: number;
      lastAttemptAt: number;
    }

    interface LearningActivity {
      id: string;
      createItem(context: SkillContext): LearningItem;
      validate(answer: unknown, item: LearningItem): AttemptOutcome;
      getHint(item: LearningItem, level: number): HintStage | null;
    }

型は方向付けであり、入力Schemaや保存実装の確定APIではない。
**正答判定はDOMイベントやアニメーションを直接参照しない**。イベント reducer はeventIdとsessionId+itemId+question-instanceを用いて同一回答の多重コミットを拒否する。

### Quest State Machine

    idle → quest_selected → presenting → answering
                                          │
                                   ┌──────┴──────┐
                                   │             │
                                correct       incorrect
                                   │             │
                               committed      hint / retry
                                   │             │
                                   └──────┬──────┘
                                          ▼
                                      next_item
                                          │
                                   items_complete
                                          ▼
                                    result_closed

- error/mistapは復元可能な局所状態として処理する。
- session終了後に自動で次のsessionを開始しない。
- 未回答・中断・skipは正誤と独立して保存/扱いを定義する。
- ゲームリプレイや画面戻りでXPや正解数を重複加算しない。

## 4. 保存設計とV1移行

現行: 各ゲームがlocalStorageへ別形式で保存。新設: IndexedDBを第一候補とするローカル学習イベントストア、localStorageは旧ソースの読み取り互換に使用。数十件程度しか持たない初期MVPはまず保存API境界と整合性を実装し、IndexedDB採用可否は容量・トランザクション要件を測って確定する。

- ストア: profiles（匿名）、itemsのrevision、attemptEvents、skillReviewStates、questSessions、preferences、migrationLedger。
- データ最小化: 氏名、生年月日、学校名、発達診断、身体映像は必須にしない。
- schemaVersionと旧sourceKeyの読み取りrevisionを持ち、migrationLedgerに完了印を付ける。
- 移行時は旧キー群を列挙し、valid JSON、許容形状、記録の上限を検証し、コピーのみ行う。
- 旧キーは一切削除しない。旧データを新形式へ変換できない場合はそのキーだけskipし、保護者へ復旧可能な警告を返す。
- 二度目の移行で同じ履歴を重複挿入しない。旧履歴に安定IDがない場合、sourceKeyとordinalと元コンテンツfingerprintで重複識別する設計を検証する。
- V1の高得点、履歴、タイムと、V2の独力後日保持は別概念。旧記録をマスタリーの「達成済み」に自動変換しない。
- 家庭内の別ブラウザ/別端末は別記録のまま。同期や子どものアカウント登録は今回の対象外。
- 公開切替前に保護者エクスポートとインポート、容量不足・破損JSON・データ0件のテストを追加。

## 5. 移行フェーズ（依存順）

| Phase | 実施内容 | 受け入れ条件 | 現在 |
|---|---|---|---|
| 0 | 旧コード退避・11ゲーム台帳・科学根拠・製品設計・移行案 | 旧版の到達経路と必要な学習成果が文書化される | docs作成中 |
| 1 | 保存キー全量監査、characterization tests、実端末の基準画面記録 | 旧ゲームと履歴の正常/異常操作が再現できる | 未着手 |
| 2 | domain-core（問題、回答、進捗、間隔復習、報酬）純粋関数と単体テスト | 反復入力でも二重採点なし、復習予定を再計算できる | 未着手 |
| 3 | V2 Shell + Quest Map + 分野別活動1本 | 360px/タブレット、音無し、reduced-motion、終了条件で完走できる | 未着手 |
| 4 | 算数系4本→記憶/聞き取り2本→描画2本→図形/交通2本→身体ゲーム1本を順次移行 | 旧の重要ルール、正解、入力と履歴が移行テストを通過 | 未着手 |
| 5 | 遅延復習、ボス戦、ワールド復旧、保護者ダッシュボード | ヒント無し後日再想起と報酬が相互に矛盾しない | 未着手 |
| 6 | 旧データcopy-only移行、検証、previewでの家庭テスト | 保存損失・UI回帰がなく、古いURLが利用可能 | 未着手 |
| 7 | 本番切替・旧版rollback維持 | master→Pages公開、直接URL、モバイル、履歴等の実物を確認 | 未着手 |

全11ゲームを同時に新規実装しない。「学習基盤＋最初の1ゲーム」を縦切りで確認し、共通契約の不備を修正してから残りを移植する。

## 6. 公開・CIとcutover戦略

- archive/pre-dopagaki-20261026 を旧版保存ブランチとして維持。元コミットSHA 85a5d2... も固定参照。
- feat/dopagaki-learning-redesign-20261026 上での開発を優先。master（本番）へ未検証の全面置換を混入させない。
- npm ci、npm run typecheck、./scripts/build.sh、対象の自動テストを必須にする。
- 旧V1と新V2を別URL/previewで確認する。ブランチプレビューの実URLはGitHub Actionsの実結果を確認してから配布する。
- 対応OS/デバイス: 360×640スマホ、768×1024タブレット、横画面、タッチ、キーボード、音声オフ、reduced-motion、200%文字拡大。
- 内部ビューのリンクと旧URLを保つ。公開後の旧データ読み込みと戻る/再開を検証する。
- 本番切替後も元ブランチ/元コミットを削除しない。障害時はPages公開リビジョンとルーティング/保存を戻せる。
- ブラウザデータはGitとは別の持ち主なので、巻き戻しでV2による追加データの整合性を損ねないよう前進互換を確認する。

## 7. 停止条件 / コストガード

- 旧履歴に未説明の欠損・削除が出る
- 同じ回答による多重XP加算が起きる
- 音・光・ドラッグに依存して、対象児の参加が難しくなる
- 終了できない、休憩を阻む仕組みが入る
- 診断に使えるかのように注意/行動の値を表示する
- 未確認の新規有料API/外部課金が必要になる
- 新frameworkの保守負担・ビルド負荷が現行より大きくなるのに実際の改善が説明できない

## 8. 完了判定の区別

**構想とコミットがある = リリースされた**、ではない。
- 設計: ドキュメント、論文URL、全11項目が揃う
- 実装: ビルド/テスト/実ブラウザで動く
- 公開: 対象commitが実際のGitHub Pagesへデプロイされアクセスできる
- 学習効果: ヒントなしの後日保持などを測って初めて比較可能

初期ドキュメント時点では上の最初の状態までを成果とする。
