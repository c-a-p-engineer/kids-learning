import './game.css';
import { gameAudio } from './game-audio';
import { burst, dismissEffects } from './reward-effects';
import { GAMES, STORAGE_KEY, chooseRound, countDue, evaluate, freshSave, isGameId, nextReview } from './engine';
import type { GameId, LearningSave, Question, Visual } from './engine';

const app = document.getElementById('app');
if (!app) throw new Error('Root #app not found');

type Phase = 'preview' | 'answer' | 'solved';
interface Session {
  gameId: GameId;
  deck: Question[];
  index: number;
  right: number;
  helped: number;
  wrong: number;
  phase: Phase;
  attempts: number;
  hints: number;
  feedback: string;
  committed: Set<string>;
}
let page: 'home' | 'game' | 'result' | 'parent' = 'home';
let session: Session | null = null;
let slot = getSlot();
let storageWarning = '';
let save = loadSave();
const HOME_TITLE = 'まなびクエスト';
const PROFILES = [
  { id: 1, name: 'ほしのこ', icon: '🦊', color: '#ffe3a2' },
  { id: 2, name: 'にじのこ', icon: '🐰', color: '#f8d9f5' },
  { id: 3, name: 'そらのこ', icon: '🐻', color: '#d8e6ff' },
  { id: 4, name: 'はなのこ', icon: '🐼', color: '#d8f5df' }
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
        const index = Number(question.id.split(':').pop());
        if (!Number.isInteger(index) || index < 0 || index > 200 || question.id !== question.gameId + ':' + index) continue;
        if (key !== question.id) continue;
        // Rebuild from the trusted generator, not a persisted DOM payload.
        const canonical = chooseCanonical(question.gameId, index);
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
function chooseCanonical(gameId: GameId, index: number): Question {
  // The import is deliberately in engine rather than trusting records on localStorage.
  return generate(gameId, index);
}
import { makeQuestion as generate } from './engine';

function saveNow(): void {
  try { localStorage.setItem(storeKey(), JSON.stringify(save)); }
  catch { storageWarning = 'ほぞんできません。ブラウザの あきようりょうを かくにんしてください。'; }
}
function setSlot(next: number): void {
  if (!Number.isInteger(next) || next < 1 || next > 4) return;
  dismissEffects();
  gameAudio.effect('profile');
  slot = next;
  try { localStorage.setItem('kids_learning_active_slot_v2', String(slot)); } catch { /* in-memory only */ }
  save = loadSave();
  gameAudio.configure(save.settings.sound, save.settings.bgm);
  session = null;
  page = 'home';
  render();
}
function layout(body: string, parent = false): string {
  return '<div class="app-shell' + (save.settings.quiet ? ' quiet' : '') + '">' +
    '<header class="topbar"><button type="button" class="brand" data-action="home" aria-label="ホームへ もどる">' +
    '<span class="brand-icon">⭐</span><span>' + HOME_TITLE + '</span></button>' +
    '<div class="top-actions"><span class="pill level-pill" aria-label="けいけんち">✨ ' + save.xp + ' XP</span>' +
    '<button type="button" class="icon-btn music-toggle" data-action="bgm" aria-label="BGMをきりかえる" aria-pressed="' + save.settings.bgm + '" title="BGM">' +
    (save.settings.bgm ? '🎵' : '🎼') + '</button>' +
    '<button type="button" class="icon-btn" data-action="quiet" aria-pressed="' + save.settings.quiet + '" title="えんしゅつを きりかえ">' +
    (save.settings.quiet ? '🌙' : '🌟') + '</button>' +
    '<button type="button" class="icon-btn" data-action="sound" aria-pressed="' + save.settings.sound + '" title="こうかおん" aria-label="こうかおんをきりかえる">' +
    (save.settings.sound ? '🔊' : '🔇') + '</button></div></header>' +
    '<main id="main-content">' + (storageWarning ? '<div class="warning" role="status">' + safe(storageWarning) + '</div>' : '') + body + '</main>' +
    '<footer class="footer"><span>広告なし・アカウントなし・きろくは このたんまつ</span>' +
    '<button type="button" data-action="' + (parent ? 'home' : 'parent') + '">' + (parent ? 'あそびに もどる' : '⚙ ほごしゃ') + '</button></footer></div>';
}
function homeHtml(): string {
  const due = GAMES.reduce((n, game) => n + countDue(game.id, save, Date.now()), 0);
  const profiles = PROFILES.map(p =>
    '<button type="button" class="profile-chip profile-avatar' + (p.id === slot ? ' chosen' : '') +
    '" style="--profile-color:' + p.color + '" data-slot="' + p.id +
    '" aria-pressed="' + (p.id === slot) + '"><span aria-hidden="true">' + p.icon +
    '</span><strong>' + p.name + '</strong></button>').join('');
  const cards = GAMES.map((game, i) => {
    const dueCount = countDue(game.id, save, Date.now()), total = save.completed[game.id] ?? 0;
    return '<button type="button" class="quest-card" style="--accent:' + game.color + '" data-game="' + game.id +
      '"><span class="quest-number">' + safe(game.subject) + ' · QUEST ' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="quest-icon">' + game.icon + '</span><span class="quest-title">' + safe(game.title) + '</span>' +
      '<span class="quest-description">' + safe(game.description) + '</span>' +
      '<span class="quest-meta">' + (dueCount ? '🔁 ふくしゅう ' + dueCount + 'こ' : '🌱 5もんチャレンジ') +
      ' · ' + (total ? '🏅 ' + total + 'かいクリア' : 'はじめての ぼうけん') + '</span></button>';
  }).join('');
  return layout('<section class="hero"><div class="hero-content"><p class="eyebrow">HELLO, LITTLE HERO!</p>' +
    '<h1>きょうの <span>ぼうけん</span>に<br>しゅっぱつ！</h1>' +
    '<p>15この ぼうけん！ こたえて、ひらめいて、<strong>できた！</strong>を あつめよう。</p>' +
    '<div class="hero-stats"><span>🏆 ' + save.sessions + 'かいクリア</span><span>✨ ' + save.xp + ' XP</span>' +
    (due ? '<span>🔁 ふくしゅう ' + due + 'こ</span>' : '<span>🌈 きょうも いっぽ！</span>') + '</div></div>' +
    '<div class="hero-mascot" aria-hidden="true">🦊<span>⭐</span></div></section>' +
    '<section class="select-profile" aria-label="ぼうけんの なかまを えらぶ"><strong>ぼうけんの なかまを えらぼう！</strong><div class="profile-row">' +
    profiles + '</div></section>' +
    '<section class="quests"><div class="section-header"><h2>クエストを えらぼう</h2><p>すきなものから はじめていいよ！</p></div>' +
    '<div class="quest-grid">' + cards + '</div></section>' +
    '<div class="home-bottom">⏱ 1ゲーム 5もんで おしまい。いつでも おわって いいよ。</div>');
}
function dots(n: number, faded = 0): string {
  let html = '<div class="dot-row" aria-hidden="true">';
  for (let i = 0; i < n; i++) html += '<span class="dot' + (i >= n - faded ? ' dot-faded' : '') + '"></span>';
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
}
function gameHtml(): string {
  if (!session) return homeHtml();
  const game = GAMES.find(g => g.id === session?.gameId)!;
  const q = session.deck[session.index];
  const number = session.index + 1, percent = (session.index / session.deck.length) * 100;
  const memoryPreview = q.visual.kind === 'memory' && session.phase === 'preview';
  const solved = session.phase === 'solved';
  const options = memoryPreview ? '<button type="button" class="primary-btn" data-action="remember">おぼえた！ こたえる ➜</button>' :
    '<div class="answer-grid">' + q.choices.map((choice, i) => '<button type="button" class="answer-btn" data-answer="' + safe(choice) +
      '"' + (solved ? ' disabled' : '') + '><span class="answer-letter">' + (i + 1) + '</span><span>' +
      safe(choice) + '</span></button>').join('') + '</div>';
  const hint = !memoryPreview && !solved ? '<button type="button" class="hint-btn" data-action="hint">💡 ヒントを みる</button>' : '';
  const feedback = session.feedback ? '<div class="feedback ' + (solved ? 'feedback-good' : 'feedback-try') +
    '" role="status">' + safe(session.feedback) + '</div>' : '';
  return layout('<section class="play-head"><button type="button" class="back-btn" data-action="home">← もどる</button>' +
    '<span class="pill">' + safe(game.title) + '</span><span class="pill">' + number + ' / ' + session.deck.length + '</span></section>' +
    '<div class="progress" role="progressbar" aria-label="もんだいの すすみぐあい" aria-valuemin="0" aria-valuemax="5" aria-valuenow="' +
    session.index + '"><div style="width:' + percent + '%"></div></div>' +
    '<section class="challenge" style="--accent:' + game.color + '"><div class="challenge-tag">' + game.icon + ' QUESTION ' + number + '</div>' +
    '<h1>' + safe(memoryPreview ? 'まずは えを おぼえよう！' : q.prompt) + '</h1>' +
    '<div class="visual-stage">' + visualHtml(q.visual, memoryPreview) + '</div>' +
    (memoryPreview ? '<p class="memory-note">じかんは きにしなくて いいよ。おぼえたら ボタンを おしてね。</p>' : '') +
    '<button type="button" class="read-btn" data-action="speak">🔊 もんだいを きく</button>' +
    '<div class="answers">' + options + '</div>' + feedback + hint +
    (solved ? '<button type="button" class="primary-btn next-btn" data-action="next">' +
      (number === session.deck.length ? '🎉 けっかを みる' : 'つぎの もんだい ➜') + '</button>' : '') +
    '</section><p class="play-note">まちがえても だいじょうぶ。なんかいでも かんがえられるよ。</p>');
}
function resultHtml(): string {
  if (!session) return homeHtml();
  const game = GAMES.find(g => g.id === session?.gameId)!;
  return layout('<section class="result-card"><div class="result-emoji" aria-hidden="true">' + game.icon + '🏆</div>' +
    '<p class="eyebrow">QUEST CLEAR!</p><h1>クエスト クリア！</h1>' +
    '<p>' + safe(activeProfile().name) + '、' + safe(game.title) + ' を がんばったね！</p>' +
    '<div class="result-scores"><div><strong>' + session.right + '</strong><small>ひとりで できた</small></div>' +
    '<div><strong>' + session.helped + '</strong><small>ヒントで できた</small></div>' +
    '<div><strong>' + session.deck.length + '</strong><small>クリアした もんだい</small></div></div>' +
    '<p class="result-explain">あしたも おぼえていたら さらに すごい！<br>おぼえているか、また ためしてみよう。</p>' +
    '<button type="button" class="primary-btn" data-action="home">ほかの クエストへ ➜</button>' +
    '<button type="button" class="secondary-btn" data-action="replay">もういちど あそぶ</button></section>');
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
    '<div class="parent-actions"><button type="button" class="secondary-btn" data-action="export">⬇ このプレイヤーの記録を保存</button>' +
    '<p>旧版の学習記録は削除しません。新版は別のキーに保存しています。記録の移行・統合はまだ行っていません。</p></div></section>', true);
}
function render(): void {
  if (!app) return;
  if (page === 'game') app.innerHTML = gameHtml();
  else if (page === 'result') app.innerHTML = resultHtml();
  else if (page === 'parent') app.innerHTML = parentHtml();
  else app.innerHTML = homeHtml();
  document.body.classList.toggle('quiet-mode', save.settings.quiet);
  gameAudio.setScene(page);
}
function startGame(id: GameId): void {
  const deck = chooseRound(id, save, Date.now());
  session = { gameId: id, deck, index: 0, right: 0, helped: 0, wrong: 0, phase: deck[0].visual.kind === 'memory' ? 'preview' : 'answer',
    attempts: 0, hints: 0, feedback: '', committed: new Set() };
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
  }
}
function answer(choice: string): void {
  if (!session || session.phase !== 'answer') return;
  const q = session.deck[session.index];
  if (!q.choices.includes(choice)) return;
  session.attempts++;
  if (!evaluate(q, choice)) {
    session.wrong++;
    session.feedback = 'おしい！ もういちど かんがえてみよう。ヒントも つかえるよ。';
    gameAudio.effect('retry');
    render();
    return;
  }
  const event = q.id + '|' + session.index;
  if (session.committed.has(event)) return;
  session.committed.add(event);
  const independent = session.attempts === 1 && session.hints === 0;
  if (independent) session.right++; else session.helped++;
  const recalled = Boolean(save.reviews[q.id]?.dueAt && save.reviews[q.id].dueAt <= Date.now());
  save.reviews[q.id] = nextReview(save.reviews[q.id], q, independent, Date.now());
  save.xp += independent ? 10 : 5;
  saveNow();
  session.phase = 'solved';
  session.feedback = (independent ? '✨ せいかい！ じぶんで できた！ ' : '🌱 できた！ かんがえなおせたね！ ') + q.explanation;
  gameAudio.effect(recalled && independent ? 'review' : 'correct');
  render();
  burst(recalled && independent ? 'review' : 'correct', independent ? 10 : 5);
}
function next(): void {
  if (!session || session.phase !== 'solved') return;
  if (session.index === session.deck.length - 1) {
    save.sessions++;
    save.completed[session.gameId] = (save.completed[session.gameId] ?? 0) + 1;
    saveNow();
    page = 'result';
    gameAudio.effect('clear');
  } else {
    session.index++;
    session.attempts = 0; session.hints = 0; session.feedback = '';
    session.phase = session.deck[session.index].visual.kind === 'memory' ? 'preview' : 'answer';
  }
  render();
  if (page === 'result') burst('clear');
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function hint(): void {
  if (!session || session.phase !== 'answer') return;
  session.hints++;
  const q = session.deck[session.index];
  session.feedback = '💡 ' + makeHint(q);
  gameAudio.effect('hint');
  render();
}
function speak(): void {
  if (!session) return;
  if (!('speechSynthesis' in window)) return;
  const q = session.deck[session.index];
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(session.phase === 'preview' ? 'えを よく みて、おぼえよう。' : q.prompt);
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
gameAudio.configure(save.settings.sound, save.settings.bgm);
app.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  gameAudio.unlock();
  const answerBtn = target.closest<HTMLButtonElement>('[data-answer]');
  if (answerBtn) { answer(answerBtn.dataset.answer ?? ''); return; }
  const gameBtn = target.closest<HTMLButtonElement>('[data-game]');
  if (gameBtn && isGameId(gameBtn.dataset.game ?? '')) { startGame(gameBtn.dataset.game as GameId); return; }
  const slotBtn = target.closest<HTMLButtonElement>('[data-slot]');
  if (slotBtn) { setSlot(Number(slotBtn.dataset.slot)); return; }
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'home') { window.speechSynthesis?.cancel(); dismissEffects(); page = 'home'; session = null; render(); }
  else if (action === 'parent') { dismissEffects(); page = 'parent'; session = null; render(); }
  else if (action === 'replay' && session) startGame(session.gameId);
  else if (action === 'next') next();
  else if (action === 'hint') hint();
  else if (action === 'remember' && session?.phase === 'preview') { session.phase = 'answer'; render(); }
  else if (action === 'speak') speak();
  else if (action === 'quiet') { save.settings.quiet = !save.settings.quiet; dismissEffects(); saveNow(); render(); }
  else if (action === 'sound') { save.settings.sound = !save.settings.sound; gameAudio.configure(save.settings.sound, save.settings.bgm); saveNow(); render(); }
  else if (action === 'bgm') { save.settings.bgm = !save.settings.bgm; gameAudio.configure(save.settings.sound, save.settings.bgm); saveNow(); render(); }
  else if (action === 'export') exportSave();
});
render();
