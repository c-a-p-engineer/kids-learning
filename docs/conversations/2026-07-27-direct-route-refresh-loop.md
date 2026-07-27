# 2026-07-27 直接URL更新時の無限リダイレクト修正

## 現象

GitHub Pagesで `/kids-learning/pencil-practice` を直接開き、ブラウザを更新するとリダイレクトが無限に繰り返される。

## 原因

`src/public/404.html` が、`kids-learning` の次のパスを既知ルートかどうかで判定していた。

`pencil-practice` は既知ルート一覧に含まれていなかったため、SPAの入口 `/kids-learning/` ではなく、存在しない `/kids-learning/pencil-practice/` へ転送していた。その転送先も404となり、同じ処理が繰り返された。

## 修正

- GitHub Pagesの404からは、パスの種類に関係なく必ず `/kids-learning/` へ戻す
- 元のパス、クエリ、ハッシュは `redirect` パラメータへ保存する
- アプリ起動時に `history.replaceState` で元のURLを復元する
- コンテンツIDの追加時に `404.html` の既知ルート一覧を更新する方式を廃止する

## 対象

この修正は以下を含む全てのSPA直接URLに適用する。

- `/kids-learning/pencil-practice`
- `/kids-learning/clock-reading`
- `/kids-learning/number-sequence`
- 今後追加するコンテンツURL
