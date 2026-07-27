# kids-learning

子どもがスマートフォンやタブレットで遊びながら学べる、ブラウザ学習コンテンツ集です。

## 🎮 すぐにあそぶ

### [▶ まなびのライブラリをひらく](https://c-a-p-engineer.github.io/kids-learning/)

スマートフォン・タブレット・PCのブラウザから、そのまま利用できます。

- 公開サイト: [https://c-a-p-engineer.github.io/kids-learning/](https://c-a-p-engineer.github.io/kids-learning/)
- 対応端末: スマートフォン / タブレット / PC
- 保存方式: 学習記録は原則として利用中のブラウザ内に保存
- 配布方式: GitHub Pages

## 現在のコンテンツ

| コンテンツ | 学習内容 | 主な機能 |
|---|---|---|
| かきとりマスター | ひらがな・漢字などの書字練習 | なぞり書き、書き順のお手本、課題作成、練習履歴 |
| ドットバースト | 数量の瞬時認識 | ドット数当て、難易度別スコア、履歴 |
| えもじフラッシュ | 記憶と想起 | 絵文字の記憶、2択クイズ、難易度別履歴 |
| どっちが大きい？ | 数の大小比較 | 2〜3択、タイマー、コンボ、履歴 |
| ぴったりシェイプ | 図形認識と空間把握 | ドラッグ操作、難易度選択、スコア、履歴 |

## 子ども向けUIの方針

- 主要ボタンは指で押しやすい大きさにする
- 文字だけでなく、色・アイコン・配置でも内容を判別できるようにする
- スマートフォン縦画面を基準にし、タブレットでは横幅を有効活用する
- 文字サイズの拡大を妨げず、キーボード操作やフォーカス表示も維持する
- 強い点滅や不要なアニメーションを避け、端末設定の「視差効果を減らす」に追従する
- 保護者向け操作と子ども向け操作を可能な範囲で分離する

詳細は [`docs/design/子ども向けUI方針.md`](docs/design/子ども向けUI方針.md) を参照してください。

## 開発

### 必要環境

- Node.js 18以上
- npm

### 起動

```bash
npm ci
npm run dev
```

開発サーバーの表示URLをブラウザで開きます。

### 確認

```bash
npm run typecheck
./scripts/build.sh
```

ビルド成果物は `public/` に出力されます。`public/` は直接編集しません。

## ディレクトリ構成

```text
src/
  app/              共通機能、状態管理、ルーティング
  contents/         各学習コンテンツ
  styles/           共通スタイルと端末対応
  index.html        画面の基本構造
docs/
  design/           UI・設計方針
  conversations/    要件・判断・会話の要約記録
  *.md              各コンテンツ仕様
scripts/
  build.sh          GitHub Pages向けビルド
public/              自動生成される配布物
```

## ドキュメント

- [ドキュメント案内](docs/README.md)
- [コンテンツ一覧と仕様リンク](docs/コンテンツ一覧.md)
- [トップ画面仕様](docs/トップ画面.md)
- [仕様書テンプレート](docs/仕様書テンプレート.md)
- [会話・意思決定記録の運用](docs/conversations/README.md)
- [AI開発ルール](AGENTS.md)

## URL

- ポータル: `/`
- コンテンツ: `/<contentId>`
- 内部画面: `/<contentId>/<view>`

例:

- `/kakitori`
- `/kakitori/play`
- `/kakitori/parent`

GitHub Pagesで直接URLを開いた場合は、`src/public/404.html` のフォールバックを経由して画面を復元します。

## 変更時の原則

1. 実装変更と同時に対応する `docs/` を更新する
2. UI変更はスマートフォン、タブレット、キーボード操作で確認する
3. 新しい要件や判断は `docs/conversations/` に要約して残す
4. 個人情報、秘密情報、会話全文は記録しない
5. `npm run typecheck` と `./scripts/build.sh` を実行する