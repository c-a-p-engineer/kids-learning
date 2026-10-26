# PROJECT DOPAGAKI / 学習科学と報酬設計のエビデンス

調査日: 2026-10-26
対象: 低年齢から小学校低学年のタッチ型家庭学習ゲーム。
位置づけ: 文献に基づく設計仮説。KIDS LEARNING自体の学習効果・安全性は未検証。

## 最重要結論

1. **翌日以降の保持**を目的にし、正解直後の高得点だけで能力を判定しない。
2. 思い出して回答する「検索練習 / retrieval practice」と、回を分ける「分散練習 / spacing」を中心に置く。
3. ゲームに学習内容を後付けするのではなく、ゲーム内の成功行為を学習課題そのものにする。
4. 選択の自由・習得実感・適切な支援（自己決定理論）を強める。
5. ドーパミン放出量や依存形成をKPIにせず、脳内化学反応をアプリが測定できるかのように扱わない。
6. 終了可能性、報酬の透明性、子どもの自律性を守る。学習記録は診断・IQ評価に流用しない。

## 主要論文・レビューと適用の限界

| 年 | 原著・レビュー | 観測結果・確度 | 設計へ反映 |
|---|---|---|---|
| 2025 | Mawson & Kang, The Distributed Practice Effect on Classroom Learning | 教室での22報告、31効果量、N>3000。分散学習の効果 d=0.54、95% CI [0.31,0.77]。学年・保持期間等が異なる | 同じ内容を翌日/数日後に再確認。特定日数が全年齢最適と示すものではない |
| 2025 | Murray, Horner & Göbel, A Meta-analytic Review of the Effectiveness of Spacing and Retrieval Practice for Mathematics Learning | 27研究・53効果量、分散 vs 集中の g=0.28 | 算数の復習を横断的に導入。検索練習の効果を分散の値と同一視しない |
| 2026-10 | Nguyen, Effectiveness of Game-Based Learning (GBL) Approach on Students’ Learning Outcomes in Mathematics Education | 2010–2025の23研究、g=0.651、CI [0.304,0.998]、年齢・ゲーム種類などで差 | 数学内容をゲーム操作へ直接結び付ける。家庭1人への効果保証ではない |
| 2026-03 | Yao et al., The impact of gamified learning in mathematics education on students' cognitive and affective outcomes | 20メタ分析、688一次研究の二次メタ分析。認知 g=0.454、情意面 g=0.226 は有意でない | 成績と「好きになった」を独立して測る。レビュー重複と品質の違いに留意 |
| 2025 | Kurnaz & Koçtürk, A Meta-Analysis of Gamification's Impact on Student Motivation in K-12 Education | 31研究、全体の動機づけ g=0.654 だが I²=88.92%で高い異質性。小学生では g=0.309 | 外発的報酬の強さだけを競わず、学年・個人差を尊重 |
| 2024 | Wang et al., A systematic review and meta-analysis of self-determination-theory-based interventions in the education context | 36介入研究で自律性、有能感、内発的動機づけの改善を報告 | 子どもに課題の選択権、再挑戦、原因が分かるフィードバックを与える |
| 2025 | Kahnt & Schoenbaum, The curious case of dopaminergic prediction errors and learning associative information beyond value | 神経科学Perspective。ドーパミン信号は単純な快楽・報酬価値だけではない | 報酬予測誤差は理論上の背景であり、報酬を無限に強化する根拠としない |
| 2026-01 | American Academy of Pediatrics, Digital Ecosystems, Children, and Adolescents: Policy Statement | 年齢に合う学習目的、プライバシー、自律性。過剰なゲーミフィケーション、自動再生、注意を引き延ばす設計に注意 | 有限セッション、終了ボタン、保護者設定、広告・購入・無限フィード禁止 |

### 一次公開URL

- https://pmc.ncbi.nlm.nih.gov/articles/PMC12189222/
- https://eric.ed.gov/?id=EJ1478558
- https://e-iji.net/ats/index.php/pub/article/view/985
- https://bera-journals.onlinelibrary.wiley.com/doi/10.1002/berj.70144
- https://onlinelibrary.wiley.com/doi/10.1002/pits.70056
- https://www.sciencedirect.com/science/article/pii/S0023969024000572
- https://www.nature.com/articles/s41583-024-00898-8
- https://publications.aap.org/pediatrics/article/157/2/e2025075320/199996/Digital-Ecosystems-Children-and-Adolescents

## 研究から設計への変換（証明済みとの混同禁止）

### 分散練習・想起練習

- 教えた直後の模倣と、ヒントなしで後日答える能力は別に記録する。
- 復習予定日は最初は 1日→3日→7日→14日を**試験的なルール**として使用し、正答傾向から調整する。この間隔自体は上記メタ分析が「最適」と証明した数字ではない。
- 失敗時は追加ヒント→再挑戦→次回を少し手厚くする。学習者を罰せず難易度を調整。
- 既習課題の想起、少し違う見た目での転移課題、新しい課題を混ぜる。

### 内発的動機とゲーム内の達成

- 子どもは2〜3の適切な課題の中から進路を選べる。
- 報酬は「何をできたから得たか」を必ず表示する。例: 「7まで数えられた」「昨日の問題を思い出せた」。
- 大成功演出は小区切りの最後に限定し、毎回答で巨大演出を出さない。
- 不正解時の支援は失敗を明瞭に伝えつつ、責めずにやり直しを提供する。
- 必要な支援を使うことは悪ではないが、独力の習得指標と混ぜない。

### ドーパミンについての非主張

- アプリのアニメーション・音・色から脳内ドーパミン濃度を推定しない。
- ランダム高額報酬、ガチャ/戦利品箱、希少性への煽り、時間制限付き損失、連続ログイン強制、消失する報酬は採用しない。
- 科学文献は「光らせるほどドーパミンが出て学習定着」という因果を立証していない。
- 想定ユーザーの中には音・点滅・動きで不快になる子もいるため、静かなモードを最初から同等の機能として用意する。

## 安全に改善可能な測定方法

主指標（教育成果）:
- 1日・7日後のヒントなし再想起正答率
- 既習概念を異なる外観の問題へ移したときの正答率
- 前回誤答した項目の再習得率

副指標（UX）:
- 自分から課題を選べたか（保護者観測と混同しない）
- 終了案内で自然にやめられたか
- 誤タップ・説明読解・音なしなどの操作障害
- 課題拒否、苛立ち、疲労サイン（保護者による観察、診断しない）

禁止KPI:
- 1セッションで最大限の滞在時間
- タップ連打数やエフェクト再生数を習得の代理にすること
- 明日のログイン率を維持するための損失恐怖
- ドーパミン分泌量、知能指数、発達診断の推定

## エビデンス上の未解決事項

- 大半のメタ分析は複数の年齢・学校・ゲーム条件が混在する。2〜3歳・小学校低学年・個々の発達特性へそのまま外挿しない。
- 強い演出で短期正答率が上がっても、長期保持が改善するとは限らない。
- 注意機能や抑制課題の成績を日常生活の能力改善と同一視しない。
- 学習効果を評価するには、旧版/新版の同等内容と後日保持の比較を用意する。少人数の家庭内観察から集団への一般化はできない。

## 判断

最初のリリースは「有限クエスト + 適応難易度 + ヒント付き再挑戦 + 遅延復習 + 小さな達成報酬」で構成する。装飾エフェクトは習得と関係する節目で強くし、教育効果の主張は実測が揃うまで留保する。
