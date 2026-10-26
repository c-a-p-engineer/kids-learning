#!/usr/bin/env node
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Transpile each dependency to a temporary ESM module: no extra runtime or test framework.
const temp = mkdtempSync(join(tmpdir(), 'kids-learning-test-'));
for (const moduleName of ['engine', 'activity-content', 'activity-ui', 'progression', 'progress-ui', 'touch-content', 'touch-ui', 'storage', 'trace-guides']) {
  const source = readFileSync(new URL('../src/' + moduleName + '.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext }
  }).outputText.replace(/from '\.\/(activity-content|engine|progression|touch-content|trace-guides)'/g, "from './$1.mjs'");
  writeFileSync(join(temp, moduleName + '.mjs'), js);
}
const engine = await import(pathToFileURL(join(temp, 'engine.mjs')).href);
const activity = await import(pathToFileURL(join(temp, 'activity-content.mjs')).href);
const activityUi = await import(pathToFileURL(join(temp, 'activity-ui.mjs')).href);
const progress = await import(pathToFileURL(join(temp, 'progression.mjs')).href);
const progressUi = await import(pathToFileURL(join(temp, 'progress-ui.mjs')).href);
const touch = await import(pathToFileURL(join(temp, 'touch-content.mjs')).href);
const touchUi = await import(pathToFileURL(join(temp, 'touch-ui.mjs')).href);
const storage = await import(pathToFileURL(join(temp, 'storage.mjs')).href);
const now = Date.UTC(2026, 9, 26);

assert.equal(engine.GAMES.length, 23);
// Audio settings are stored in the existing V2 profile object, never legacy keys.
const defaults = engine.freshSave();
assert.equal(defaults.schema, 2);
assert.equal(defaults.settings.bgm, true);
assert.equal(defaults.settings.sound, true);
assert.equal(defaults.settings.bgmVolume, 75);
assert.equal(defaults.settings.seVolume, 65);

assert.equal(defaults.settings.textSize, 100);
assert.equal(engine.clampTextSize(80), 80);
assert.equal(engine.clampTextSize(100), 100);
assert.equal(engine.clampTextSize(160), 160);
assert.equal(engine.clampTextSize(135), 140);
assert.equal(engine.clampTextSize(79), 80);
assert.equal(engine.clampTextSize(170), 160);
assert.equal(engine.clampTextSize('120'), 100);
assert.equal(engine.clampTextSize(Number.NaN), 100);
assert.equal(engine.clampTextSize(Infinity), 100);

assert.equal(engine.clampVolume(43.9, 75), 44);
assert.equal(engine.clampVolume(120, 75), 100);
assert.equal(engine.clampVolume(-20, 65), 0);
assert.equal(engine.clampVolume(Number.NaN, 65), 65);
assert.equal(engine.clampVolume('50', 75), 75);

assert.equal(new Set(engine.GAMES.map(g => g.id)).size, 23);
const memoryTargets = new Set();
for (const game of engine.GAMES) {
  for (let i = 0; i < 80; i++) {
    const q = engine.makeQuestion(game.id, i);
    assert.equal(q.gameId, game.id);
    assert(q.prompt.length > 0);
    assert(q.explanation.length > 0);
    assert(q.choices.length >= 2);
    assert.equal(new Set(q.choices).size, q.choices.length);
    assert(q.choices.includes(q.answer), q.id + ': correct answer must be present');
    assert.equal(engine.evaluate(q, q.answer), true);
    for (const wrong of q.choices.filter(x => x !== q.answer)) assert.equal(engine.evaluate(q, wrong), false);
    if (game.id === 'add' || game.id === 'subtract' || game.id === 'count') {
      const a = q.visual.a, b = q.visual.b ?? 0, correct = Number(q.answer);
      assert(correct >= 0 && correct <= 10, q.id);
      if (game.id === 'add') assert.equal(a + b, correct);
      if (game.id === 'subtract') assert.equal(a - b, correct);
      if (game.id === 'count') assert.equal(a, correct);
    }
    if (game.id === 'sequence') {
      const ns = q.visual.numbers;
      assert.equal(ns[2], -1);
      assert.equal(ns[0] + q.visual.step * 2, Number(q.answer));
    }
    if (game.id === 'memory') { assert(q.visual.preview.includes(q.answer)); memoryTargets.add(q.visual.preview.indexOf(q.answer)); }
    if (game.id === 'clock') {
      assert(q.visual.hour >= 1 && q.visual.hour <= 12);
      assert([0, 30].includes(q.visual.minute));
    }
    if (game.id === 'bond') {
      assert(q.visual.a >= 0 && q.visual.a <= 10);
      assert.equal(q.visual.a + Number(q.answer), 10);
    }
    if (game.id === 'pattern') {
      const prefix = q.visual.preview;
      assert(prefix.length >= 3 && prefix.length <= 4);
      assert.equal(q.answer, prefix[prefix.length - 2]);
    }
    if (game.id === 'category') assert(['どうぶつ','のりもの','たべもの','しぜん'].includes(q.answer));
    if (game.id === 'odd') {
      assert.equal(q.choices.length, 4);
      assert.equal(q.visual.preview.length, 4);
      assert.equal(q.visual.answerIndex + 1, Number(q.answer));
      assert.equal(q.visual.preview.filter((x) => x !== q.visual.preview[q.visual.answerIndex]).length, 3);
    }
    if (game.id === 'colors') {
      assert(/^#[0-9a-f]{6}$/i.test(q.visual.symbol));
      assert(['あか','あお','きいろ','みどり','むらさき','オレンジ'].includes(q.answer));
    }
  }
  const fresh = engine.freshSave();
  const round = engine.chooseRound(game.id, fresh, now);
  assert.equal(round.length, 5, game.id + ': five-question round');
  assert.equal(new Set(round.map(q => q.id)).size, 5);
  const q = round[0];
  const first = engine.nextReview(undefined, q, true, now);
  assert.equal(first.stage, 0);
  assert.equal(first.dueAt, now + 86400000);
  const second = engine.nextReview(first, q, true, first.dueAt);
  assert.equal(second.stage, 1);
  assert.equal(second.dueAt, first.dueAt + 3 * 86400000);
  const third = engine.nextReview(second, q, true, second.dueAt);
  assert.equal(third.stage, 2);
  const fourth = engine.nextReview(third, q, true, third.dueAt);
  assert.equal(fourth.stage, 3);
  assert.equal(engine.nextReview(fourth, q, true, fourth.dueAt).stage, 3);
  const reset = engine.nextReview(fourth, q, false, fourth.dueAt);
  assert.equal(reset.stage, 0);
  fresh.reviews[q.id] = first;
  fresh.completed[game.id] = 1;
  assert.equal(engine.countDue(game.id, fresh, now), 0);
  assert.equal(engine.countDue(game.id, fresh, first.dueAt), 1);
  const withDue = engine.chooseRound(game.id, fresh, first.dueAt);
  assert.equal(withDue[0].id, q.id);
  assert.equal(new Set(withDue.map(x => x.id)).size, 5);
}
assert.deepEqual([...memoryTargets].sort(), [0, 1, 2]);

assert.equal(engine.MAX_LEVEL, 5);
assert.equal(engine.CLEARS_PER_LEVEL, 2);
for (let c = 0; c <= 15; c++) {
  const expected = Math.min(5, 1 + Math.floor(c / 2));
  assert.equal(engine.unlockedLevel(c), expected);
  const p = engine.progressFor(c);
  assert.equal(p.level, expected);
  assert.equal(p.target, 2);
  if (!p.maxed) assert.equal(p.current, c % 2);
}
// All 23 games must generate five distinct items with a correct option at levels 2–5.
let advancedQuestions = 0;
for (const game of engine.GAMES) {
  for (let level = 2; level <= 5; level++) {
    for (let i = 0; i < 80; i++) {
      const q = engine.makeQuestion(game.id, i, level);
      advancedQuestions++;
      assert.equal(q.id, game.id + ':L' + level + ':' + i);
      assert(q.choices.includes(q.answer), q.id + ': answer missing');
      assert.equal(q.choices.length, new Set(q.choices).size, q.id + ': duplicate options');
      if (['add','subtract','count','bond'].includes(game.id)) {
        const a = q.visual.a, b = q.visual.b || 0;
        const correct = Number(q.answer);
        assert(correct >= 0 && correct <= 20);
        if (game.id === 'add') assert.equal(a + b, correct);
        if (game.id === 'subtract') assert.equal(a - b, correct);
        if (game.id === 'count') assert.equal(a, correct);
        if (game.id === 'bond') assert.equal(a + correct, b);
      }
      if (game.id === 'sequence') {
        assert.equal(q.visual.numbers[0] + q.visual.step * 2, Number(q.answer));
      }
      if (game.id === 'clock') assert([0,5,10,15,20,25,30,35,40,45,50,55].includes(q.visual.minute));
      if (game.id === 'memory') assert(q.visual.preview.includes(q.answer));
      if (game.id === 'pattern') {
        const xs = q.visual.preview;
        const period = level >= 4 ? 3 : 2;
        assert.equal(q.answer, xs[(xs.length) % period]);
      }
      if (game.id === 'odd') assert.equal(q.visual.preview.length, level === 5 ? 6 : level >= 4 ? 5 : 4);
      if (game.id === 'clock' && level === 4) assert.equal(q.visual.minute % 15, 0);
      if (game.id === 'colors' && level === 5) assert.equal(q.choices.length, 6);
    }
    const save = engine.freshSave();
    save.completed[game.id] = (level - 1) * 2;
    assert.equal(engine.unlockedLevel(save.completed[game.id]), level);
    const round = engine.chooseRound(game.id, save, now, 5, level);
    assert.equal(round.length, 5);
    assert.equal(round.length, new Set(round.map(q => q.id)).size);
    assert(round.every(q => q.id.includes(':L' + level + ':')));
  }
}
console.log('PASS: advanced levels ' + advancedQuestions + ' questions and earned unlock gates');

console.log('PASS: 23 games × 80 cases, answer validity, arithmetic, finite rounds, recall scheduler');

/** Non-choice input regression tests: do not fall back to 3 answer buttons. */
for (const gameId of ['trace', 'blocks', 'train', 'move']) {
  const q = engine.makeQuestion(gameId, 0);
  assert(activity.isActivity(gameId));
  const state = activityUi.newActivityState(q);
  assert(activityUi.activityHtml(q, state).includes('class="interactive'));
  assert(!activityUi.activityHtml(q, state).includes('data-answer'));
}
for (let lv = 1; lv <= 5; lv++) {
  for (let i = 0; i < 30; i++) {
    const train = engine.makeQuestion('train', i, lv);
    assert.equal((train.visual.preview || []).length, Array.from(train.answer).length);
    assert.notDeepEqual(train.visual.preview, Array.from(train.answer), 'train starts preassembled');
    const trainState = activityUi.newActivityState(train);
    const tiles = train.visual.preview || [];
    let result;
    for (const glyph of Array.from(train.answer)) {
      const index = tiles.findIndex((tile, j) => tile === glyph && !trainState.usedTiles.includes(j));
      assert(index !== -1, 'train must include every target glyph');
      result = activityUi.activityClick(train, trainState, 'train-tile', index);
    }
    assert.equal(result.kind, 'submit');
    assert.equal(result.value, train.answer);
    const block = engine.makeQuestion('blocks', i, lv);
    const blockState = activityUi.newActivityState(block);
    const target = Number(block.answer);
    while (blockState.count + 5 <= target) {
      result = activityUi.activityClick(block, blockState, 'block-five', -1);
    }
    while (blockState.count < target) {
      result = activityUi.activityClick(block, blockState, 'block-one', -1);
    }
    assert.equal(result.kind, 'submit');
    assert.equal(result.value, block.answer);
    assert.equal(blockState.count, target);
  }
}
const blockQ = engine.makeQuestion('blocks', 0);
const blockState = activityUi.newActivityState(blockQ);
const overshoot = activityUi.activityClick(blockQ, blockState, 'block-five', -1);
assert.equal(overshoot.kind, 'submit'); // target 5; the factory can finish with one group.
assert.equal(blockState.count, 5);
const noExtra = activityUi.activityClick(blockQ, blockState, 'block-five', -1);
assert.equal(noExtra.kind, 'progress'); // cannot earn another answer by tapping more
assert.equal(blockState.count, 5);
// Both line warmups and hiragana show exact stroke count and advance in stroke order.
for (const gameId of ['lines', 'trace']) {
  for (let i = 0; i < 40; i++) {
    const q = engine.makeQuestion(gameId, i);
    const guide = activity.TRACE_GUIDES[q.answer];
    assert(guide?.strokes.length >= 1);
    const state = activityUi.newActivityState(q);
    let last;
    for (const stroke of guide.strokes) {
      for (let index = 0; index < stroke.length; index++) {
        last = activityUi.activityClick(q, state, 'trace-point', index);
      }
    }
    assert.equal(last.kind, 'submit', q.id);
    assert.equal(last.assisted, true);
  }
}
const noGuide = activity.TRACE_GUIDES['の'];
assert.equal(noGuide.strokes.length, 1, 'の is written in a single continuous stroke');
assert(noGuide.strokes[0].length >= 12);
const twoStroke = activity.TRACE_GUIDES['こ'];
assert.equal(twoStroke.strokes.length, 2, 'こ requires two distinct strokes');
const curveQuestion = engine.makeQuestion('lines', 2);
const curveGuide = activity.TRACE_GUIDES[curveQuestion.answer];
const curveState = activityUi.newActivityState(curveQuestion);
const pathPoints = curveGuide.strokes[0];
let geomResult = activityUi.traceSample(curveQuestion, curveState, 'down', pathPoints[0]);
for (let j = 1; j < pathPoints.length; j++) {
  geomResult = activityUi.traceSample(curveQuestion, curveState,
    j === pathPoints.length - 1 ? 'up' : 'move', pathPoints[j]);
}
assert.equal(geomResult.kind, 'submit', 'following guide corridor should complete the line');
const offState = activityUi.newActivityState(curveQuestion);
activityUi.traceSample(curveQuestion, offState, 'down', pathPoints[0]);
const reject = activityUi.traceSample(curveQuestion, offState, 'move', [0, 0]);
assert.equal(reject.kind, 'progress');
assert.equal(reject.refresh, true, 'leaving the corridor must immediately reset the stroke');
assert.equal(offState.traceIndex, 0);
assert.equal(offState.waypointIndex, 0);
assert.equal(offState.drawing, false);
const moveQ = engine.makeQuestion('move', 0);
const moveResult = activityUi.activityClick(moveQ, activityUi.newActivityState(moveQ), 'move-done', -1);
assert.equal(moveResult.kind, 'submit');
assert.equal(moveResult.assisted, true);
const restResult = activityUi.activityClick(moveQ, activityUi.newActivityState(moveQ), 'move-skip', -1);
assert.equal(restResult.kind, 'submit');
assert.equal(restResult.skipped, true);
console.log('PASS: stroke-aware tracing and warmup, number block input, letter construction, seated movement and rest');


// V2.6 daily records never retroactively fabricate dates for an old V2.5 save.
const legacySave = engine.freshSave();
delete legacySave.daily;
const migrated = progress.readDaily(legacySave.daily);
assert.deepEqual({ ...migrated }, {});
const personOne = engine.freshSave(), personTwo = engine.freshSave();
const localDay = new Date(2026, 9, 26, 23, 50);
assert.equal(progress.dayKey(localDay), '2026-10-26');
assert.equal(progress.dayKey(new Date(2026, 9, 27, 0, 5)), '2026-10-27');
progress.recordDaily(personOne, localDay, 'add', 'mistake');
progress.recordDaily(personOne, localDay, 'add', 'supported', 5);
progress.recordDaily(personOne, localDay, 'train', 'independent', 10);
progress.recordDaily(personOne, localDay, 'trace', 'practice', 5);
progress.recordDaily(personOne, localDay, 'move', 'rest');
progress.recordDaily(personOne, localDay, 'train', 'clear');
const day = personOne.daily['2026-10-26'];
assert.equal(day.answered, 4);
assert.equal(day.independent, 1);
assert.equal(day.supported, 1);
assert.equal(day.practiced, 1);
assert.equal(day.rested, 1);
assert.equal(day.mistakes, 1);
assert.equal(day.xp, 20);
assert.equal(day.clears, 1);
assert.equal(day.games.train, 1);
assert.equal(personTwo.daily['2026-10-26'], undefined, 'profiles must not leak activity');
const roundTrip = progress.readDaily(JSON.parse(JSON.stringify(personOne.daily)));
assert.deepEqual(roundTrip['2026-10-26'], day);
assert.deepEqual({ ...progress.readDaily({ '2026-02-30': { answered: 9 } }) }, {});
const poisoned = progress.readDaily({
  '2026-10-26': { answered: 'hacked', independent: -5, xp: Infinity, clears: 2.2,
    games: { add: 3, hiddenGame: 5000 } }
});
assert.equal(poisoned['2026-10-26'].answered, 0);
assert.equal(poisoned['2026-10-26'].independent, 0);
assert.equal(poisoned['2026-10-26'].xp, 0);
assert.equal(poisoned['2026-10-26'].clears, 0);
assert.equal(poisoned['2026-10-26'].games.hiddenGame, undefined);
assert.equal(progress.recentDays(personOne.daily, new Date(2026, 9, 26), 14).length, 14);
const last7 = progress.recentSummary(personOne.daily, new Date(2026, 9, 26));
assert.equal(last7.questions, 4);
assert.equal(last7.xp, 20);
assert.equal(last7.days, 1);
assert.equal(progress.skillSummary(personOne).total, engine.GAMES.length * engine.MAX_LEVEL);
personOne.completed['add'] = 3; // Level 2, 1/2 until next unlock
assert.equal(progress.skillNodes('add', personOne.completed)[0].opened, true);
assert.equal(progress.skillNodes('add', personOne.completed)[1].opened, true);
assert.equal(progress.skillNodes('add', personOne.completed)[2].opened, false);
assert.equal(progress.skillNodes('add', personOne.completed)[2].requiredClears, 4);
const renderedStatus = progressUi.statusHtml(personOne, 'きつね', new Date(2026, 9, 26));
assert(renderedStatus.includes('まいにちの きろく'));
assert(renderedStatus.includes('2026/10/26'));
const renderedSkills = progressUi.skillTreeHtml(personOne, 'きつね', 'math');
assert(renderedSkills.includes('たしざんロケット'));
assert(!renderedSkills.includes('ことばトレジャー'));
assert(renderedSkills.includes('LV5'));
assert(renderedSkills.includes('つぎの レベルまで'));
assert(renderedSkills.includes('data-skill-play="add" data-level="1"'), 'unlocked level must be playable');
assert(renderedSkills.includes('data-skill-play="add" data-level="2"'), 'second level must be playable');
assert(!renderedSkills.includes('data-skill-play="add" data-level="3"'), 'locked level must remain inaccessible');
assert(renderedSkills.includes('skill-node locked'), 'locked branches must stay visibly locked');
assert(!renderedSkills.includes('data-skill-play="words"'), 'category filter must hide unrelated games');
console.log('PASS: V2.6 per-profile calendar records, migrations, stats charts and unlock-based skill tree');


// Direct number-tap comparison: answer is the winning side; always two distinct numbers.
for (let level = 1; level <= 5; level++) for (let i = 0; i < 80; i++) {
  const q = engine.makeQuestion('compare', i, level);
  assert.notEqual(q.visual.a, q.visual.b);
  assert.equal(q.answer, q.visual.a > q.visual.b ? 'ひだり' : 'みぎ');
  assert.deepEqual(q.choices, ['ひだり', 'みぎ']);
  assert(engine.evaluate(q, q.answer));
}
for (let level = 1; level <= 5; level++) for (let i = 0; i < 80; i++) {
  const link = engine.makeQuestion('connect', i, level);
  const state = touchUi.freshTouch();
  let last;
  for (let n = 1; n <= link.visual.a; n++) last = touchUi.touchClick(link, state, 'connect', n);
  assert.equal(last.finished, true);
  assert.equal(last.value, link.answer);
  const maze = engine.makeQuestion('maze', i, level);
  const path = maze.visual.numbers;
  const size = maze.visual.a;
  assert(new Set(path).size === path.length);
  for (let step = 1; step < path.length; step++) {
    const a = path[step - 1], b = path[step];
    assert.equal(Math.abs(Math.floor(a / size) - Math.floor(b / size)) +
      Math.abs(a % size - b % size), 1, maze.id + ': unreachable');
  }
  const mazeState = touchUi.freshTouch();
  let finished;
  for (let n = 1; n < path.length; n++) finished = touchUi.touchClick(maze, mazeState, 'maze', path[n]);
  assert.equal(finished.finished, true, maze.id);
  const time = engine.makeQuestion('clockhands', i, level);
  const clock = touchUi.freshTouch();
  while (clock.hour !== time.visual.hour) touchUi.touchClick(time, clock, 'hour-plus');
  while (clock.minute !== time.visual.minute) touchUi.touchClick(time, clock, 'minute-plus');
  const checked = touchUi.touchClick(time, clock, 'clock-check');
  assert.equal(checked.finished, true);
}
const saved = engine.freshSave();
saved.xp = 123; saved.completed.add = 5;
const memory = new Map();
const store = { getItem: key => memory.get(key) ?? null, setItem: (key, val) => memory.set(key, val) };
storage.persistSlot(store, 2, saved);
assert.equal(storage.loadSlot(store, 2).xp, 123);
assert.equal(storage.loadSlot(store, 1).xp, 0);
const payload = storage.backupText(2, saved);
const read = storage.parseBackup(payload, 2);
assert.equal(read.data.xp, 123);
assert.equal(storage.backupDelta(engine.freshSave(), read.data).xp[1], 123);
assert.throws(() => storage.parseBackup(payload, 1));
assert.throws(() => storage.parseBackup('oops', 2));
assert.throws(() => storage.parseBackup('x'.repeat(4 * 1024 * 1024), 2));
assert.throws(() => storage.parseBackup(JSON.stringify({ exportedAt: '2026-10-26T00:00:00Z', slot: 2, data: { schema: 1 } }), 2));
const blocked = { setItem: () => { throw new Error('QuotaExceededError'); } };
assert.throws(() => storage.persistSlot(blocked, 2, saved));
assert.equal(storage.loadSlot(store, 2).xp, 123, 'failed write must not overwrite existing save');
const sanitized = storage.normalizeSave({ ...saved, xp: 'not a number', daily: { '2026-10-26': { answered: 3 } } });
assert.equal(sanitized.xp, 0);
assert.equal(sanitized.daily['2026-10-26'].answered, 3);
console.log('PASS: direct comparison, 3 tap-only activities, 1200 new input simulations, safe per-profile backups');

rmSync(temp, { recursive: true, force: true });

