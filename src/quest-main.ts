import './game.css';
import './activity.css';
import { gameAudio } from './game-audio';
import { isActivity, MOVE_CARDS } from './activity-content';
import { activityHtml, activityClick, newActivityState, tracePointer } from './activity-ui';
import type { ActivityResult, ActivityState } from './activity-ui';
import { burst, dismissEffects } from './reward-effects';
import { GAMES, STORAGE_KEY, MAX_LEVEL, CLEARS_PER_LEVEL, progressFor, unlockedLevel, clampTextSize, clampVolume, chooseRound, countDue, evaluate, freshSave, isGameId, nextReview } from './engine';
import type { GameId, LearningSave, Question, Visual } from './engine';

const app = document.getElementById('app');
if (!app) throw new Error('Root #app not found');

type Phase = 'preview' | 'answer' | 'solved';
interface Session {
  gameId: GameId;
  level: number;
  deck: Question[];
  index: number;
  right: number;
  helped: number;
  practiced: number;
  skipped: number;
  wrong: number;
  phase: Phase;
  attempts: number;
  hints: number;
  feedback: string;
  locked: boolean;
  committed: Set<string>;
}
type AppPage = 'home' | 'game' | 'result' | 'parent' | 'options';
let page: AppPage = 'home';
let beforeOptions: Exclude<AppPage, 'options'> = 'home';
let session: Session | null = null;
let activityState: ActivityState | null = null;
let categoryFilter = 'all';
let resetArmed = false;
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
  try {
    const raw = localStorage.getItem(storeKey());
    if (!raw) return freshSave();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return freshSave();
    const obj = parsed as Partial<LearningSave>;
    if (obj.schema !== 2) return freshSave();
    const data = freshSave();
    data.xp = Number.isFinite(obj.xp) ? Math.max(0, Number(obj.xp)) : 0;
    data.sessions = Number.isFinite(obj.sessions) ? Math.max(0, Number(obj.sessions)) : 0;
    if (obj.completed && typeof obj.completed === 'object') {
      for (const game of GAMES) {
        const n = (obj.completed as Record<string, unknown>)[game.id];
        if (typeof n === 'number' && Number.isInteger(n) && n >= 0) data.completed[game.id] = Math.min(n, 100000);
      }
    }
    if (obj.settings && typeof obj.settings === 'object') {
      data.settings.quiet = obj.settings.quiet === true;
      data.settings.sound = typeof obj.settings.sound === 'boolean' ? obj.settings.sound : true;
      data.settings.bgm = obj.settings.bgm !== false;
      data.settings.bgmVolume = clampVolume(obj.settings.bgmVolume, 75);
      data.settings.seVolume = clampVolume(obj.settings.seVolume, 65);
      data.settings.textSize = clampTextSize(obj.settings.textSize);
    }
    if (obj.reviews && typeof obj.reviews === 'object') {
      for (const [key, value] of Object.entries(obj.reviews)) {
        if (!value || typeof value !== 'object') continue;
        const review = value as Partial<LearningSave['reviews'][string]>;
        const question = review.question;
        if (!question || !isGameId(String(question.gameId)) || typeof question.id !== 'string' ||
          !Array.isArray(question.choices) || !question.choices.every(x => typeof x === 'string') ||
          typeof question.answer !== 'string' || !question.choices.includes(question.answer) ||
          typeof question.prompt !== 'string' || typeof question.explanation !== 'string' ||
          !question.visual || typeof question.visual !== 'object' ||
          !Number.isFinite(review.dueAt) || !Number.isFinite(review.lastAnsweredAt)) continue;
        const suffix = question.id.slice(question.gameId.length + 1);
        const parts = suffix.match(/^(?:L([2-5]):)?(\d{1,3})$/);
        if (!question.id.startsWith(question.gameId + ':') || !parts) continue;
        const level = parts[1] ? Number(parts[1]) : 1;
        const index = Number(parts[2]);
        if (!Number.isInteger(index) || index < 0 || index > 200) continue;
        if (key !== question.id) continue;
        // Rebuild canonical questions for the matching difficulty level, not from persisted DOM data.
        const canonical = chooseCanonical(question.gameId, index, level);
        data.reviews[key] = {
          question: canonical, stage: Math.max(0, Math.min(3, Math.floor(Number(review.stage) || 0))),
          dueAt: Number(review.dueAt), lastAnsweredAt: Number(review.lastAnsweredAt), correct: review.correct === true
        };
      }
    }
    return data;
  } catch {
    storageWarning = 'きろくを よみこめませんでした。ほごしゃに みてもらおう。';
    return freshSave();
  }
}
function chooseCanonical(gameId: GameId, index: number, level = 1): Question {
  // The import is deliberately in engine rather than trusting records on localStorage.
  return generate(gameId, index, level);
}
import { makeQuestion as generate } from './engine';

function saveNow(): void {
  try { localStorage.setItem(storeKey(), JSON.stringify(save)); }
  catch { storageWarning = 'ほぞんできません。ブラウザの あきようりょうを かくにんしてください。'; }
}
function setSlot(next: number): void {
  if (!Number.isInteger(next) || next < 1 || next > 4) return;
  dismissEffects();
  stopTimers();
  resetArmed = false;
  gameAudio.effect('profile');
  slot = next;
  try { localStorage.setItem('kids_learning_active_slot_v2', String(slot)); } catch { /* in-memory only */ }
  save = loadSave();
  gameAudio.configure(save.settings.sound, save.settings.bgm, save.settings.seVolume, save.settings.bgmVolume);
  applyTextSize();
  session = null;
  activityState = null;
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
    case 'compare': return '<div class="compare"><div><small>ひだり</small><strong>' + a + '</strong>' +
      dots(a) + '</div><b>VS</b><div><small>みぎ</small><strong>' + b + '</strong>' + dots(b) + '</div></div>';
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
  const options = isActivity(q.gameId) && activityState
    ? activityHtml(q, activityState, solved || locked) :
    memoryPreview ? '<button type="button" class="primary-btn" data-action="remember">おぼえた！ こたえる ➜</button>' :
    '<div class="answer-instruction">こたえを ひとつ えらんでね</div><div class="answer-grid' + (longChoices ? ' long-choices' : '') + '">' +
    q.choices.map(choice => '<button type="button" class="answer-btn" aria-label="こたえ ' + safe(choice) +
      '" data-answer="' + safe(choice) + '"' + (solved || locked ? ' disabled' : '') +
      '><span class="answer-choice">' + safe(choice) + '</span></button>').join('') + '</div>';
  const hint = !memoryPreview && !solved ? '<button type="button" class="hint-btn" data-action="hint">💡 ヒントを みる</button>' : '';
  const feedback = session.feedback ? '<div class="feedback ' + (solved ? 'feedback-good' : 'feedback-try') +
    '" role="status">' + safe(session.feedback) + '</div>' : '';
  return layout('<section class="play-head"><button type="button" class="back-btn" data-action="home">← もどる</button>' +
    '<span class="pill">' + safe(game.title) + ' · LV ' + session.level + '/' + MAX_LEVEL +
    '</span><span class="pill">' + number + ' / ' + session.deck.length + '</span></section>' +
    '<div class="progress" role="progressbar" aria-label="もんだいの すすみぐあい" aria-valuemin="0" aria-valuemax="5" aria-valuenow="' +
    session.index + '"><div style="width:' + percent + '%"></div></div>' +
    '<section class="challenge" style="--accent:' + game.color + '"><div class="challenge-tag">' + game.icon + ' QUESTION ' + number + '</div>' +
    '<h1>' + safe(memoryPreview ? 'まずは えを おぼえよう！' : q.prompt) + '</h1>' +
    (isActivity(q.gameId) ? '' : '<div class="visual-stage">' + visualHtml(q.visual, memoryPreview) + '</div>') +
    (memoryPreview ? '<p class="memory-note">じかんは きにしなくて いいよ。おぼえたら ボタンを おしてね。</p>' : '') +
    '<button type="button" class="read-btn" data-action="speak">🔊 もんだいを きく</button>' +
    '<div class="answers">' + options + '</div>' + feedback + hint +
    (solved ? '<div class="auto-next" role="status">✨ じどうで つぎへ すすむよ…</div>' +
      '<button type="button" class="primary-btn next-btn" data-action="next">' +
      (number === session.deck.length ? '🎉 けっかを みる' : 'つぎの もんだい ➜') + '</button>' : '') +
    '</section><p class="play-note">まちがえても だいじょうぶ。なんかいでも かんがえられるよ。</p>');
}
function resultHtml(): string {
  if (!session) return homeHtml();
  const game = GAMES.find(g => g.id === session?.gameId)!;
  const practice = session.gameId === 'trace' || session.gameId === 'move';
  return layout('<section class="result-card"><div class="result-emoji" aria-hidden="true">' + game.icon + '🏆</div>' +
    '<p class="eyebrow">QUEST CLEAR!</p><h1>クエスト クリア！</h1>' +
    '<p>' + safe(activeProfile().name) + '、' + safe(game.title) + ' を がんばったね！</p>' +
    '<div class="unlock-result">⭐ レベル ' + progressFor(save.completed[game.id] ?? 0).level +
    '/' + MAX_LEVEL + (progressFor(save.completed[game.id] ?? 0).level > session.level ?
    ' 🎊 あたらしい レベルが ひらいた！' :
    ' · ' + progressFor(save.completed[game.id] ?? 0).current + '/' + CLEARS_PER_LEVEL + ' クリア') + '</div>' +
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
    '<button type="button" class="secondary-btn" data-action="replay">もういちど あそぶ</button></section>');
}
function optionsHtml(): string {
  const settings = save.settings;
  return layout('<section class="options-panel">' +
    '<p class="eyebrow">SETTINGS</p><h1>⚙️ せってい</h1>' +
    '<p class="options-lead">もじの おおきさ と おとを すきな ように かえてね。</p>' +
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
    '<h2>ゲーム別の進捗</h2><div class="table-wrap"><table><thead><tr><th>ゲーム</th><th>クリア</th><th>復習待ち</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' +
    '<div class="parent-actions"><button type="button" class="secondary-btn" data-action="export">⬇ このキャラのきろくを ほぞん</button>' +
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
  else if (page === 'options') app.innerHTML = optionsHtml();
  else app.innerHTML = homeHtml();
  document.body.classList.toggle('quiet-mode', save.settings.quiet);
  applyTextSize();
  gameAudio.setScene(page);
}
function startGame(id: GameId): void {
  stopTimers();
  const level = unlockedLevel(save.completed[id] ?? 0);
  const deck = chooseRound(id, save, Date.now(), 5, level);
  activityState = isActivity(id) ? newActivityState(deck[0]) : null;
  session = { gameId: id, level, deck, index: 0, right: 0, helped: 0, wrong: 0, phase: deck[0].visual.kind === 'memory' ? 'preview' : 'answer',
    attempts: 0, hints: 0, feedback: '', locked: false, practiced: 0, skipped: 0, committed: new Set() };
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
    case 'trace': return 'ゆびを ゆっくり うごかして てんを つなごう。';
    case 'blocks': return '5こずつ まとめて かぞえてみよう。';
    case 'train': return 'えの なまえを ゆっくり こえに だしてみよう。';
    case 'move': return 'できる ところだけ まねしてみよう。むりしなくて いいよ。';
  }
}
function answer(choice: string, mode?: 'practice' | 'skip'): void {
  if (!session || session.phase !== 'answer' || session.locked || page !== 'game') return;
  const q = session.deck[session.index];
  if (!isActivity(q.gameId) && !q.choices.includes(choice)) return;
  session.attempts++;
  if (!evaluate(q, choice)) {
    session.wrong++;
    session.locked = true;
    // Anti-guess: brief, bounded cooldown with a thinking cue, never removes earned XP.
    const extra = session.wrong >= 2 ? ' 💡 ' + makeHint(q) : '';
    if (session.wrong >= 2) session.hints++;
    session.feedback = 'おしい！ ちょっと かんがえてから もういちど。' + extra;
    gameAudio.effect('retry');
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
  session.committed.add(event);
  const practice = mode !== undefined;
  const independent = !practice && session.attempts === 1 && session.hints === 0;
  if (practice) {
    if (mode === 'skip') session.skipped++; else session.practiced++;
  } else if (independent) session.right++;
  else session.helped++;
  const recalled = !practice && Boolean(save.reviews[q.id]?.dueAt && save.reviews[q.id].dueAt <= Date.now());
  // Tracing and self-reported movement are practice, NOT validated recall or motor proficiency.
  if (!practice) save.reviews[q.id] = nextReview(save.reviews[q.id], q, independent, Date.now());
  const earned = mode === 'skip' ? 0 : practice ? 5 : independent ? 10 : 5;
  save.xp += earned;
  saveNow();
  session.phase = 'solved';
  session.feedback = mode === 'skip' ? '🌱 みてくれて ありがとう。つぎへ いこう！' :
    (practice ? '✨ やってみたね！ ' : independent ? '✨ せいかい！ じぶんで できた！ ' :
    '🌱 できた！ かんがえなおせたね！ ') + q.explanation;
  gameAudio.effect(recalled && independent ? 'review' : 'correct');
  render();
  if (mode !== 'skip') burst(recalled && independent ? 'review' : 'correct', earned);
  scheduleAdvance();
}
function next(): void {
  if (!session || session.phase !== 'solved' || page !== 'game') return;
  stopTimers();
  if (session.index === session.deck.length - 1) {
    save.sessions++;
    // Rest-only movement sessions are welcome, but do not unlock harder levels.
    if (session.gameId !== 'move' || session.practiced > 0)
      save.completed[session.gameId] = (save.completed[session.gameId] ?? 0) + 1;
    saveNow();
    page = 'result';
    gameAudio.effect('clear');
  } else {
    session.index++;
    activityState = isActivity(session.gameId) ? newActivityState(session.deck[session.index]) : null;
    session.attempts = 0; session.hints = 0; session.feedback = ''; session.locked = false;
    session.phase = session.deck[session.index].visual.kind === 'memory' ? 'preview' : 'answer';
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
    localStorage.setItem(storeKey(), JSON.stringify(nextSave));
  } catch {
    storageWarning = 'リセットできませんでした。ブラウザのほぞんを かくにんしてください。';
    resetArmed = false;
    render();
    return;
  }
  stopTimers();
  save = nextSave;
  session = null;
  activityState = null;
  resetArmed = false;
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
function exportSave(): void {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), slot, data: save }, null, 2);
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
function onTracePointer(event: PointerEvent, phase: 'down' | 'move' | 'up' | 'cancel'): void {
  if (page !== 'game' || session?.gameId !== 'trace' || session.phase !== 'answer' ||
      session.locked || !activityState) return;
  const svg = event.target instanceof Element ? event.target.closest<SVGSVGElement>('[data-trace-board]') : null;
  if (!svg) return;
  if (phase === 'down' || phase === 'move') event.preventDefault();
  const result = tracePointer(session.deck[session.index], activityState, phase, event, svg);
  if (result.kind === 'submit') completeActivity(result);
  else if (phase === 'up' || phase === 'cancel') render();
}
for (const [eventType, phase] of [
  ['pointerdown', 'down'], ['pointermove', 'move'], ['pointerup', 'up'], ['pointercancel', 'cancel']
] as const) {
  app.addEventListener(eventType, event => onTracePointer(event as PointerEvent, phase));
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
app.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  gameAudio.unlock();
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
  const categoryBtn = target.closest<HTMLButtonElement>('[data-category]');
  if (page === 'home' && categoryBtn && CATEGORIES.some(x => x.id === categoryBtn.dataset.category)) {
    categoryFilter = categoryBtn.dataset.category ?? 'all';
    gameAudio.effect('tap');
    render();
    return;
  }
  const gameBtn = target.closest<HTMLButtonElement>('[data-game]');
  if (gameBtn && isGameId(gameBtn.dataset.game ?? '')) { startGame(gameBtn.dataset.game as GameId); return; }
  const slotBtn = target.closest<HTMLButtonElement>('[data-slot]');
  if (slotBtn) { setSlot(Number(slotBtn.dataset.slot)); return; }
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'home') { window.speechSynthesis?.cancel(); dismissEffects(); stopTimers();
    page = 'home'; session = null; activityState = null; resetArmed = false; render(); }
  else if (action === 'parent') { dismissEffects(); stopTimers(); page = 'parent';
    session = null; activityState = null; resetArmed = false; render(); }
  else if (action === 'options') { dismissEffects(); stopTimers(); if (session) session.locked = false;
    beforeOptions = page === 'options' ? 'home' : page; page = 'options'; render(); }
  else if (action === 'back-options') { page = beforeOptions; render(); scheduleAdvance(); }
  else if (action === 'replay' && session) startGame(session.gameId);
  else if (action === 'next') next();
  else if (action === 'hint') hint();
  else if (action === 'remember' && session?.phase === 'preview') { session.phase = 'answer'; render(); }
  else if (action === 'speak') speak();
  else if (action === 'quiet') { save.settings.quiet = !save.settings.quiet; dismissEffects(); saveNow(); render(); }
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
  else if (action === 'reset-open' && page === 'parent') { resetArmed = true; render(); }
  else if (action === 'reset-cancel' && page === 'parent') { resetArmed = false; render(); }
  else if (action === 'reset-now') resetCurrentLearning();
});
render();
