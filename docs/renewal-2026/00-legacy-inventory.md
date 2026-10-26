# 2026-10-26 現行ゲーム資産台帳（刷新前）

状態: 実装変更前の資料 / 調査基準: kids-learning master @ 85a5d2cf5f7c5bc709bb267fb1601f7224defdb5
保管先: archive/pre-dopagaki-20261026（旧実装のブランチ保存）。
注意: 以下は現時点のソース登録・仕様書を突き合わせた台帳であり、11ゲームの実機E2E動作を実行済みと示すものではない。

## 目的

- 全面刷新中も旧作の目的、体験、入力方法、スコア、履歴、バグ修正意図、URLを失わない。
- 旧版をリファレンスとして残す。新バージョンは影の実装として比較し、公開先の切り替えは別途検証する。
- 子どもの実データは本リポジトリへ保存しない。学習記録は利用端末内であり、Gitブランチだけではバックアップできない。

## 登録済み11コンテンツ

| ID | 旧ゲーム | 学習目的/操作 | 旧セッション・保存 | まずの移行判定 |
|---|---|---|---|---|
| listening-mission | きいて！ミッション | 聞き取り、短い手順の保持、待機、Go/No-Go、条件判断／読み上げ後タップ | LV1〜6、5問固定、履歴40件 | 6種の課題定義を再利用し、新しい指示・認知クエストへ再構築 |
| traffic-crossing | しんごうを わたれ！ | 見る・停止・再開／長押しで前進、離すと停止 | LV1〜6、最速5件/レベル | 判断ルールを保存し、シーン・UIを再制作。実道路での安全行動を保証しない |
| fit-shape | ぴったりシェイプ | 図形の照合と空間認識／ドラッグ&ドロップ | 図形3/5/8、30秒 | 正解判定を課題エンジンへ移し、ドラッグが難しい子向けのタップ代替も検討 |
| flashcard | えもじフラッシュ | 視覚記憶・再想起／カードを見て2択 | 5難易度、履歴50件 | 刺激素材と想起課題を保持し、間隔復習の独立コンテンツへ |
| dotburst | ドットバースト | 数のまとまり認識／ドット数を選ぶ | 2難易度、30秒 | 数量課題生成・採点を再利用し、成長演出と統合 |
| number-sequence | かずの ならび | 数順・規則性／欠けた数を3択 | 3難易度、30秒、履歴50件 | 数列問題を共通教材パックに抽出 |
| larger-number | どっちが大きい？ | 数の大小比較／数カードを選ぶ | 3難易度、スコアとコンボ | 比較課題を算数クエストへ移動 |
| clock-reading | とけいを よもう | 針と時刻の対応／3択 | 3難易度、30秒、履歴50件 | 時刻認識を算数・生活クエストへ移動 |
| pencil-practice | えんぴつれんしゅう | 運筆・描画／始点からゴールまで軌跡入力 | 60秒、スコア・再生・厳格評価、履歴上限あり | 手指操作と正答を分離評価。軌跡再生を温存 |
| kakitori | かきとりマスター | かな・漢字の書字／指またはペンで描く | 保護者の課題設定、筆順・画像・軌跡・練習履歴 | 描画エンジンと元データを特に慎重に継承 |
| balloon-attack | 30びょう バルーンアタック | 身体活動／カメラの前で動いて割る | 30秒、STEP外 | 認知課題の強制報酬とは別の休息・身体遊びへ。カメラ映像は原則不保存 |

## 保存キーと互換性台帳

| 所有領域 | 現行キー | 取得根拠 |
|---|---|---|
| きいて！ミッション | listening_mission_v1_history | docs/きいてミッション.md |
| しんごうを わたれ！ | traffic_crossing_v1_scores | docs/しんごうをわたれ.md |
| ぴったりシェイプ | shape_match_history_v1 | docs/ぴったりシェイプ.md |
| えもじフラッシュ | emoji_v10_history | docs/えもじフラッシュ.md |
| ドットバースト | dot_burst_v8 | docs/ドットバースト.md |
| かずの ならび | number_sequence_v1_history | docs/数の並び.md |
| どっちが大きい？ | math_game_v8_history | docs/どっちが大きい？.md |
| とけいを よもう | clock_reading_v1_history | docs/時計をよもう.md |
| えんぴつれんしゅう | pencil_practice_v1_history | docs/えんぴつれんしゅう.md |
| えんぴつれんしゅう | pencil_practice_v1_replays | 同上 |
| えんぴつれんしゅう | pencil_practice_v1_strict_results | 同上 |
| かきとり・課題 | h_m_v12 | src/app/constants.ts の STORAGE_KEYS.missions |
| かきとり・履歴 | h_h_v12 | src/app/constants.ts の STORAGE_KEYS.history |
| ポータルテーマ | ui_theme_v1 | src/main.ts |
| バルーンアタック | 未確定（個別実装の追加監査待ち） | README/コンテンツ一覧では保存仕様が確定できない |

上表のキーは旧仕様書記載を主とし、全キーを実装ソースで完全照合した状態ではない。移行スクリプトを実装する前に、ゲーム別の実コードとサンプルデータで検証する。

### 実装上の重要な互換条件

- listening-mission は旧 one/two/three の履歴を読み続ける。wait/nogo/conditionを追加している。
- traffic-crossing は現在の LV1〜6 表示外に保存された LV7〜10 の旧記録を消さない。
- kakitori は docs の説明上の missions/history が**実際のストレージキー名ではない**。現行 src/app/constants.ts にある h_m_v12 / h_h_v12 が正。
- pencil-practice は成果画像より軌跡・時刻・正規化座標・スキップ状態などの再生に必要な情報を優先保持する。
- 原始データのimportは**読み取り・複製だけ**とし、元のlocalStorageキーの削除・上書きを禁止する。
- 既存の家庭ごとの端末内記録はGitHub上からは確認・救済できない。別途保護者操作によるエクスポートを提供してから切り替える。

## 旧アーキテクチャ（コードから確認した範囲）

- Vite + TypeScript + Sass / 静的配信 GitHub Pages
- src/main.ts がポータル、ルーティング、かきとりと複数ゲームの初期化を大きく統合
- src/app/router.ts が /<contentId>/<view> 相当を管理
- src/contents/index.ts に上記11件を登録
- 一部は src/contents/*-game.ts、一部は src/*.ts に状態管理・描画が分散
- 各ゲーム個別 localStorage にスコア/履歴を保存
- src/public/404.html がPagesの深いURLアクセスを復元
- public/ は生成物で直接編集しない
- Web Speech/Web Audio、外部animCJK SVG、カメラ等、端末固有機能を使用

## 旧版の復元・比較

- 旧コードのスナップショット: https://github.com/c-a-p-engineer/kids-learning/tree/archive/pre-dopagaki-20261026
- 元の基準コミット: https://github.com/c-a-p-engineer/kids-learning/commit/85a5d2cf5f7c5bc709bb267fb1601f7224defdb5
- 旧仕様書: https://github.com/c-a-p-engineer/kids-learning/tree/master/docs
- 新しいゲームへ変える際は旧版/新版の同じ問題を比較し、「見た目が良い」ではなく課題の正答性・記録・端末操作・終了条件を照合する。

## 追加監査TODO

- 全11ゲームの実コードの保存キー・削除条件・乱数・タイマー・画面離脱処理の全量照合。
- バルーンアタックのカメラ開始停止、権限、保存・送信の実装確認。
- 初回→誤タップ→中断→再起動→履歴→旧URLを行うcharacterization tests。
- 移行前に旧版スクリーンショット、ゲームプレイ動画またはScenario QA画面記録を任意で保存（児童映像や個人情報は保存しない）。
