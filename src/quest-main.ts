import './game.css';
import './activity.css';
import './progress.css';
import './touch.css';
import './v28.css';
import { haptic } from './haptics';
import { isWorkshop } from './workshop-content';
import { freshWorkshop, workshopHtml, workshopClick } from './workshop-ui';
import type { WorkshopState } from './workshop-ui';
import { worldHtml, worldProgress } from './growth-world';
import { parentPeriod, learningCsv } from './parent-report';
import { prepareAnswer, prepareClear, prepareMistake } from './learning-commit';
import { createSession, advanceSession, attemptOutcome } from './session';
import type { Session, AnswerMode } from './session';
import { isTouchGame } from './touch-content';
import { touchHtml, touchClick, touchPointer, freshTouch } from './touch-ui';
import type { TouchState } from './touch-ui';
import { recordDaily } from './progression';
import { loadSlot, persistSlot, backupText, parseBackup, backupDelta } from './storage';
import type { Backup } from './storage';
import { statusHtml, skillTreeHtml, PROGRESS_CATEGORIES } from './progress-ui';
import type { ProgressCategory } from './progress-ui';
import { gameAudio } from './game-audio';
import { isActivity, MOVE_CARDS } from './activity-content';
import { activityHtml, activityClick, newActivityState, tracePointer } from './activity-ui';
import type { ActivityResult, ActivityState } from './activity-ui';
import { burst, dismissEffects } from './reward-effects';
import { GAMES, STORAGE_KEY, MAX_LEVEL, CLEARS_PER_LEVEL, progressFor, unlockedLevel, clampTextSize, clampVolume, chooseRound, countDue, evaluate, freshSave, isGameId, nextReview } from './engine';
import type { GameId, LearningSave, Question, Visual } from './engine';

const app = document.getElementById('app');
if (!app) throw new Error('Root #app not found');

type AppPage = 'home' | 'game' | 'result' | 'parent' | 'options' | 'stats' | 'skills' | 'world';
let page: AppPage = 'home';
let beforeOptions: Exclude<AppPage, 'options'> = 'home';
let session: Session | null = null;
let activityState: ActivityState | null = null;
let touchState: TouchState | null = null;
let workshopState: WorkshopState | null = null;
let categoryFilter = 'all';
let skillCategory: ProgressCategory = 'all';
let resetArmed = false;
let backupDraft: Backup | null = null;
let backupError = '';
let autoAdvanceTimer: number | undefined;
let unlockAnswerTimer: number | undefined;
const AUTO_ADVANCE_MS = 1750;
function stopTimers(): void {
  if (autoAdvanceTimer !== undefined) window.clearTimeout(autoAdvanceTimer);
  if (unlockAnswerTimer !== undefined) window.clearTimeout(unlockAnswerTimer);
  autoAdvanceTimer = undefined;
  unlockAnswerTimer = undefined;
}
function scheduleAdvance(): void {
  if (!session || session.phase !== 'solved' || page !== 'game') return;
  if (autoAdvanceTimer !== undefined) window.clearTimeout(autoAdvanceTimer);
  const current = session, index = current.index;
  autoAdvanceTimer = window.setTimeout(() => {
    autoAdvanceTimer = undefined;
    if (page === 'game' && session === current && current.index === index && current.phase === 'solved') next();
  }, Math.round(AUTO_ADVANCE_MS * Math.max(1, clampTextSize(save.settings.textSize) / 100)));
}
const CATEGORIES = [
  { id: 'all', label: 'ぜんぶ', icon: '🌈' },
  { id: 'math', label: 'かず・さんすう', icon: '🔢' },
  { id: 'language', label: 'ことば', icon: '📖' },
  { id: 'logic', label: 'かたち・きおく', icon: '🧩' },
  { id: 'life', label: 'せいかつ', icon: '🌱' },
  { id: 'motor', label: 'うごく・なぞる', icon: '✍️' }
] as const;
function categoryOf(subject: string): string {
  if (subject === 'うんぴつ' || subject === 'うんどう') return 'motor';
  if (subject === 'さんすう') return 'math';
  if (subject === 'こくご' || subject === 'ことば') return 'language';
  if (subject === 'ずけい' || subject === 'きおく' || subject === 'かんがえる') return 'logic';
  return 'life';
}
let slot = getSlot();
let storageWarning = '';
let save = loadSave();
const HOME_TITLE = 'まなびクエスト';
const PROFILES = [
  { id: 1, name: 'きつね', icon: '🦊', color: '#ffe3a2' },
  { id: 2, name: 'うさぎ', icon: '🐰', color: '#f8d9f5' },
  { id: 3, name: 'くま', icon: '🐻', color: '#d8e6ff' },
  { id: 4, name: 'ぱんだ', icon: '🐼', color: '#d8f5df' }
] as const;
const activeProfile = () => PROFILES.find(p => p.id === slot)!;
const safe = (s: string): string => s.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);

function getSlot(): number {
  try {
    const stored = Number(localStorage.getItem('kids_learning_active_slot_v2') ?? '1');
    return Number.isInteger(stored) && stored >= 1 && stored <= 4 ? stored : 1;
  } catch { return 1; }
}
function storeKey(): string { return STORAGE_KEY + '_player_' + slot; }
/** No reload or session reset: font changes take effect on every game screen immediately. */
function applyTextSize(): void {
  const size = clampTextSize(save.settings.textSize);
  document.documentElement.style.setProperty('--learning-font-percent', size + '%');
  document.body.classList.toggle('learning-text-large', size >= 130);
}

function loadSave(): LearningSave {
  try { return loadSlot(localStorage, slot); }
  catch {
    storageWarning = 'きろくを よみこめませんでした。ほごしゃに みてもらおう。';
    return freshSave();
  }
}
function saveNow(): boolean {
  try {
    persistSlot(localStorage, slot, save);
    if (storageWarning.startsWith('ほぞんできません')) storageWarning = '';
    return true;
  } catch {
    storageWarning = 'ほぞんできません。ほごしゃに つたえてね。いまの へんこうは ほぞんされていません。';
    return false;
  }
}
function setSlot(next: number): void {
  if (!Number.isInteger(next) || next < 1 || next > 4) return;
  dismissEffects();
  stopTimers();
  resetArmed = false;
  backupDraft = null; backupError = '';
  gameAudio.effect('profile');
  slot = next;
  try { localStorage.setItem('kids_learning_active_slot_v2', String(slot)); } catch { /* in-memory only */ }
  save = loadSave();
  gameAudio.configure(save.settings.sound, save.settings.bgm, save.settings.seVolume, save.settings.bgmVolume);
  applyTextSize();
  session = null;
  activityState = null; touchState = null; workshopState = null;
  page = 'home';
  render();
}
function layout(body: string, parent = false): string {
  return '<div class="app-shell' + (save.settings.quiet ? ' quiet' : '') + '">' +
    '<header class="topbar"><button type="button" class="brand" data-action="home" aria-label="ホームへ もどる">' +
    '<span class="brand-icon">⭐</span><span>' + HOME_TITLE + '</span></button>' +
    '<div class="top-actions"><span class="pill level-pill" aria-label="けいけんち">✨ ' + save.xp + ' XP</span>' +
    '<button type="button" class="icon-btn settings-open" data-action="options" aria-label="おと と えんしゅつの せってい" title="オプション">' +
    '⚙️</button></div></header>' +
    '<main id="main-content">' + (storageWarning ? '<div class="warning" role="status">' + safe(storageWarning) + '</div>' : '') + body + '</main>' +
    '<footer class="footer"><span>広告なし・アカウントなし・きろくは このたんまつ</span>' +
    '<button type="button" data-action="' + (parent ? 'home' : 'parent') + '">' + (parent ? 'あそびに もどる' : '👪 ほごしゃ') + '</button></footer></div>';
}
function homeHtml(): string {
  const due = GAMES.reduce((n, game) => n + countDue(game.id, save, Date.now()), 0);
  const profiles = PROFILES.map(p =>
    '<button type="button" class="profile-chip profile-avatar' + (p.id === slot ? ' chosen' : '') +
    '" style="--profile-color:' + p.color + '" data-slot="' + p.id +
    '" aria-pressed="' + (p.id === slot) + '"><span aria-hidden="true">' + p.icon +
    '</span><strong>' + p.name + '</strong></button>').join('');
  const categories = CATEGORIES.map(category => {
    const total = category.id === 'all' ? GAMES.length :
      GAMES.filter(game => categoryOf(game.subject) === category.id).length;
    return '<button type="button" class="category-chip' + (category.id === categoryFilter ? ' chosen' : '') +
      '" data-category="' + category.id + '" aria-pressed="' + (category.id === categoryFilter) +
      '">' + category.icon + ' ' + category.label + '<span>' + total + '</span></button>';
  }).join('');
  const visible = GAMES.filter(game => categoryFilter === 'all' || categoryOf(game.subject) === categoryFilter);
  const cards = visible.map(game => {
    const dueCount = countDue(game.id, save, Date.now()), total = save.completed[game.id] ?? 0;
    const progress = progressFor(total);
    const short = progress.maxed ? '🏆 さいこうレベル！' : '🔓 つぎまで ' + progress.current + '/' + progress.target;
    return '<button type="button" class="quest-card" style="--accent:' + game.color + '" data-game="' + game.id +
      '"><span class="quest-number">' + safe(game.subject) + '</span>' +
      '<span class="quest-icon">' + game.icon + '</span><span class="quest-title">' + safe(game.title) + '</span>' +
      '<span class="quest-description">' + safe(game.description) + '</span>' +
      '<span class="quest-level">⭐ レベル ' + progress.level + '/' + MAX_LEVEL + '</span>' +
      '<div class="level-progress" aria-label="レベル解放までのクリア進捗 ' + progress.current + '/' + progress.target +
      '"><span style="width:' + Math.round(progress.current / progress.target * 100) + '%"></span></div>' +
      '<span class="quest-meta">' + short + (dueCount ? ' · 🔁 ' + dueCount + 'もん' : '') + '</span></button>';
  }).join('');
  return layout('<section class="hero"><div class="hero-content"><p class="eyebrow">HELLO, LITTLE HERO!</p>' +
    '<h1>きょうの <span>ぼうけん</span>に<br>しゅっぱつ！</h1>' +
    '<p>' + GAMES.length + 'この ぼうけん！ さわって、うごいて、<strong>できた！</strong>を あつめよう.</p>' +
    '<div class="hero-stats"><span>🏆 ' + save.sessions + 'かいクリア</span><span>✨ ' + save.xp + ' XP</span>' +
    (due ? '<span>🔁 ふくしゅう ' + due + 'こ</span>' : '<span>🌈 きょうも いっぽ！</span>') + '</div></div>' +
    '<div class="hero-mascot" aria-hidden="true">' + activeProfile().icon + '<span>⭐</span></div></section>' +
    '<div class="growth-shortcuts" aria-label="せいちょうの きろく">' +
    '<button type="button" data-action="stats"><span>📊</span><strong>ステータス</strong><small>まいにちの きろく</small></button>' +
    '<button type="button" data-action="skills"><span>🌳</span><strong>スキルツリー</strong><small>レベルを みよう</small></button>' +
    '<button type="button" data-action="world"><span>🚂</span><strong>まなびの えき</strong><small>クリアで まちが そだつ</small></button></div>' +
    '<section class="select-profile" aria-label="ぼうけんの なかまを えらぶ"><strong>ぼうけんの なかまを えらぼう！</strong><div class="profile-row">' +
    profiles + '</div></section>' +
    '<section class="quests"><div class="section-header"><h2>クエストを えらぼう</h2><p>すきなものから はじめていいよ！</p></div>' +
    '<nav class="category-tabs" aria-label="がくしゅう ぶんや">' + categories + '</nav>' +
    '<div class="quest-grid">' + cards + '</div></section>' +
    '<div class="home-bottom">⏱ 1ゲーム 5もんで おしまい。いつでも おわって いいよ。</div>');
}
function dots(n: number, faded = 0): string {
  // Exactly five per group, including 10/15/20. On phones groups wrap rather than shrinking dots.
  let html = '<div class="dot-row dot-groups" aria-hidden="true">';
  for (let start = 0; start < n; start += 5) {
    html += '<span class="dot-pack">';
    for (let i = start; i < Math.min(start + 5, n); i++) {
      html += '<span class="dot' + (i >= n - faded ? ' dot-faded' : '') + '"></span>';
    }
    html += '</span>';
  }
  return html + '</div>';
}
function analogClock(hour: number, minute: number): string {
  const h = (hour % 12) * 30 + minute * 0.5 - 90, m = minute * 6 - 90;
  const hand = (angle: number, radius: number): string => {
    const rad = angle * Math.PI / 180;
    return (100 + Math.cos(rad) * radius).toFixed(1) + ',' + (100 + Math.sin(rad) * radius).toFixed(1);
  };
  let ticks = '';
  for (let i = 1; i <= 12; i++) {
    const pos = hand(i * 30 - 90, 72).split(',');
    ticks += '<text x="' + pos[0] + '" y="' + pos[1] + '" text-anchor="middle" dominant-baseline="middle">' + i + '</text>';
  }
  return '<svg class="clock" viewBox="0 0 200 200" role="img" aria-label="はりの ついた アナログとけい">' +
    '<circle cx="100" cy="100" r="94" fill="#fff" stroke="#8293c8" stroke-width="7"/>' + ticks +
    '<polyline points="100,100 ' + hand(h, 49) + '" stroke="#32436e" stroke-width="9" stroke-linecap="round"/>' +
    '<polyline points="100,100 ' + hand(m, 69) + '" stroke="#ee7593" stroke-width="5" stroke-linecap="round"/>' +
    '<circle cx="100" cy="100" r="7" fill="#32436e"/></svg>';
}
function visualHtml(visual: Visual, preview: boolean): string {
  const a = visual.a ?? 0, b = visual.b ?? 0;
  switch (visual.kind) {
    case 'dots': return '<div class="visual-group"><span class="floating-symbol">🛡️</span>' + dots(a) + '</div>';
    case 'add': return '<div class="visual-group"><div class="math-line">' + a + ' ＋ ' + b + ' ＝ ❓</div>' +
      '<div class="visual-math">' + dots(a) + '<b>＋</b>' + dots(b) + '</div></div>';
    case 'subtract': return '<div class="visual-group"><div class="math-line">' + a + ' − ' + b + ' ＝ ❓</div>' +
      dots(a, b) + '<small>うすい まるは とった かず</small></div>';
    case 'sequence': return '<div class="track">' + (visual.numbers ?? []).map(n => '<span>' + (n < 0 ? '？' : n) + '</span>').join('') + '</div>';
    case 'compare': return ''; // cards are the answer surface
    case 'picture': return '<div class="big-emoji" aria-hidden="true">' + safe(visual.symbol ?? '') + '</div>';
    case 'shape': return '<div class="big-shape" aria-hidden="true">' + safe(visual.symbol ?? '') + '</div>';
    case 'clock': return analogClock(visual.hour ?? 1, visual.minute ?? 0);
    case 'bond': return '<div class="visual-group"><div class="math-line">' + a +
      ' ＋ ❓ ＝ 10</div>' + dots(a) + '<small>10まで あと いくつ？</small></div>';
    case 'pattern': return '<div class="pattern-line">' +
      (visual.preview ?? []).map(x => '<span>' + safe(x) + '</span>').join('') + '<span class="pattern-missing">❔</span></div>';
    case 'category': return '<div class="big-emoji" aria-hidden="true">' + safe(visual.symbol ?? '') + '</div>';
    case 'odd': return '<div class="odd-line">' +
      (visual.preview ?? []).map((x, i) => '<div class="odd-item"><span>' + safe(x) +
      '</span><strong>' + (i + 1) + '</strong></div>').join('') + '</div>';
    case 'color': return '<div class="color-swatch" style="--swatch:' + safe(visual.symbol ?? '') +
      '" role="img" aria-label="いろの ついた まる"></div>';
    case 'memory': return preview ? '<div class="memory-preview">' + (visual.preview ?? []).map(x => '<span>' + safe(x) + '</span>').join('') + '</div>' :
      '<div class="memory-hidden">✨ ❔ ✨<small>おぼえた えを えらぼう！</small></div>';
  }
  // Interaction-only visuals are rendered by activity-ui.ts, not by this choice renderer.
  return '';
}
function gameHtml(): string {
  if (!session) return homeHtml();
  const game = GAMES.find(g => g.id === session?.gameId)!;
  const q = session.deck[session.index];
  const number = session.index + 1, percent = (session.index / session.deck.length) * 100;
  const memoryPreview = q.visual.kind === 'memory' && session.phase === 'preview';
  const solved = session.phase === 'solved';
  const locked = session.locked;
  const longChoices = q.choices.some(choice => Array.from(choice).length >= 3);
  const comparison = q.gameId === 'compare' ?
    '<div class="compare-pick" role="group" aria-label="おおきい かずを タップ">' +
    (['ひだり', 'みぎ'] as const).map((side, i) => {
      const count = i === 0 ? q.visual.a ?? 0 : q.visual.b ?? 0;
      return '<button type="button" class="compare-pick-card" data-answer="' + side +
        '" aria-label="' + count + '、' + side + 'の かずを えらぶ"' +
        (solved || locked ? ' disabled' : '') +
        '><span class="compare-pick-number">' + count + '</span>' +
        dots(count) + '</button>';
    }).join('') + '</div>' : '';
  const oddPicture = q.gameId === 'odd' ?
    '<div class="odd-pick" role="group" aria-label="ひとつだけ ちがう えを タップ">' +
    (q.visual.preview ?? []).map((emoji, i) =>
      '<button type="button" class="odd-picture-card" data-answer="' + (i + 1) +
      '" aria-label="' + (i + 1) + 'ばんの ' + safe(emoji) + '"' +
      (solved || locked ? ' disabled' : '') + '>' + safe(emoji) + '</button>').join('') +
    '</div>' : '';
  const options = q.gameId === 'odd' ? oddPicture : q.gameId === 'compare' ? comparison :
    isWorkshop(q.gameId) && workshopState ? workshopHtml(q, workshopState, solved || locked) :
    isTouchGame(q.gameId) && touchState ? touchHtml(q, touchState, solved || locked) :
    isActivity(q.gameId) && activityState
    ? activityHtml(q, activityState, solved || locked) :
    memoryPreview ? '<button type="button" class="primary-btn" data-action="remember">おぼえた！ こたえる ➜</button>' :
    '<div class="answer-instruction">こたえを ひとつ えらんでね</div><div class="answer-grid' + (longChoices ? ' long-choices' : '') + '">' +
    q.choices.map(choice => '<button type="button" class="answer-btn" aria-label="こたえ ' + safe(choice) +
      '" data-answer="' + safe(choice) + '"' + (solved || locked ? ' disabled' : '') +
      '><span class="answer-choice">' + safe(choice) + '</span></button>').join('') + '</div>';
  const hint = !isActivity(q.gameId) && !isTouchGame(q.gameId) && !isWorkshop(q.gameId) && !memoryPreview && !solved ? '<button type="button" class="hint-btn" data-action="hint">💡 ヒントを みる</button>' : '';
  const feedback = session.feedback ? '<div class="feedback ' + (solved ? 'feedback-good' : 'feedback-try') +
    '" role="status">' + safe(session.feedback) + '</div>' : '';
  return layout('<section class="play-head"><button type="button" class="back-btn" data-action="home">← もどる</button>' +
    '<span class="pill">' + safe(game.title) + ' · LV ' + session.level + '/' + MAX_LEVEL +
    '</span><span class="pill">' + number + ' / ' + session.deck.length + '</span></section>' +
    '<div class="progress" role="progressbar" aria-label="もんだいの すすみぐあい" aria-valuemin="0" aria-valuemax="5" aria-valuenow="' +
    session.index + '"><div style="width:' + percent + '%"></div></div>' +
    '<section class="challenge" style="--accent:' + game.color + '"><div class="challenge-tag">' + game.icon + ' ' + number + 'もんめ</div>' +
    '<h1>' + safe(memoryPreview ? 'まずは えを おぼえよう！' : q.prompt) + '</h1>' +
    (isActivity(q.gameId) || isTouchGame(q.gameId) || isWorkshop(q.gameId) || q.gameId === 'compare' || q.gameId === 'odd' ? '' : '<div class="visual-stage">' + visualHtml(q.visual, memoryPreview) + '</div>') +
    (memoryPreview ? '<p class="memory-note">じかんは きにしなくて いいよ。おぼえたら ボタンを おしてね。</p>' : '') +
    '<button type="button" class="read-btn" data-action="speak">🔊 もんだいを きく</button>' +
    '<div class="answers">' + options + '</div>' + feedback + hint +
    (solved ? '<div class="auto-next" role="status">' +
      (storageWarning.startsWith('ほぞんできません') ? '⚠️ きろくが ほぞんされていないよ' :
        '✨ じどうで つぎへ すすむよ…') + '</div>' +
      '<button type="button" class="primary-btn next-btn" data-action="next">' +
      (storageWarning.startsWith('ほぞんできません') ? '🔄 もういちど ほぞんする' :
        number === session.deck.length ? '🎉 けっかを みる' : 'つぎの もんだい ➜') +
      '</button>' : '') +
    '</section><p class="play-note">まちがえても だいじょうぶ。なんかいでも かんがえられるよ。</p>');
}
function resultHtml(): string {
  if (!session) return homeHtml();
  const game = GAMES.find(g => g.id === session?.gameId)!;
  const practice = session.gameId === 'trace' || session.gameId === 'lines' || session.gameId === 'digits' || session.gameId === 'move' || session.gameId === 'connect' || session.gameId === 'maze' || session.gameId === 'routine' || session.gameId === 'rhythm';
  const progress = progressFor(save.completed[game.id] ?? 0);
  const advance = progress.level > session.level;
  const replayLabel = advance ? '🌟 レベル ' + progress.level + ' へ すすむ' :
    '🔁 レベル ' + progress.level + ' を もういちど';
  return layout('<section class="result-card"><div class="result-emoji" aria-hidden="true">' + game.icon + '🏆</div>' +
    '<p class="eyebrow">QUEST CLEAR!</p><h1>クエスト クリア！</h1>' +
    '<p>' + safe(activeProfile().name) + '、' + safe(game.title) + ' を がんばったね！</p>' +
    '<div class="unlock-result">⭐ レベル ' + progress.level + '/' + MAX_LEVEL +
    (advance ? ' 🎊 つぎは レベル ' + progress.level + '！' :
      progress.maxed ? ' 🏆 ぜんレベル かいほう！' :
      ' · つぎまで ' + progress.current + '/' + CLEARS_PER_LEVEL + ' クリア') + '</div>' +
    (practice ?
      '<div class="result-scores"><div><strong>' + session.practiced + '</strong><small>やってみた</small></div>' +
      '<div><strong>' + session.skipped + '</strong><small>おやすみ</small></div>' +
      '<div><strong>' + session.deck.length + '</strong><small>あそんだ かず</small></div></div>' :
      '<div class="result-scores"><div><strong>' + session.right + '</strong><small>ひとりで できた</small></div>' +
      '<div><strong>' + session.helped + '</strong><small>ヒントで できた</small></div>' +
      '<div><strong>' + session.deck.length + '</strong><small>クリアした もんだい</small></div></div>') +
    '<p class="result-explain">' + (practice ?
      'てを うごかしたり、まねしたり。できた ことを たいせつにしよう。' :
      'あしたも おぼえていたら さらに すごい！<br>おぼえているか、また ためしてみよう。') + '</p>' +
    '<button type="button" class="primary-btn" data-action="home">ほかの クエストへ ➜</button>' +
    '<button type="button" class="secondary-btn" data-action="replay">' + replayLabel + '</button></section>');
}
function optionsHtml(): string {
  const settings = save.settings;
  return layout('<section class="options-panel">' +
    '<p class="eyebrow">SETTINGS</p><h1>⚙️ せってい</h1>' +
    '<p class="options-lead">もじの おおきさ・おと・バイブを すきな ように かえてね。</p>' +
    '<div class="options-group text-size-options">' +
    '<div class="options-heading"><div><strong>🔤 もじの おおきさ</strong>' +
    '<small>もんだい・こたえ・ヒントの もじを かえられるよ</small></div></div>' +
    '<div class="volume-heading"><label for="text-size">もじの サイズ</label><output id="text-size-output" for="text-size">' +
    settings.textSize + '%</output></div>' +
    '<input type="range" class="volume-slider text-size-slider" id="text-size" data-text-size ' +
    'min="80" max="160" step="10" value="' + settings.textSize +
    '" aria-label="もじの おおきさ" aria-valuetext="' + settings.textSize + 'パーセント" />' +
    '<div class="volume-ends"><span>ちいさく</span><span>おおきく</span></div>' +
    '<div class="text-size-preview" aria-label="もじの サイズ みほん"><span>もんだい：3 ＋ 2 ＝ ❓</span>' +
    '<strong>こたえ：5　どうぶつ</strong><small>ヒント：まるを かぞえてみよう</small></div>' +
    '<button type="button" class="sample-sound" data-action="text-default">100%に もどす</button>' +
    '</div>' +
    '<div class="options-group"><div class="options-heading"><div><strong>🎵 BGM（おんがく）</strong>' +
    '<small>ゲームの あいだに ながれる おんがく</small></div>' +
    '<button type="button" class="toggle-btn" data-action="bgm" aria-pressed="' + settings.bgm +
    '">' + (settings.bgm ? 'ON 🔊' : 'OFF 🔇') + '</button></div>' +
    '<div class="volume-heading"><label for="bgm-volume">BGMの おおきさ</label><output id="bgm-output" for="bgm-volume">' + settings.bgmVolume + '%</output></div>' +
    '<input type="range" class="volume-slider" id="bgm-volume" data-volume="bgm" min="0" max="100" step="5" value="' +
    settings.bgmVolume + '" aria-label="BGMの おおきさ" />' +
    '<div class="volume-ends"><span>ちいさい</span><span>おおきい</span></div></div>' +
    '<div class="options-group"><div class="options-heading"><div><strong>✨ SE（こうかおん）</strong>' +
    '<small>せいかい・タップ・クリアの おと</small></div>' +
    '<button type="button" class="toggle-btn" data-action="sound" aria-pressed="' + settings.sound +
    '">' + (settings.sound ? 'ON 🔊' : 'OFF 🔇') + '</button></div>' +
    '<div class="volume-heading"><label for="se-volume">こうかおんの おおきさ</label><output id="se-output" for="se-volume">' + settings.seVolume + '%</output></div>' +
    '<input type="range" class="volume-slider" id="se-volume" data-volume="se" min="0" max="100" step="5" value="' +
    settings.seVolume + '" aria-label="こうかおんの おおきさ" />' +
    '<div class="volume-ends"><span>ちいさい</span><span>おおきい</span></div>' +
    '<button type="button" class="sample-sound" data-action="test-se">🔔 こうかおんを ためす</button></div>' +
    '<div class="options-group"><div class="options-heading"><div><strong>📳 バイブ（しんどう）</strong>' +
    '<small>せいかい・ざんねん・クリアで ちいさく ふるえるよ。たいおう たんまつだけ。</small></div>' +
    '<button type="button" class="toggle-btn" data-action="haptics" aria-pressed="' + settings.haptics +
    '">' + (settings.haptics ? 'ON 📳' : 'OFF 🌙') + '</button></div>' +
    '<button type="button" class="sample-sound" data-action="test-haptics">📳 バイブを ためす</button></div>' +
    '<div class="options-group"><div class="options-heading"><div><strong>🌟 ひかる えんしゅつ</strong>' +
    '<small>キラキラ・かみふぶきを へらせるよ</small></div>' +
    '<button type="button" class="toggle-btn" data-action="quiet" aria-pressed="' + !settings.quiet +
    '">' + (settings.quiet ? 'OFF 🌙' : 'ON ✨') + '</button></div></div>' +
    '<p class="options-footnote">おとが でないときは、たんまつの おんりょう・マナーモードも かくにんしてね。</p>' +
    '<button type="button" class="primary-btn options-back" data-action="back-options">← ゲームに もどる</button>' +
    '</section>');
}
function parentHtml(): string {
  const due = GAMES.reduce((n, game) => n + countDue(game.id, save, Date.now()), 0);
  const mastered = Object.values(save.reviews).filter(r => r.stage >= 1 && r.correct).length;
  const rows = GAMES.map(game => '<tr><th scope="row">' + safe(game.title) + '</th><td>' +
    (save.completed[game.id] ?? 0) + ' 回</td><td>' + countDue(game.id, save, Date.now()) + ' 件</td></tr>').join('');
  return layout('<section class="parent"><h1>ほごしゃダッシュボード</h1><p>' + safe(activeProfile().name) +
    ' の端末内記録です。ゲームの点数は診断やIQ測定ではありません。</p>' +
    '<div class="parent-stats"><div><strong>' + save.xp + '</strong><span>経験値</span></div>' +
    '<div><strong>' + save.sessions + '</strong><span>完了セッション</span></div>' +
    '<div><strong>' + due + '</strong><span>復習待ち</span></div>' +
    '<div><strong>' + mastered + '</strong><span>再想起の実績※</span></div></div>' +
    '<p class="footnote">※習得の推定値です。学校の到達度評価や発達診断ではありません。</p>' +
    '<h2>さいきんの きろく</h2><div class="parent-periods">' +
    [7, 30, 90].map(days => {
      const p = parentPeriod(save, new Date(), days);
      return '<div class="parent-period"><strong>' + days + 'にち</strong>' +
        '<span>' + p.days + 'にち がくしゅう</span><span>ひとりで ' + p.independent +
        'こ</span><span>れんしゅう ' + p.practiced + 'こ</span><span>' + p.clears +
        'クリア</span></div>';
    }).join('') + '</div>' +
    '<button type="button" class="secondary-btn" data-action="export-csv">📄 90にちの きろくを CSVに ほぞん</button>' +
    '<h2>ゲーム別の進捗</h2><div class="table-wrap"><table><thead><tr><th>ゲーム</th><th>クリア</th><th>復習待ち</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' +
    '<div class="parent-actions"><button type="button" class="secondary-btn" data-action="export">⬇ このキャラのきろくを ほぞん</button>' +
    '<h2>バックアップから ふくげん</h2>' +
    '<p>このキャラのV2バックアップだけ復元できます。いまの記録は上書きされるので、先に保存してね。</p>' +
    '<label class="backup-file-label" for="backup-file">📂 バックアップJSONを えらぶ</label>' +
    '<input id="backup-file" type="file" accept=".json,application/json" aria-label="バックアップJSONファイル" />' +
    (backupError ? '<p class="backup-error" role="alert">' + safe(backupError) + '</p>' : '') +
    (backupDraft ? '<div class="backup-preview"><strong>ふくげんする データ（かくにん）</strong>' +
      '<p>' + safe(activeProfile().name) + '：' + safe(backupDraft.exportedAt.slice(0, 10)) + ' のバックアップ</p>' +
      (() => { const delta = backupDelta(save, backupDraft.data);
        return '<p>XP：' + delta.xp[0] + ' → ' + delta.xp[1] +
          ' / クリア：' + delta.clears[0] + ' → ' + delta.clears[1] +
          ' / きろくの日：' + delta.days[0] + ' → ' + delta.days[1] + '</p>'; })() +
      '<div class="reset-actions"><button type="button" class="danger-btn" data-action="backup-confirm">このキャラに ふくげんする</button>' +
      '<button type="button" class="secondary-btn" data-action="backup-cancel">やめる</button></div></div>' : '') +
    '<h2>きろくの リセット</h2>' +
    '<p>このキャラの学習記録（XP・クリア・復習）だけを最初に戻します。音量設定、ほかの3キャラ、旧版データは残ります。</p>' +
    (resetArmed ? '<div class="reset-confirm" role="alert"><strong>ほんとうに ' + safe(activeProfile().name) +
      ' のきろくを けしますか？</strong><p>もどせません。必要なら先に「きろくを ほぞん」してください。</p>' +
      '<div class="reset-actions"><button type="button" class="danger-btn" data-action="reset-now">はい、リセットする</button>' +
      '<button type="button" class="secondary-btn" data-action="reset-cancel">やめる</button></div></div>' :
      '<button type="button" class="reset-open" data-action="reset-open">🗑️ このキャラのきろくを リセット</button>') +
    '<p>旧版の学習記録は削除しません。新版は別のキーに保存しています。</p></div></section>', true);
}
function render(): void {
  if (!app) return;
  if (page === 'game') app.innerHTML = gameHtml();
  else if (page === 'result') app.innerHTML = resultHtml();
  else if (page === 'parent') app.innerHTML = parentHtml();
  else if (page === 'stats') app.innerHTML = layout(statusHtml(save, activeProfile().name, new Date()));
  else if (page === 'skills') app.innerHTML = layout(skillTreeHtml(save, activeProfile().name, skillCategory));
  else if (page === 'world') app.innerHTML = layout(worldHtml(save));
  else if (page === 'options') app.innerHTML = optionsHtml();
  else app.innerHTML = homeHtml();
  document.body.classList.toggle('quiet-mode', save.settings.quiet);
  applyTextSize();
  gameAudio.setScene(page === 'stats' || page === 'skills' || page === 'world' ? 'home' : page);
}
function startGame(id: GameId, requestedLevel?: number): void {
  stopTimers();
  const unlocked = unlockedLevel(save.completed[id] ?? 0);
  const level = typeof requestedLevel === 'number' && Number.isInteger(requestedLevel) &&
    requestedLevel >= 1 && requestedLevel <= unlocked ? requestedLevel : unlocked;
  const deck = chooseRound(id, save, Date.now(), 5, level);
  activityState = isActivity(id) ? newActivityState(deck[0]) : null;
  touchState = isTouchGame(id) ? freshTouch() : null;
  workshopState = isWorkshop(id) ? freshWorkshop() : null;
  session = createSession(id, level, deck);
  page = 'game';
  gameAudio.effect('select');
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function makeHint(q: Question): string {
  switch (q.gameId) {
    case 'count': return 'ひとつずつ ゆびで かぞえてみよう。';
    case 'add': return 'まず ひだりの まる、そのあと みぎの まるを かぞえよう。';
    case 'subtract': return 'うすい まるは もう ないよ。のこりを かぞえよう。';
    case 'sequence': return 'となりの かずは いくつ ふえているかな？';
    case 'compare': return 'まるの かずを くらべてみよう。';
    case 'kana': return 'えの なまえを こえに だしてみよう。';
    case 'words': return 'えを みて、なまえを いってみよう。';
    case 'shapes': return 'かど と まるみを よく みよう。';
    case 'memory': return 'さっき みた えを あたまに うかべてみよう。';
    case 'clock': return 'みじかい はりは なんじを さしているかな？';
    case 'bond': return '10まで あと いくつ たりないかな？';
    case 'pattern': return 'おなじ じゅんばんが くりかえされているよ。';
    case 'category': return 'どこで みかける ものかな？';
    case 'odd': return 'いちばん おおい えと ちがう えを さがそう。';
    case 'colors': return 'まわりに おなじ いろの ものは あるかな？';
    case 'trace': return 'あおい スタートから、きいろの わくの なかを ひとふでで なぞろう。';
    case 'lines': return 'まず まっすぐな せんから、ゆっくり なぞってみよう。';
    case 'digits': return 'すうじの あおい スタートから、きいろい みちを なぞろう。';
    case 'blocks': return '5こずつ まとめて かぞえてみよう。';
    case 'train': return 'えの なまえを ゆっくり こえに だしてみよう。';
    case 'move': return 'できる ところだけ まねしてみよう。むりしなくて いいよ。';
    case 'connect': return '1から じゅんに ゆびを はなさず なぞろう。';
    case 'maze': return 'でんしゃから ほしまで みちを なぞってみよう。';
    case 'clockhands': return 'あおい みじかい はりと オレンジの ながい はりを つかんで うごかそう。';
    case 'shop': return '1えん・5えん・10えんを つかって ぴったりに しよう。';
    case 'routine': return 'つぎに なにを するかな？ えを みて ならべよう。';
    case 'split': return 'いしを みぎと ひだりの はこに わけよう。';
    case 'rhythm': return 'いろの じゅんばんを みて たいこを たたこう。';
  }
}
function answer(choice: string, mode?: AnswerMode): void {
  if (!session || session.phase !== 'answer' || session.locked || page !== 'game') return;
  const q = session.deck[session.index];
  if (!isActivity(q.gameId) && !isTouchGame(q.gameId) && !isWorkshop(q.gameId) && !q.choices.includes(choice)) return;
  session.attempts++;
  if (!evaluate(q, choice)) {
    const prepared = prepareMistake(save, q, new Date());
    try {
      persistSlot(localStorage, slot, prepared);
      save = prepared;
      if (storageWarning.startsWith('ほぞんできません')) storageWarning = '';
    } catch {
      session.attempts = Math.max(0, session.attempts - 1);
      session.feedback = 'きろくを ほぞんできません。ほごしゃに つたえてね。';
      storageWarning = 'ほぞんできません。あきようりょうを かくにんしてください。';
      render();
      return;
    }
    session.wrong++;
    session.locked = true;
    // Anti-guess: brief, bounded cooldown with a thinking cue, never removes earned XP.
    const extra = session.wrong >= 2 ? ' 💡 ' + makeHint(q) : '';
    if (session.wrong >= 2) session.hints++;
    session.feedback = 'おしい！ ちょっと かんがえてから もういちど。' + extra;
    gameAudio.effect('retry');
    haptic('retry', save.settings);
    render();
    const thisSession = session, questionIndex = session.index;
    unlockAnswerTimer = window.setTimeout(() => {
      unlockAnswerTimer = undefined;
      if (page !== 'game' || session !== thisSession || thisSession.index !== questionIndex ||
          thisSession.phase !== 'answer') return;
      thisSession.locked = false;
      render();
    }, Math.min(2000, 850 + session.wrong * 350));
    return;
  }
  const event = q.id + '|' + session.index;
  if (session.committed.has(event)) return;
  const { independent, earned, kind } = attemptOutcome(session.attempts, session.hints, mode);
  const practice = mode !== undefined;
  const prepared = prepareAnswer(save, q, kind, independent, earned, new Date());
  try {
    persistSlot(localStorage, slot, prepared.data);
    save = prepared.data;
    if (storageWarning.startsWith('ほぞんできません')) storageWarning = '';
  } catch {
    // No XP/review/daily count is committed when persistence fails.
    session.attempts = Math.max(0, session.attempts - 1);
    session.feedback = 'きろくを ほぞんできなかったよ。ほごしゃに つたえてね。';
    storageWarning = 'ほぞんできません。ブラウザの あきようりょうを かくにんしてください。';
    render();
    return;
  }
  session.committed.add(event);
  if (mode === 'skip') session.skipped++;
  else if (mode === 'practice') session.practiced++;
  else if (independent) session.right++;
  else session.helped++;
  const recalled = prepared.recalled;
  session.phase = 'solved';
  session.feedback = mode === 'skip' ? '🌱 みてくれて ありがとう。つぎへ いこう！' :
    (practice ? '✨ やってみたね！ ' : independent ? '✨ せいかい！ じぶんで できた！ ' :
    '🌱 できた！ かんがえなおせたね！ ') + q.explanation;
  gameAudio.effect(recalled && independent ? 'review' : 'correct');
  if (mode !== 'skip') haptic('correct', save.settings);
  render();
  if (mode !== 'skip') burst(recalled && independent ? 'review' : 'correct', earned);
  scheduleAdvance();
}
function next(): void {
  if (!session || session.phase !== 'solved' || page !== 'game') return;
  stopTimers();
  if (session.index === session.deck.length - 1) {
    const prepared = prepareClear(save, session, new Date());
    try {
      persistSlot(localStorage, slot, prepared);
      save = prepared;
      if (storageWarning.startsWith('ほぞんできません')) storageWarning = '';
    } catch {
      session.feedback = 'クリアきろくを ほぞんできなかったよ。ほごしゃに つたえてね。';
      storageWarning = 'ほぞんできません。クリアは まだ ほぞんされていません。';
      render();
      return;
    }
    page = 'result';
    gameAudio.effect('clear');
    const nextLevel = unlockedLevel(save.completed[session.gameId] ?? 0);
    haptic(nextLevel > session.level ? 'level' : 'clear', save.settings);
  } else {
    session = advanceSession(session);
    activityState = isActivity(session.gameId) ? newActivityState(session.deck[session.index]) : null;
    touchState = isTouchGame(session.gameId) ? freshTouch() : null;
    workshopState = isWorkshop(session.gameId) ? freshWorkshop() : null;
  }
  render();
  if (page === 'result') burst('clear');
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function hint(): void {
  if (!session || session.phase !== 'answer' || page !== 'game') return;
  session.hints++;
  const q = session.deck[session.index];
  session.feedback = '💡 ' + makeHint(q);
  gameAudio.effect('hint');
  render();
}
function resetCurrentLearning(): void {
  if (page !== 'parent' || !resetArmed) return;
  const old = save;
  const nextSave = freshSave();
  nextSave.settings = { ...old.settings };
  try {
    persistSlot(localStorage, slot, nextSave);
  } catch {
    storageWarning = 'リセットできませんでした。ブラウザのほぞんを かくにんしてください。';
    resetArmed = false;
    render();
    return;
  }
  stopTimers();
  save = nextSave;
  session = null;
  activityState = null; touchState = null; workshopState = null;
  resetArmed = false;
  backupDraft = null;
  storageWarning = 'がくしゅうきろくを リセットしました。ほかのキャラのきろくは そのままです。';
  render();
}
function speak(): void {
  if (!session) return;
  if (!('speechSynthesis' in window)) return;
  const q = session.deck[session.index];
  window.speechSynthesis.cancel();
  const movement = q.gameId === 'move' ? MOVE_CARDS[q.visual.a ?? 0] : undefined;
  const spoken = movement ? movement.instruction + '。' + movement.seated :
    session.phase === 'preview' ? 'えを よく みて、おぼえよう。' : q.prompt;
  const u = new SpeechSynthesisUtterance(spoken);
  u.lang = 'ja-JP'; u.rate = 0.83;
  window.speechSynthesis.speak(u);
}
async function prepareBackup(file: File): Promise<void> {
  backupDraft = null;
  backupError = '';
  try {
    if (file.size > 3 * 1024 * 1024) throw new Error('ファイルが 3MBを こえています。');
    const currentSlot = slot;
    const text = await file.text();
    if (slot !== currentSlot) return;
    backupDraft = parseBackup(text, slot);
  } catch (error) {
    backupError = error instanceof Error ? error.message : 'バックアップを よみこめません。';
  }
  if (page === 'parent') render();
}
function restoreBackup(): void {
  if (page !== 'parent' || !backupDraft || backupDraft.slot !== slot) return;
  try {
    // Single atomic localStorage write; preserve current in-memory state on failure.
    persistSlot(localStorage, slot, backupDraft.data);
    save = backupDraft.data;
    backupDraft = null; backupError = '';
    storageWarning = 'バックアップを ふくげんしました。';
    render();
  } catch {
    backupError = 'ふくげん できませんでした。あきようりょうを かくにんしてください。';
    render();
  }
}
function exportCsv(): void {
  const payload = learningCsv(save, new Date());
  const url = URL.createObjectURL(new Blob([payload], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'kids-learning-' + slot + '-90days.csv';
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportSave(): void {
  const payload = backupText(slot, save);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'kids-learning-v2-player-' + slot + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Adapter from activity UI into the existing single-answer, double-credit-safe session. */
function completeActivity(result: ActivityResult): void {
  if (result.kind === 'submit' && result.value !== undefined)
    answer(result.value, result.skipped ? 'skip' : result.assisted ? 'practice' : undefined);
  else render();
}
function onTouchPointer(event: PointerEvent, phase: 'down' | 'move' | 'up' | 'cancel'): void {
  if (page !== 'game' || session?.phase !== 'answer' || session.locked || !touchState ||
      !isTouchGame(session.gameId)) return;
  const svg = event.target instanceof Element ?
    event.target.closest<SVGSVGElement>('[data-touch-trace], [data-clock-face]') : null;
  if (!svg) return;
  // Prevent scrolling only while an actual trace or clock-hand gesture is in progress.
  const active = touchState.pointerId === event.pointerId;
  const result = touchPointer(session.deck[session.index], touchState, phase, event, svg);
  if (active || touchState.pointerId === event.pointerId) event.preventDefault();
  if (result.finished && result.value)
    answer(result.value, result.practice ? 'practice' : undefined);
  else if (result.refresh || phase === 'up' || phase === 'cancel') render();
}
function onTracePointer(event: PointerEvent, phase: 'down' | 'move' | 'up' | 'cancel'): void {
  if (page !== 'game' || (session?.gameId !== 'trace' && session?.gameId !== 'lines' && session?.gameId !== 'digits') || session?.phase !== 'answer' ||
      session.locked || !activityState) return;
  const svg = event.target instanceof Element ? event.target.closest<SVGSVGElement>('[data-trace-board]') : null;
  if (!svg) return;
  if (phase === 'down' || phase === 'move') event.preventDefault();
  const result = tracePointer(session.deck[session.index], activityState, phase, event, svg);
  if (result.kind === 'submit') completeActivity(result);
  else if (result.refresh || phase === 'up' || phase === 'cancel') render();
}
for (const [eventType, phase] of [
  ['pointerdown', 'down'], ['pointermove', 'move'], ['pointerup', 'up'], ['pointercancel', 'cancel']
] as const) {
  app.addEventListener(eventType, event => {
    onTracePointer(event as PointerEvent, phase);
    onTouchPointer(event as PointerEvent, phase);
  });
}

gameAudio.configure(save.settings.sound, save.settings.bgm, save.settings.seVolume, save.settings.bgmVolume);
applyTextSize();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopTimers();
    if (session) session.locked = false;
  } else if (page === 'game' && session?.phase === 'solved') {
    scheduleAdvance();
  } else if (page === 'game' && session?.phase === 'answer') {
    render();
  }
});
app.addEventListener('input', event => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (page === 'options' && target.hasAttribute('data-text-size')) {
    const size = clampTextSize(Number(target.value));
    save.settings.textSize = size;
    target.setAttribute('aria-valuetext', size + 'パーセント');
    const output = document.getElementById('text-size-output');
    if (output) output.textContent = size + '%';
    applyTextSize();
    saveNow();
    return;
  }
  const type = target.dataset.volume;
  if (page !== 'options' || (type !== 'bgm' && type !== 'se')) return;
  const value = clampVolume(Number(target.value), type === 'bgm' ? 75 : 65);
  if (type === 'bgm') save.settings.bgmVolume = value;
  else save.settings.seVolume = value;
  gameAudio.configure(save.settings.sound, save.settings.bgm, save.settings.seVolume, save.settings.bgmVolume);
  const output = document.getElementById(type + '-output');
  if (output) output.textContent = value + '%';
  saveNow();
});
app.addEventListener('change', event => {
  const element = event.target;
  if (page === 'parent' && element instanceof HTMLInputElement &&
      element.id === 'backup-file' && element.files?.[0]) void prepareBackup(element.files[0]);
});
app.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  gameAudio.unlock();
  const workshopButton = target.closest<HTMLButtonElement>('[data-workshop]');
  if (workshopButton && page === 'game' && session?.phase === 'answer' &&
      !session.locked && workshopState && isWorkshop(session.gameId)) {
    const q = session.deck[session.index];
    const result = workshopClick(q, workshopState, workshopButton.dataset.workshop ?? '',
      Number(workshopButton.dataset.index ?? -1));
    if (result.finished && result.value) answer(result.value, result.practice ? 'practice' : undefined);
    else { gameAudio.effect('tap'); render(); }
    return;
  }
  const touchButton = target.closest<HTMLButtonElement>('[data-touch]');
  if (touchButton && page === 'game' && session?.phase === 'answer' && !session.locked &&
      touchState && isTouchGame(session.gameId)) {
    const q = session.deck[session.index];
    const result = touchClick(q, touchState, touchButton.dataset.touch ?? '',
      Number(touchButton.dataset.index ?? -1));
    if (result.finished && result.value) answer(result.value, result.practice ? 'practice' : undefined);
    else render();
    return;
  }
  const activityButton = target.closest<HTMLButtonElement>('[data-activity]');
  if (activityButton && page === 'game' && session?.phase === 'answer' &&
      !session.locked && activityState && isActivity(session.gameId)) {
    const q = session.deck[session.index];
    const result = activityClick(q, activityState, activityButton.dataset.activity ?? '',
      Number(activityButton.dataset.index ?? -1));
    completeActivity(result);
    return;
  }
  const answerBtn = target.closest<HTMLButtonElement>('[data-answer]');
  if (answerBtn) { answer(answerBtn.dataset.answer ?? ''); return; }
  const skillButton = target.closest<HTMLButtonElement>('[data-skill-category]');
  if (page === 'skills' && skillButton &&
      PROGRESS_CATEGORIES.some(x => x.id === skillButton.dataset.skillCategory)) {
    skillCategory = skillButton.dataset.skillCategory as ProgressCategory;
    gameAudio.effect('tap');
    render();
    return;
  }
  const categoryBtn = target.closest<HTMLButtonElement>('[data-category]');
  if (page === 'home' && categoryBtn && CATEGORIES.some(x => x.id === categoryBtn.dataset.category)) {
    categoryFilter = categoryBtn.dataset.category ?? 'all';
    gameAudio.effect('tap');
    render();
    return;
  }
  const skillPlay = target.closest<HTMLButtonElement>('[data-skill-play]');
  if (page === 'skills' && skillPlay && isGameId(skillPlay.dataset.skillPlay ?? '')) {
    startGame(skillPlay.dataset.skillPlay as GameId, Number(skillPlay.dataset.level));
    return;
  }
  const gameBtn = target.closest<HTMLButtonElement>('[data-game]');
  if (gameBtn && isGameId(gameBtn.dataset.game ?? '')) { startGame(gameBtn.dataset.game as GameId); return; }
  const slotBtn = target.closest<HTMLButtonElement>('[data-slot]');
  if (slotBtn) { setSlot(Number(slotBtn.dataset.slot)); return; }
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'home') { window.speechSynthesis?.cancel(); dismissEffects(); stopTimers();
    page = 'home'; session = null; activityState = null; touchState = null; workshopState = null; backupDraft = null; resetArmed = false; render(); }
  else if (action === 'stats' || action === 'skills' || action === 'world') {
    dismissEffects(); stopTimers(); gameAudio.effect('tap');
    page = action; render(); window.scrollTo({ top: 0, behavior: 'auto' });
  }
  else if (action === 'parent') { dismissEffects(); stopTimers(); page = 'parent';
    session = null; activityState = null; touchState = null; workshopState = null; backupDraft = null; resetArmed = false; render(); }
  else if (action === 'options') { dismissEffects(); stopTimers(); if (session) session.locked = false;
    beforeOptions = page === 'options' ? 'home' : page; page = 'options'; render(); }
  else if (action === 'back-options') { page = beforeOptions; render(); scheduleAdvance(); }
  else if (action === 'replay' && session) startGame(session.gameId);
  else if (action === 'next') next();
  else if (action === 'hint') hint();
  else if (action === 'remember' && session?.phase === 'preview') { session.phase = 'answer'; render(); }
  else if (action === 'speak') speak();
  else if (action === 'quiet') { save.settings.quiet = !save.settings.quiet; dismissEffects(); saveNow(); render(); }
  else if (action === 'haptics' && page === 'options') {
    save.settings.haptics = !save.settings.haptics;
    saveNow();
    if (save.settings.haptics) haptic('correct', save.settings);
    render();
  }
  else if (action === 'test-haptics' && page === 'options') haptic('clear', save.settings);
  else if (action === 'sound') { save.settings.sound = !save.settings.sound; gameAudio.configure(save.settings.sound, save.settings.bgm, save.settings.seVolume, save.settings.bgmVolume); saveNow(); render(); }
  else if (action === 'bgm') { save.settings.bgm = !save.settings.bgm; gameAudio.configure(save.settings.sound, save.settings.bgm, save.settings.seVolume, save.settings.bgmVolume); saveNow(); render(); }
  else if (action === 'test-se') gameAudio.effect('correct');
  else if (action === 'text-default' && page === 'options') {
    save.settings.textSize = 100;
    applyTextSize();
    saveNow();
    const input = document.getElementById('text-size');
    if (input instanceof HTMLInputElement) {
      input.value = '100';
      input.setAttribute('aria-valuetext', '100パーセント');
    }
    const output = document.getElementById('text-size-output');
    if (output) output.textContent = '100%';
  }
  else if (action === 'export') exportSave();
  else if (action === 'export-csv' && page === 'parent') exportCsv();
  else if (action === 'reset-open' && page === 'parent') { resetArmed = true; render(); }
  else if (action === 'reset-cancel' && page === 'parent') { resetArmed = false; render(); }
  else if (action === 'reset-now') resetCurrentLearning();
  else if (action === 'backup-confirm') restoreBackup();
  else if (action === 'backup-cancel') { backupDraft = null; backupError = ''; render(); }
});
render();
