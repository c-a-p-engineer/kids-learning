# KIDS LEARNING V2 のアーキテクチャ

2026-10-26 時点の現行コードを正とする。Preactは初期検討候補だったが、本実装では新しい依存を増やさずVanilla TypeScriptで15ゲームを構築した。

## 実行構成

~~~text
GitHub Pages (public/ を公開)
  ↑ scripts/build.sh → npm test + Vite build
src/index.html → src/quest-main.ts → src/engine.ts
                      │
                      ├── src/game.css
                      ├── ブラウザ読み上げ・効果音
                      └── localStorage（匿名プレイヤー別）
~~~

- src/engine.ts: GAMES、makeQuestion、evaluate、nextReview、chooseRound、countDue。画面・ブラウザAPIから独立した問題生成・採点・復習。
- src/quest-main.ts: ホーム、ゲーム、結果、保護者画面とイベント委譲。Sessionで5問の進行を管理。採点を確定してからXPと復習予定を保存する。
- src/game-audio.ts: ユーザーの操作後にWeb Audio APIでBGM/SEを合成。画面と可視状態に応じて停止。
- src/reward-effects.ts: 学習判定と独立した短い星・XP・紙吹雪（動き軽減対応）。
- src/game.css: 360px級スマホ、タブレット、focus-visible、reduced-motion。
- src/public/404.html: GitHub Pagesの旧深いURLに対するSPA入口復帰。
- scripts/check-games.mjs: 15ゲーム×80ケースと復習期間を検証。

## 保存キー

- kids_learning_active_slot_v2: 現在の匿名プレイヤー番号
- kids_learning_dopagaki_v2_player_1..4: schema=2, xp, sessions, completed, reviews, settings
- V1のキーは一切変更しない。旧データのV2移行は未実装。
- データは端末ブラウザ内のみ。アカウントやサーバー同期なし。

## ゲーム進行

home → 5問中の1問 → （記憶ならpreview）→ answer → solved → 次の問 → result。正解時に保存、セッション終了時に完了回数保存。失敗時はヒント/再選択で回復可能。問題単位のcommitted Setとphaseガードで二重確定を防ぐ。

復習は既習問題から期限到来を最大2問選び、新問題と合わせて5問。1・3・7・14日の間隔は初期パラメータであり、個々の学習者に対する最適値を保証しない。

## 旧版

https://github.com/c-a-p-engineer/kids-learning/tree/archive/pre-dopagaki-20261026

旧版の11ゲーム関連ソース52ファイルは現行ブランチから退役済み。復旧は退避ブランチまたは旧コミットで行う。


## 2026-10-26 設定と表示の改善

- src/game-audio.ts: WebAudioでBGM/効果音を合成。画面遷移・表示状態・利用者操作に連動して開始停止。独立音量を反映し、回答時やスライダー操作時には楽曲ループを再始動しない。
- 設定画面（options）: BGM/SEのON/OFF、音量、演出ON/OFF。画面遷移前のクエスト状態を保持して戻る。音量値はV2既存データへのoptionalフィールド追加で、clampVolumeによる不正値補正を実施。


## V2.3 追記

- engine.ts: MAX_LEVEL=5、CLEARS_PER_LEVEL=2、unlockedLevel、progressForを追加。問題生成は第3引数のlevelで難易度分岐。
- レベル1のIDは従来維持。レベル2以降は gameId:L{level}:{index} に名前空間を分離し、保存済みの問題を読み戻す際にlevelを復元。
- chooseRoundは第5引数levelを受け取り、そのレベルの新しい問題を生成。復習の期限到来は2問まで従来どおり混合。
- quest-main.ts: 回答正解→自動進行タイマーを管理。途中退出・オプション移動・キャラ切替でタイマーを解除。複数クリックで加点・クリアが重複しない。
- 誤答は最大2秒の入力待ちを設ける。2回目以降は非正解ヒントを追加。
- ホームのカテゴリはクライアント状態、学習記録とは無関係。
- 記録リセットはキャラクター1枠のV2学習データだけで、他キャラ・V1保存領域にアクセスしない。設定はコピーして維持。
- 仕様の詳細: docs/renewal-2026/04-level-progress-and-ux.md


## V2.4 文字サイズの保存・反映

- engine.ts: settings.textSize（整数パーセント、標準100%）とclampTextSizeで80..160を10単位に丸める。
- quest-main.ts: loadSave時に既存schema=2へ補完。inputの変更イベントで保存・CSS変数を更新し、ゲーム状態を再生成せず即時反映。
- game.css: htmlのfont-sizeを --learning-font-percent（%）で可変化。remベースのUIを拡大し、長い回答はモバイルで縦並び、130%以上の文字設定では小画面カードを1列に。
- 説明文を読む時間に配慮し、正解後の自動進行を文字サイズに比例して1.75〜2.8秒にする。
- 学習データ・復習・XPは不変。既存4キャラそれぞれ独立して記録。

