import { GAMES, MAX_LEVEL, progressFor, countDue } from './engine';
import type { LearningSave } from './engine';
import { recentDays, recentSummary, skillNodes, skillSummary } from './progression';

const escape = (value: string): string => value.replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
export const PROGRESS_CATEGORIES = [
  { id: 'all', name: 'ぜんぶ', icon: '🌈' },
  { id: 'math', name: 'かず', icon: '🔢' },
  { id: 'words', name: 'ことば', icon: '📚' },
  { id: 'thinking', name: 'かんがえる', icon: '🧩' },
  { id: 'life', name: 'せいかつ', icon: '🌱' },
  { id: 'motor', name: 'うごく・なぞる', icon: '✍️' }
] as const;
export type ProgressCategory = (typeof PROGRESS_CATEGORIES)[number]['id'];
export function categoryId(subject: string): ProgressCategory {
  if (subject === 'さんすう') return 'math';
  if (subject === 'こくご' || subject === 'ことば') return 'words';
  if (subject === 'ずけい' || subject === 'きおく' || subject === 'かんがえる') return 'thinking';
  if (subject === 'うんぴつ' || subject === 'うんどう') return 'motor';
  return 'life';
}
const buttons = (page: 'stats' | 'skills'): string => '<nav class="progress-tabs" aria-label="せいちょうの ページ">' +
  '<button type="button" data-action="stats" class="' + (page === 'stats' ? 'active' : '') +
  '" aria-current="' + (page === 'stats' ? 'page' : 'false') + '">📊 ステータス</button>' +
  '<button type="button" data-action="skills" class="' + (page === 'skills' ? 'active' : '') +
  '" aria-current="' + (page === 'skills' ? 'page' : 'false') + '">🌳 スキルツリー</button></nav>';
const stat = (value: number | string, label: string): string =>
  '<div class="growth-stat"><strong>' + value + '</strong><span>' + label + '</span></div>';
const friendlyDay = (key: string): string => {
  const [year, month, day] = key.split('-').map(Number);
  return year + '/' + month + '/' + day;
};
/** 14-day chart with actual counts; includes zero days and full text fallback table. */
export function statusHtml(save: LearningSave, profileName: string, now: Date): string {
  const seven = recentSummary(save.daily, now, 7);
  const fourteen = recentDays(save.daily, now, 14);
  const thirty = recentDays(save.daily, now, 30).reverse();
  const max = Math.max(1, ...fourteen.map(x => x.log.answered));
  const today = fourteen[13];
  const todayGames = GAMES.filter(g => today.log.games[g.id]).map(g =>
    '<span class="today-game">' + g.icon + ' ' + escape(g.title) + ' ×' + today.log.games[g.id] +
    '</span>').join('');
  const due = GAMES.reduce((n, g) => n + countDue(g.id, save, now.getTime()), 0);
  const skills = skillSummary(save);
  const bars = fourteen.map((day, index) => {
    const n = day.log.answered;
    const pct = n === 0 ? 0 : Math.max(5, Math.round(n / max * 100));
    const label = friendlyDay(day.key) + ' ' + n + 'もん';
    return '<div class="history-day' + (index === 13 ? ' is-today' : '') + '">' +
      '<span class="history-number">' + (n || '') + '</span>' +
      '<div class="history-rail"><span style="height:' + pct + '%"></span></div>' +
      '<span class="history-date">' + Number(day.key.slice(-2)) + '日</span>' +
      '<span class="sr-only">' + label + '</span></div>';
  }).join('');
  const rows = thirty.filter(day => day.log.answered || day.log.clears || day.log.mistakes).map(({ key, log }) =>
    '<tr><th scope="row">' + friendlyDay(key) + '</th><td>' + log.answered +
    '</td><td>' + log.independent + '</td><td>' + log.practiced +
    '</td><td>' + log.clears + '</td><td>' + log.xp + '</td><td>' +
    (GAMES.filter(g => log.games[g.id]).map(g => g.icon + ' ' + escape(g.title)).join('・') || '—') +
    '</td></tr>').join('');
  return '<section class="growth-page"><button type="button" class="growth-back" data-action="home">← ホームへ</button>' +
    '<h1>📊 ' + escape(profileName) + 'の ステータス</h1>' +
    '<p class="growth-lead">がんばったことを たしかめよう。くらべるのは きのうの じぶん。</p>' +
    buttons('stats') +
    '<h2>いまの せいちょう</h2><div class="growth-stats">' +
    stat(save.xp, 'ぜんぶの XP') + stat(save.sessions, 'あそんだ クエスト') +
    stat(skills.unlocked + '/' + skills.total, 'ひらいた スキル') + stat(due, 'ふくしゅう まち') +
    '</div><h2>きょうの きろく</h2><div class="growth-stats">' +
    stat(today.log.answered, 'こたえた・やってみた') +
    stat(today.log.independent, 'ひとりで せいかい') +
    stat(today.log.practiced, 'からだ・なぞり') +
    stat(today.log.clears, 'クリア') + '</div>' +
    '<div class="today-games" aria-label="きょうクリアしたゲーム">' +
    (todayGames || '<span class="growth-help">まだ クリアきろくは ないよ。</span>') + '</div>' +
    '<h2>この 7にちかん</h2><div class="growth-stats">' +
    stat(seven.days + '/7', 'あそんだ ひ') +
    stat(seven.questions, 'とりくんだ かず') +
    stat(seven.clears, 'クリア') + stat(seven.xp, 'ふえた XP') +
    '</div><h2>まいにちの きろく</h2><p class="growth-help">さいきん14にちかん。ぼうグラフは こたえた・やってみた かず。</p>' +
    '<div class="history-chart" role="img" aria-label="最近14日間の学習数">' + bars + '</div>' +
    '<h2>さいきん30にちの きろく</h2><div class="daily-table-wrap"><table class="daily-table">' +
    '<thead><tr><th>ひづけ</th><th>とりくみ</th><th>ひとりで</th><th>れんしゅう</th><th>クリア</th><th>XP</th><th>ゲーム</th></tr></thead>' +
    '<tbody>' + (rows || '<tr><td colspan="7">まだ きろくが ないよ。クエストから はじめよう！</td></tr>') +
    '</tbody></table></div>' +
    '<p class="growth-note">※ この日別きろくは V2.6 からの分だけ。以前のXP・クリアは合計に残りますが、日付を後から推測しません。' +
    'きろくはこの端末の、選んだキャラだけ。なぞりや運動の完了は学力の正答とは別です。</p></section>';
}
export function skillTreeHtml(save: LearningSave, profileName: string, selected: ProgressCategory): string {
  const summary = skillSummary(save);
  const filter = PROGRESS_CATEGORIES.some(cat => cat.id === selected) ? selected : 'all';
  const tabs = PROGRESS_CATEGORIES.map(cat =>
    '<button type="button" data-skill-category="' + cat.id + '" aria-pressed="' + (filter === cat.id) +
    '" class="skill-category' + (filter === cat.id ? ' active' : '') + '">' + cat.icon + ' ' + cat.name +
    '</button>').join('');
  const filtered = GAMES.filter(game => filter === 'all' || categoryId(game.subject) === filter);
  const trees = filtered.map(game => {
    const clears = save.completed[game.id] ?? 0;
    const info = progressFor(clears);
    const nodes = skillNodes(game.id, save.completed);
    const tree = nodes.map((node, i) => {
      const tag = node.opened ? 'button' : 'span';
      const attrs = node.opened ? ' type="button" data-skill-play="' + game.id +
        '" data-level="' + node.level + '" aria-label="' + escape(game.title) +
        ' レベル ' + node.level + 'を あそぶ"' : ' aria-label="レベル ' + node.level +
        ' まだ ひらいていません"';
      return '<' + tag + attrs + ' class="skill-node' + (node.opened ? ' unlocked' : ' locked') +
        (node.level === info.level ? ' current' : '') + '" title="レベル ' + node.level +
        (node.opened ? ' をあそぶ' : ' ' + node.requiredClears + 'かいクリアでかいほう') + '">' +
        '<span class="skill-level">' + (node.opened ? '⭐' : '🔒') + '</span><small>LV' + node.level +
        '</small></' + tag + '>' + (i < MAX_LEVEL - 1 ? '<span class="skill-connector' +
        (nodes[i + 1].opened ? ' unlocked' : '') + '"></span>' : '');
    }).join('');
    const next = info.maxed ? 'ぜんレベル かいほう！' :
      'つぎの レベルまで ' + info.current + '/' + info.target + ' クリア';
    return '<article class="skill-branch"><div class="skill-branch-header"><span class="skill-branch-icon">' +
      game.icon + '</span><div><h3>' + escape(game.title) + '</h3><p>' + escape(game.subject) +
      ' ・ ' + clears + 'かいクリア</p></div></div><div class="skill-path" role="group" aria-label="' +
      escape(game.title) + ' レベルかいほう">' + tree +
      '</div><p class="skill-progress-copy">' + next + '</p></article>';
  }).join('');
  return '<section class="growth-page"><button type="button" class="growth-back" data-action="home">← ホームへ</button>' +
    '<h1>🌳 ' + escape(profileName) + 'の スキルツリー</h1>' +
    '<p class="growth-lead">あそぶと あたらしい レベルが ひらくよ。じぶんの ペースで すすもう！</p>' +
    buttons('skills') +
    '<div class="skill-summary"><strong>⭐ ' + summary.unlocked + '/' + summary.total +
    '</strong><span>ひらいた レベル　🏆 ' + summary.maxed + 'ゲーム ぜんかいほう</span></div>' +
    '<p class="growth-help">ひとつの ゲームを 2かいクリアすると つぎの LV が ひらくよ。⭐のレベルを おすと あそべるよ。</p>' +
    '<nav class="skill-filters" aria-label="スキルの ぶんや">' + tabs + '</nav>' +
    '<div class="skill-tree-grid">' + trees + '</div>' +
    '<p class="growth-note">※ スキルツリーの解放は「挑戦できるレベル」です。能力検査や発達・療育の評価ではありません。' +
    'むずかしいときは やさしいもんだいに もどっても だいじょうぶ。</p></section>';
}
