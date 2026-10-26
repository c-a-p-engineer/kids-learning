import { GAMES, MAX_LEVEL, progressFor, countDue } from './engine';
import type { LearningSave } from './engine';
import { recentDays, recentSummary, reviewSuggestion, skillNodes, skillSummary } from './progression';

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
/** Mobile-first growth dashboard. Seven readable days; detailed records are opt-in. */
export function statusHtml(save: LearningSave, profileName: string, now: Date): string {
  const seven = recentSummary(save.daily, now, 7);
  const fourteen = recentDays(save.daily, now, 14);
  const week = fourteen.slice(-7);
  const thirty = recentDays(save.daily, now, 30).reverse();
  const max = Math.max(1, ...week.map(day => day.log.answered));
  const today = week[week.length - 1];
  const skills = skillSummary(save);
  const due = GAMES.reduce((n, game) => n + countDue(game.id, save, now.getTime()), 0);
  const todayGames = GAMES.filter(game => today.log.games[game.id]).map(game =>
    '<span class="today-game">' + game.icon + ' ' + escape(game.title) + ' ×' + today.log.games[game.id] +
    '</span>').join('');
  const bars = week.map((day, index) => {
    const count = day.log.answered;
    const height = count ? Math.max(8, Math.round(count / max * 100)) : 0;
    const label = friendlyDay(day.key) + ' ' + count + 'もん';
    return '<div class="history-day' + (index === week.length - 1 ? ' is-today' : '') +
      '" role="listitem" aria-label="' + label + '">' +
      '<strong class="history-number">' + (count || '·') + '</strong>' +
      '<div class="history-rail"><span style="height:' + height + '%"></span></div>' +
      '<span class="history-date">' + Number(day.key.slice(-2)) + '<small>日</small></span></div>';
  }).join('');
  const daysWithHistory = thirty.filter(day =>
    day.log.answered || day.log.clears || day.log.mistakes || day.log.xp);
  const records = daysWithHistory.map(({ key, log }) => {
    const gameNames = GAMES.filter(game => log.games[game.id])
      .map(game => game.icon + ' ' + escape(game.title)).join('・') || '—';
    return '<details class="daily-record"><summary><span class="daily-record-date">' +
      friendlyDay(key) + '</span><strong>' + log.answered + ' もん</strong>' +
      '<span class="daily-record-reward">⭐ ' + log.xp + ' XP</span>' +
      '<span class="daily-record-chevron" aria-hidden="true">⌄</span></summary>' +
      '<div class="daily-record-body"><span>🙌 ひとりで ' + log.independent + '</span>' +
      '<span>✍️ れんしゅう ' + log.practiced + '</span>' +
      '<span>🏆 クリア ' + log.clears + '</span>' +
      '<p>あそんだ ゲーム：' + gameNames + '</p></div></details>';
  }).join('');
  const cheer = today.log.answered
    ? 'きょうも ぼうけんしたね！'
    : 'きょうの ぼうけんを はじめよう！';
  return '<section class="growth-page growth-dashboard">' +
    '<button type="button" class="growth-back" data-action="home">← ホームへ</button>' +
    '<header class="growth-hero"><span class="growth-hero-icon" aria-hidden="true">🚀</span>' +
    '<div><p class="growth-kicker">MY ADVENTURE</p><h1>' + escape(profileName) +
    'の せいちょう</h1><p class="growth-lead">' + cheer + '</p></div></header>' +
    buttons('stats') +
    '<section class="growth-panel growth-overview" aria-label="これまでの せいちょう">' +
    '<h2>✨ いままでの ぼうけん</h2><div class="growth-stats">' +
    stat(save.xp, 'ためた XP') + stat(save.sessions, 'クエスト') +
    stat(skills.unlocked + '/' + skills.total, 'スキル') + stat(due, 'ふくしゅう') +
    '</div></section>' +
    '<section class="growth-panel growth-today" aria-label="きょうの きろく">' +
    '<h2>🌞 きょうの がんばり</h2><div class="growth-stats">' +
    stat(today.log.answered, 'とりくみ') + stat(today.log.independent, 'ひとりで') +
    stat(today.log.practiced, 'れんしゅう') + stat(today.log.clears, 'クリア') +
    '</div><div class="today-games">' +
    (todayGames || '<span class="growth-help">あそんだ ゲームが ここに でるよ。</span>') +
    '</div></section>' +
    '<section class="growth-panel growth-week" aria-label="7にちかんの がんばり">' +
    '<h2>📈 7にちの ぼうけん</h2>' +
    '<div class="history-chart" role="list" aria-label="最近7日間の取り組み数">' + bars + '</div>' +
    '<div class="growth-week-total"><span>🌟 ' + seven.days + '/7 にち あそんだ</span>' +
    '<span>✍️ ' + seven.questions + ' もん</span><span>🏆 ' + seven.clears + ' クリア</span>' +
    '<span>✨ +' + seven.xp + ' XP</span></div></section>' +
    '<section class="growth-panel growth-records" aria-label="日ごとの きろく">' +
    '<h2>📒 さいきん30にちの きろく</h2>' +
    '<div class="daily-record-list">' + (records || '<p class="growth-empty">まだ きろくが ないよ。あそんで ためよう！</p>') +
    '</div></section>' +
    '<details class="growth-note"><summary>ほごしゃの かたへ</summary><p>日別きろくは V2.6 から。以前のXP・クリアは合計に残り、過去の日付は推測しません。' +
    'きろくは端末内の選んだキャラだけです。なぞり・運動の練習と学力の正答は分けて集計しています。</p></details></section>';
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
    const waiting = countDue(game.id, save, Date.now());
    const tip = reviewSuggestion(save, game.id, Date.now());
    const practice = tip.hasStruggle ? '<button type="button" class="skill-practice" data-skill-play="' +
      game.id + '" data-level="' + tip.level + '" aria-label="' + escape(game.title) +
      'の レベル ' + tip.level + 'を もういちど れんしゅうする">' +
      '🌱 LV' + tip.level + ' で れんしゅう</button>' : '';
    return '<article class="skill-branch"><div class="skill-branch-header"><span class="skill-branch-icon">' +
      game.icon + '</span><div><h3>' + escape(game.title) + '</h3><p>' + escape(game.subject) +
      ' ・ ' + clears + 'かいクリア' + (waiting ? ' ・ 🔁 ' + waiting + 'こふくしゅう' : '') +
      '</p></div></div><button type="button" class="skill-start" data-game="' + game.id +
      '" aria-label="' + escape(game.title) + ' レベル ' + info.level + 'で あそぶ">' +
      '▶ この ゲームを あそぶ（LV' + info.level + '）</button>' + practice +
      '<div class="skill-path" role="group" aria-label="' + escape(game.title) + ' レベルかいほう">' + tree +
      '</div><p class="skill-progress-copy">' + next + '</p></article>';
  }).join('');
  return '<section class="growth-page"><button type="button" class="growth-back" data-action="home">← ホームへ</button>' +
    '<h1>🌳 ' + escape(profileName) + 'の スキルツリー</h1>' +
    '<p class="growth-lead">あそぶと あたらしい レベルが ひらくよ。じぶんの ペースで すすもう！</p>' +
    buttons('skills') +
    '<div class="skill-summary"><strong>⭐ ' + summary.unlocked + '/' + summary.total +
    '</strong><span>ひらいた レベル　🏆 ' + summary.maxed + 'ゲーム ぜんかいほう</span></div>' +
    '<p class="growth-help">⭐を おすと あそべるよ。</p>' +
    '<nav class="skill-filters" aria-label="スキルの ぶんや">' + tabs + '</nav>' +
    '<div class="skill-tree-grid">' + trees + '</div>' +
    '<details class="growth-note"><summary>ほごしゃの かたへ</summary><p>スキルツリーは挑戦できるレベルです。発達・療育の評価ではありません。' +
    'むずかしいときは、やさしい問題へもどれます。</p></details></section>';
}
