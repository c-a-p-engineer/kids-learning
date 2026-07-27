# アーキテクチャ

## 1. 概要

`kids-learning` は、ViteとTypeScriptで構成されたクライアントサイドの学習アプリです。バックエンドやユーザーアカウントを持たず、GitHub Pagesから静的ファイルとして配布します。

## 2. 実行構成

```text
GitHub Pages
  └─ public/
      ├─ index.html
      ├─ assets/
      └─ 404.html
           ↑
      ./scripts/build.sh
           ↑
Vite build (root: src/)
           ↑
src/
  ├─ index.html
  ├─ main.ts
  ├─ app/
  ├─ contents/
  ├─ styles/
  └─ public/404.html
```

## 3. 主要モジュール

| 場所 | 責務 |
|---|---|
| `src/index.html` | ポータル、かきとり、保護者画面、共通DOM |
| `src/main.ts` | 初期化、コンテンツ一覧、テーマ、ルーティング、かきとり機能の統合 |
| `src/app/router.ts` | URLと画面表示の対応 |
| `src/app/dom.ts` | DOM要素の取得と型付け |
| `src/app/store.ts` | かきとり関連の状態読み書き |
| `src/app/audio.ts` | 読み上げと効果音の共通処理 |
| `src/app/canvas.ts` | かきとりキャンバスの描画処理 |
| `src/contents/index.ts` | 公開コンテンツの登録一覧 |
| `src/contents/*-game.ts` | 各ゲームの画面、状態、イベント、履歴 |
| `src/styles/main.scss` | 既存の共通・コンテンツ別スタイル |
| `src/styles/accessibility.css` | 視認性、タッチ領域、スマホ・タブレット対応の補強 |

## 4. ルーティング

基本規則:

```text
/                         ポータル
/<contentId>              コンテンツの開始画面
/<contentId>/home         コンテンツの開始画面
/<contentId>/play         学習・ゲーム画面
/<contentId>/parent       保護者画面（対応コンテンツのみ）
```

GitHub Pagesは任意パスのHTMLを直接返せないため、`src/public/404.html` がクエリへ元のパスを退避し、アプリ起動時に `history.replaceState` で復元します。

## 5. コンテンツ登録

各コンテンツは `LearningContent` として次を持ちます。

- `id`
- `title`
- `description`
- `tags`

`src/contents/index.ts` の `LEARNING_CONTENTS` に登録された順でポータルに表示されます。

## 6. 保存

- 保存先: ブラウザの `localStorage`
- サーバー同期: なし
- アカウント: なし
- 端末間共有: なし

各ゲームは固有の保存キーを使用します。保存形式と保持件数は各仕様書を正とします。

注意事項:

- ブラウザデータを削除すると履歴も失われる
- プライベートブラウズでは保存されない、または終了時に消える場合がある
- 容量制限はブラウザごとに異なる
- 保存形式変更時は既存データを考慮する

## 7. 外部依存

- Vite: 開発とビルド
- TypeScript: 型チェック
- Sass: `main.scss` の処理
- Phaser: CDN参照
- animCJK: かきとりの書き順SVG取得
- Web Speech API / Web Audio API: 読み上げ・効果音

外部通信や端末APIが使えない場合でも、可能な範囲で学習を続行できる構造を維持します。

## 8. ビルド

```bash
npm ci
npm run typecheck
./scripts/build.sh
```

`vite.config.js` の設定:

- root: `src`
- base: `./`
- outDir: `public`

`build.sh` は、GitHub Actionsの起動確認用にハッシュ付きJSを `public/assets/main.js` へ複製します。

## 9. デプロイ

- `master` へのpush: GitHub Pages本番へデプロイ
- その他のブランチへのpush: ブランチ別プレビューへデプロイ
- ブランチ削除: 対応するプレビューを削除

## 10. 変更時の境界

コンテンツ固有の変更:

- `src/contents/`
- 対応する仕様書

共通UIの変更:

- `src/index.html`
- `src/styles/`
- `src/app/dom.ts` または `src/main.ts`
- `docs/トップ画面.md`
- `docs/design/`

保存形式の変更:

- 実装
- 移行処理
- 個別仕様書
- 会話・意思決定記録
