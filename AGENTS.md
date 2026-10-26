# AGENTS.md — KIDS LEARNING V2

## 目標
年長向けの学習ゲーム15本。5問完結・自分で選べる・失敗から学べる。スマホ縦・タブレット・音なし・キーボード操作を維持する。

## 正本と退避
- 現行V2: src/engine.ts、src/quest-main.ts、src/game-audio.ts、src/reward-effects.ts、src/game.css、src/index.html
- 現行ドキュメント: docs/ゲーム仕様V2.md、docs/architecture.md
- 旧11ゲームのソースと旧ルール: archive/pre-dopagaki-20261026
- 旧版ドキュメント: docs/legacy/ （旧版ブランチにも存在）
- 配布: GitHub Pages。public/はビルド成果物、直接編集禁止。

## 必須規則
1. 旧版のlocalStorageキーを絶対に削除・上書きしない。
2. V2の記録は kids_learning_dopagaki_v2_player_N（N=1..4）。切替は kids_learning_active_slot_v2。
3. 各ゲーム5問で終了し、再開は子どもの明示操作。無限プレイ・ランダムな希少報酬・ログイン罰・ランキングは禁止。
4. 回答は1問1回の確定処理。連打でXPが重複しない。
5. 記憶ゲームは絵を隠してから回答する。見る時間を強制せず自分で「おぼえた」を押せる。
6. ヒント・やり直しは罰しないが、独力での記憶定着と区別して計測する。
7. 子どもの識別情報・健康情報・家庭情報を公開リポジトリへ保存しない。
8. UI操作は原則44px以上、360px縦・768px縦・キーボード・200%表示、prefers-reduced-motionに対応。
9. 読み上げ・音声・端末APIが動かなくても回答可能にする。
10. ゲーム/保存/UIを変更したら仕様書と自動検証を同時に更新する。

## 検証
~~~sh
npm ci
npm run test
npm run typecheck
./scripts/build.sh
~~~

必要なScenario QA: 最初の一手、誤タップ、連打、正解/失敗/ヒント、最後の問題、途中中断、再試行、4プレイヤーの分離、リロード、音声なし、動き軽減、旧版記録の不変性。実機確認を自動テスト実施済みと混同しない。

## 会話記録
重要な合意・決定は docs/conversations/YYYY-MM-DD-トピック.md に要約。会話全文や個人情報は記録禁止。
