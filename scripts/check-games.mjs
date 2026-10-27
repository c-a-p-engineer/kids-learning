#!/usr/bin/env node
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Transpile each dependency to a temporary ESM module: no extra runtime or test framework.
const temp = mkdtempSync(join(tmpdir(), 'kids-learning-test-'));
for (const moduleName of ['engine', 'activity-content', 'activity-ui', 'progression', 'progress-ui', 'touch-content', 'touch-ui', 'storage', 'trace-guides', 'session', 'workshop-content', 'workshop-ui', 'growth-world', 'parent-report', 'learning-commit', 'haptics', 'question-visuals', 'question-hints']) {
  const source = readFileSync(new URL('../src/' + moduleName + '.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext }
  }).outputText.replace(/from '\.\/(activity-content|engine|progression|touch-content|trace-guides|workshop-content)'/g, "from './$1.mjs'");
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
const session = await import(pathToFileURL(join(temp, 'session.mjs')).href);
const workshop = await import(pathToFileURL(join(temp, 'workshop-content.mjs')).href);
const workshopUi = await import(pathToFileURL(join(temp, 'workshop-ui.mjs')).href);
const world = await import(pathToFileURL(join(temp, 'growth-world.mjs')).href);
const reporting = await import(pathToFileURL(join(temp, 'parent-report.mjs')).href);
const commit = await import(pathToFileURL(join(temp, 'learning-commit.mjs')).href);
const haptics = await import(pathToFileURL(join(temp, 'haptics.mjs')).href);
const visuals = await import(pathToFileURL(join(temp, 'question-visuals.mjs')).href);
const hints = await import(pathToFileURL(join(temp, 'question-hints.mjs')).href);
const now = Date.UTC(2026, 9, 26);

assert.equal(engine.GAMES.length, 28);
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

assert.equal(new Set(engine.GAMES.map(g => g.id)).size, 28);
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
// All 28 games must generate five distinct items with a correct option at levels 2–5.
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
      if (game.id === 'colors' && level === 5) assert.equal(q.choices.length, 4);
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

console.log('PASS: 28 games × 80 cases, answer validity, arithmetic, finite rounds, recall scheduler');

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
    assert(!activityUi.activityHtml(q, state).includes('trace-point'),
      'tracing must not offer a tap-through shortcut');
    assert.equal(activityUi.activityClick(q, state, 'trace-point', 0).kind, 'progress');
    let last;
    for (const stroke of guide.strokes) {
      for (let index = 0; index < stroke.length; index++) {
        last = activityUi.traceSample(q, state,
          index === 0 ? 'down' : index === stroke.length - 1 ? 'up' : 'move', stroke[index]);
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

const koQ = engine.makeQuestion('trace', 4);
assert.equal(koQ.answer, 'こ');
const koState = activityUi.newActivityState(koQ);
for (let strokeIndex = 0; strokeIndex < 2; strokeIndex++) {
  const points = activity.TRACE_GUIDES['こ'].strokes[strokeIndex];
  if (strokeIndex === 1) {
    activityUi.traceSample(koQ, koState, 'down', points[0]);
    const off = activityUi.traceSample(koQ, koState, 'move', [0, 0]);
    assert.equal(off.refresh, true);
    assert.equal(koState.traceIndex, 1, 'second-stroke mistakes must preserve the first stroke');
    assert.equal(koState.strokes.length, 1, 'completed first stroke remains visible');
  }
  let part;
  for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
    part = activityUi.traceSample(koQ, koState,
      pointIndex === 0 ? 'down' : pointIndex === points.length - 1 ? 'up' : 'move',
      points[pointIndex]);
  }
  if (strokeIndex === 0) assert.equal(koState.traceIndex, 1);
  else assert.equal(part.kind, 'submit');
}
const outsideStart = activityUi.newActivityState(koQ);
const startResult = activityUi.traceSample(koQ, outsideStart, 'down', [0,0]);
assert.equal(startResult.refresh, true);
assert.equal(outsideStart.drawing, false);

const moveQ = engine.makeQuestion('move', 0);
const moveResult = activityUi.activityClick(moveQ, activityUi.newActivityState(moveQ), 'move-done', -1);
assert.equal(moveResult.kind, 'submit');
assert.equal(moveResult.assisted, true);
const restResult = activityUi.activityClick(moveQ, activityUi.newActivityState(moveQ), 'move-skip', -1);
assert.equal(restResult.kind, 'submit');
assert.equal(restResult.skipped, true);

const blockRepairQ = engine.makeQuestion('blocks', 0, 1);
const blockRepair = activityUi.newActivityState(blockRepairQ);
activityUi.activityClick(blockRepairQ, blockRepair, 'block-one', -1);
assert(activityUi.activityHtml(blockRepairQ, blockRepair).includes('build-tap-back'));
activityUi.activityClick(blockRepairQ, blockRepair, 'block-back', -1);
assert.equal(blockRepair.count, 0);
assert(!activityUi.activityHtml(blockRepairQ, blockRepair).includes('1こ もどす</button>'));
const trainRepairQ = engine.makeQuestion('train', 0, 1);
const trainRepair = activityUi.newActivityState(trainRepairQ);
activityUi.activityClick(trainRepairQ, trainRepair, 'train-tile', 0);
activityUi.activityClick(trainRepairQ, trainRepair, 'train-tile', 1);
assert(activityUi.activityHtml(trainRepairQ, trainRepair).includes('data-activity="train-remove"'));
activityUi.activityClick(trainRepairQ, trainRepair, 'train-remove', 0);
assert.deepEqual(trainRepair.usedTiles, [1]);
assert(!activityUi.activityHtml(trainRepairQ, trainRepair).includes('ひとつ もどす'));
assert(visuals.dots(11).includes('dot-pack'));
assert(visuals.visualHtml({ kind: 'clock', hour: 7, minute: 30 }, false).includes('viewBox="0 0 200 200"'));
assert(hints.makeHint(engine.makeQuestion('maze', 0, 1)).includes('でんしゃ'));
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
const progressCss = readFileSync(new URL('../src/progress.css', import.meta.url), 'utf8');
assert(progressCss.includes('.progress-tabs button'), 'status/skills tab selector must match HTML');
assert(!progressCss.includes('.growth-tabs button'), 'obsolete tab selector would leave native buttons');
const renderedStatus = progressUi.statusHtml(personOne, 'きつね', new Date(2026, 9, 26));
assert(renderedStatus.includes('7にちの ぼうけん'));
assert(renderedStatus.includes('2026/10/26'));
assert(renderedStatus.includes('daily-record-list'));
assert(!renderedStatus.includes('daily-table'), 'status history should use narrow-screen cards');
assert.equal((renderedStatus.match(/class="history-day/g) || []).length, 7);
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
// Both paths must be traced with one continuous gesture, not solved by tapping tiles.
for (let level = 1; level <= 5; level++) for (let i = 0; i < 80; i++) {
  for (const gameId of ['connect', 'maze']) {
    const q = engine.makeQuestion(gameId, i, level), pts = touchUi.routePoints(q);
    const state = touchUi.freshTouch();
    assert(touchUi.touchHtml(q, state, false).includes('data-touch-trace'));
    assert(!touchUi.touchHtml(q, state, false).includes('data-touch="connect"'));
    assert(pts.length >= 3);
    if (gameId === 'maze') {
      const cells = q.visual.numbers, size = q.visual.a;
      assert(new Set(cells).size === cells.length);
      for (let step = 1; step < cells.length; step++) {
        const prev = cells[step - 1], next = cells[step];
        assert.equal(Math.abs(Math.floor(prev / size) - Math.floor(next / size)) +
          Math.abs(prev % size - next % size), 1, q.id + ': disconnected route');
      }
    }
    if (gameId === 'maze') {
      const edges = touchUi.mazeEdges(q), path = q.visual.numbers;
      assert(edges.length > path.length - 1, q.id + ': must have a wrong turn');
      const routeSet = new Set(path);
      const offRoute = edges.filter(([a,b]) => !routeSet.has(a) || !routeSet.has(b));
      assert(offRoute.length >= 1, q.id + ': no branch from solution');
      for (let n = 1; n < path.length; n++)
        assert(edges.some(([a,b]) => a === path[n-1] && b === path[n] ||
          a === path[n] && b === path[n-1]), q.id + ': solution edge missing');
      const markup = touchUi.touchHtml(q, state, false);
      assert(markup.includes('maze-board'), 'maze board must be distinct from guide tracing');
      assert(!markup.includes('points="' + pts.map(p => p.map(x => x.toFixed(1)).join(',')).join(' ') + '"'),
        'maze must not draw solution polyline');
    }
    touchUi.traceRouteSample(q, state, 'down', pts[0]);
    for (let j = 1; j < pts.length; j++) touchUi.traceRouteSample(q, state, 'move', pts[j]);
    const completed = touchUi.traceRouteSample(q, state, 'up', pts[pts.length - 1]);
    assert.equal(completed.finished, true, q.id + ': trace failed');
    assert.equal(completed.value, q.answer);
    assert.equal(completed.practice, true);
    const out = touchUi.freshTouch();
    touchUi.traceRouteSample(q, out, 'down', pts[0]);
    const escaped = touchUi.traceRouteSample(q, out, 'move', [0, 0]);
    assert.equal(escaped.finished, false);
    assert.equal(out.drawing, false, 'going off the route must reset without a penalty');
    // Buttons cannot bypass tracing or silently finish the route.
    assert(!touchUi.touchHtml(q, state, false).includes('path-step'));
    const bypass = touchUi.freshTouch();
    assert.equal(touchUi.touchClick(q, bypass, 'path-step').finished, false);
    assert.equal(bypass.done.length, 0);
  }
  const q = engine.makeQuestion('clockhands', i, level);
  const clock = touchUi.freshTouch();
  assert(touchUi.touchHtml(q, clock, false).includes('data-clock-hand="minute"'));
  assert(touchUi.touchHtml(q, clock, false).includes('data-clock-hand="hour"'));
  const handsMarkup = touchUi.touchHtml(q, clock, false);
  assert(handsMarkup.indexOf('data-clock-hand="minute"') < handsMarkup.indexOf('data-clock-hand="hour"'),
    'short hand must render on top so both hands remain grabbable at 12:00');
  // Set minutes, then the hour hand including its minute-dependent fractional angle.
  const tip = (degrees, length) => [
    100 + Math.sin(degrees * Math.PI / 180) * length,
    100 - Math.cos(degrees * Math.PI / 180) * length
  ];
  touchUi.rotateClockHand(q, clock, 'minute', tip(q.visual.minute * 6, 70));
  const hourAngle = ((q.visual.hour % 12) + q.visual.minute / 60) * 30;
  touchUi.rotateClockHand(q, clock, 'hour', tip(hourAngle, 47));
  assert.equal(clock.hour, q.visual.hour, q.id + ': hour drag snap');
  assert.equal(clock.minute, q.visual.minute, q.id + ': minute drag snap');
  const checked = touchUi.touchClick(q, clock, 'clock-check');
  assert.equal(checked.finished, true);
  const fallback = touchUi.freshTouch();
  while (fallback.hour !== q.visual.hour) touchUi.touchClick(q, fallback, 'hour-plus');
  while (fallback.minute !== q.visual.minute) touchUi.touchClick(q, fallback, 'minute-plus');
  assert.equal(touchUi.touchClick(q, fallback, 'clock-check').finished, true);
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
assert.throws(() => storage.parseBackup(JSON.stringify({ exportedAt: '2026-10-26T00:00:00Z', slot: 2, data: { schema: 2 } }), 2));
const blocked = { setItem: () => { throw new Error('QuotaExceededError'); } };
assert.throws(() => storage.persistSlot(blocked, 2, saved));
assert.equal(storage.loadSlot(store, 2).xp, 123, 'failed write must not overwrite existing save');
const rawFirst = storage.readSlotSnapshot(store, 2);
const nextSaved = { ...saved, xp: 144 };
const rawSecond = storage.persistSlotIfUnchanged(store, 2, nextSaved, rawFirst);
assert.equal(storage.loadSlot(store, 2).xp, 144);
assert.equal(rawSecond, storage.readSlotSnapshot(store, 2));
assert.throws(() => storage.persistSlotIfUnchanged(store, 2, { ...saved, xp: 999 }, rawFirst),
  storage.StaleSlotError, 'stale tab must not overwrite another tab');
assert.equal(storage.loadSlot(store, 2).xp, 144);
const otherSlotBefore = storage.readSlotSnapshot(store, 1);
storage.persistSlotIfUnchanged(store, 1, { ...saved, xp: 77 }, otherSlotBefore);
assert.equal(storage.loadSlot(store, 1).xp, 77);
assert.equal(storage.loadSlot(store, 2).xp, 144, 'one character must not overwrite another');
const noCapacity = { getItem: key => store.getItem(key), setItem: () => { throw Error('QuotaExceededError'); } };
assert.throws(() => storage.persistSlotIfUnchanged(noCapacity, 2, nextSaved, rawSecond));
assert.equal(storage.loadSlot(store, 2).xp, 144);

const lockQueue = new Map();
const testLocks = {
  request(name, _options, fn) {
    const previous = lockQueue.get(name) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(() => fn());
    lockQueue.set(name, current);
    return current;
  }
};
const baseSnapshot = storage.readSlotSnapshot(store, 2);
const simultaneous = await Promise.allSettled([
  storage.lockedSlotWrite(store, 2, { ...saved, xp: 151 }, baseSnapshot, testLocks),
  storage.lockedSlotWrite(store, 2, { ...saved, xp: 152 }, baseSnapshot, testLocks)
]);
assert.deepEqual(simultaneous.map(x => x.status), ['fulfilled', 'rejected']);
assert(simultaneous[1].reason instanceof storage.StaleSlotError);
assert.equal(storage.loadSlot(store, 2).xp, 151);
await assert.rejects(storage.lockedSlotWrite(store, 2, { ...saved, xp: 999 },
  storage.readSlotSnapshot(store, 2), undefined), /Web Locks unavailable/);
assert.equal(storage.loadSlot(store, 2).xp, 151, 'no locks must fail closed');
console.log('PASS: browser lock serialization, race protection and unsupported lock fail-closed');

const sanitized = storage.normalizeSave({ ...saved, xp: 'not a number', daily: { '2026-10-26': { answered: 3 } } });
assert.equal(sanitized.xp, 0);
assert.equal(sanitized.daily['2026-10-26'].answered, 3);

// A wrong turn can be traversed and backed out of without losing the gesture.
const branching = engine.makeQuestion('maze', 0, 4);
const branchingPath = branching.visual.numbers, branches = touchUi.mazeEdges(branching);
const branchEdge = branches.find(([a,b]) => !branchingPath.includes(a) || !branchingPath.includes(b));
assert(branchEdge, 'branching fixture must contain a dead-end');
const side = branchingPath.includes(branchEdge[0]) ? branchEdge[1] : branchEdge[0];
const junction = branchingPath.includes(branchEdge[0]) ? branchEdge[0] : branchEdge[1];
const junctionIndex = branchingPath.indexOf(junction);
const branchingState = touchUi.freshTouch(), branchingPoints = touchUi.routePoints(branching);
const mazePoint = cell => [(cell % branching.visual.a + .5) * 300 / branching.visual.a,
  (Math.floor(cell / branching.visual.a) + .5) * 300 / branching.visual.a];
touchUi.traceRouteSample(branching, branchingState, 'down', branchingPoints[0]);
for (let n = 1; n <= junctionIndex; n++)
  touchUi.traceRouteSample(branching, branchingState, 'move', branchingPoints[n]);
touchUi.traceRouteSample(branching, branchingState, 'move', mazePoint(side));
assert.equal(branchingState.done.at(-1), side, 'wrong turn must be traversable');
touchUi.traceRouteSample(branching, branchingState, 'move', mazePoint(junction));
assert.equal(branchingState.done.at(-1), junction, 'backtracking restores the junction');
for (let n = junctionIndex + 1; n < branchingPath.length; n++)
  touchUi.traceRouteSample(branching, branchingState, 'move', branchingPoints[n]);
const mazeSuccess = touchUi.traceRouteSample(branching, branchingState, 'up', branchingPoints.at(-1));
assert.equal(mazeSuccess.finished, true, 'backtracking must allow completing the maze');
console.log('PASS: exploratory maze branches, hidden answers, finger backtracking');
console.log('PASS: direct comparisons, 800 continuous path traces, 400 hand rotations, keyboard alternatives, safe backups');


const deck = engine.chooseRound('add', engine.freshSave(), now, 5);
const first = session.createSession('add', 1, deck);
assert.equal(first.index, 0);
assert.equal(first.phase, 'answer');
assert.deepEqual(session.attemptOutcome(1, 0), { independent: true, earned: 10, kind: 'independent' });
assert.deepEqual(session.attemptOutcome(3, 1), { independent: false, earned: 5, kind: 'supported' });
assert.deepEqual(session.attemptOutcome(1, 0, 'practice'), { independent: false, earned: 5, kind: 'practice' });
assert.deepEqual(session.attemptOutcome(1, 0, 'skip'), { independent: false, earned: 0, kind: 'rest' });
assert.equal(session.advanceSession(first), first, 'must not advance unsolved questions');
const solved = { ...first, phase: 'solved', attempts: 3, hints: 2, feedback: 'ok' };
const advanced = session.advanceSession(solved);
assert.equal(advanced.index, 1);
assert.equal(advanced.phase, 'answer');
assert.equal(advanced.attempts, 0);
assert.equal(advanced.hints, 0);
assert.equal(solved.index, 0, 'advance must not mutate old session');


// Regression: 'もういちど' on the cleared result screen must load the freshly unlocked level.
// A manually selected lower-level quest must also continue at the newest unlocked level.
const pageCode = readFileSync(new URL('../src/quest-main.ts', import.meta.url), 'utf8');
assert(pageCode.includes("action === 'replay' && session) startGame(session.gameId);"),
  'replay must defer to startGame default (current unlocked level)');
assert(!pageCode.includes("startGame(session.gameId, session.level)"),
  'replay must not force the just-cleared old level');
assert(pageCode.includes('レベル ' + "' + progress.level + ' へ すすむ"),
  'result button must clearly indicate the new level');
for (const [clears, nextLevel] of [[0, 1], [1, 1], [2, 2], [3, 2],
  [4, 3], [5, 3], [6, 4], [7, 4], [8, 5], [25, 5]]) {
  assert.equal(engine.unlockedLevel(clears), nextLevel,
    'latest replay destination for ' + clears + ' clears');
}

const reviewNow = Date.UTC(2026, 9, 27, 11);
const revisionSave = engine.freshSave();
revisionSave.completed.add = 6;
for (let i = 0; i < 4; i++) {
  const q = engine.makeQuestion('add', i, 3);
  revisionSave.reviews[q.id] = {
    question: q, stage: 0, dueAt: reviewNow - 3600000 * (i + 1),
    lastAnsweredAt: reviewNow - 2 * 86400000, correct: false
  };
}
const suggestion = progress.reviewSuggestion(revisionSave, 'add', reviewNow);
assert.equal(suggestion.level, 3, 'gently suggest one lower unlocked level');
assert.equal(suggestion.hasStruggle, true);
assert.equal(suggestion.due, 4);
assert.equal(engine.unlockedLevel(revisionSave.completed.add), 4, 'unlocked level stays 4');
const recallRound = engine.chooseRound('add', revisionSave, reviewNow, 5, 4);
assert.equal(recallRound.length, 5);
assert.equal(recallRound.filter(q => revisionSave.reviews[q.id]).length, 3,
  'review backlog should use three of five questions');
assert(progressUi.skillTreeHtml(revisionSave, 'きつね', 'math').includes(
  'data-skill-play="add" data-level="3"'), 'optional easy-practice button accessible');
for (const r of Object.values(revisionSave.reviews)) r.correct = true;
assert.equal(progress.reviewSuggestion(revisionSave, 'add', reviewNow).hasStruggle, false,
  'independent recall clears the extra easy-practice suggestion');
const historical = revisionSave.reviews[Object.keys(revisionSave.reviews)[0]];
historical.lastAnsweredAt = reviewNow - 40 * 86400000;
assert.equal(progress.reviewSuggestion(engine.freshSave(), 'add', reviewNow).level, 1);
console.log('PASS: replay follows latest unlocked level after clearing 2/4/6/8 quests');

console.log('PASS: pure session transitions and scoring; old saves and recovery checks');


/** Direct hands-on interactions: every item requires actual input, not a free completion. */
for (let lv = 1; lv <= 5; lv++) for (let i = 0; i < 80; i++) {
  const shop = engine.makeQuestion('shop', i, lv), coins = workshopUi.freshWorkshop();
  assert(workshopUi.workshopHtml(shop, coins, false).includes('data-workshop="coin"'));
  let result;
  while (coins.coins.reduce((n, x) => n + x, 0) < Number(shop.answer)) {
    const left = Number(shop.answer) - coins.coins.reduce((n, x) => n + x, 0);
    result = workshopUi.workshopClick(shop, coins, 'coin', left >= 10 ? 10 : left >= 5 ? 5 : 1);
  }
  assert.equal(result.finished, true, shop.id);
  const routine = engine.makeQuestion('routine', i, lv), order = workshopUi.freshWorkshop();
  assert(routine.visual.preview?.length >= 3);
  for (const label of routine.answer.split('|')) {
    const index = routine.visual.preview.indexOf(label);
    assert(index >= 0);
    result = workshopUi.workshopClick(routine, order, 'routine', index);
  }
  assert.equal(result.finished, true, routine.id);
  const split = engine.makeQuestion('split', i, lv), baskets = workshopUi.freshWorkshop();
  for (let j = 0; j < split.visual.a; j++) result = workshopUi.workshopClick(split, baskets, 'left');
  for (let j = 0; j < split.visual.b; j++) result = workshopUi.workshopClick(split, baskets, 'right');
  assert.equal(result.finished, true, split.id);
  const beat = engine.makeQuestion('rhythm', i, lv), drums = workshopUi.freshWorkshop();
  for (const note of beat.visual.preview) result = workshopUi.workshopClick(beat, drums, 'beat', note === '🔵' ? 0 : 1);
  assert.equal(result.finished, true, beat.id);
}
// Tapping a placed coin removes that exact instance, even when values repeat.
const shopUndo = engine.makeQuestion('shop', 0, 3), shopUndoState = workshopUi.freshWorkshop();
workshopUi.workshopClick(shopUndo, shopUndoState, 'coin', 1);
workshopUi.workshopClick(shopUndo, shopUndoState, 'coin', 5);
workshopUi.workshopClick(shopUndo, shopUndoState, 'coin', 1);
assert.deepEqual(shopUndoState.coins, [1, 5, 1]);
assert(workshopUi.workshopHtml(shopUndo, shopUndoState, false).includes('data-workshop="remove-coin"'));
assert(!workshopUi.workshopHtml(shopUndo, shopUndoState, false).includes('1こ もどす'));
workshopUi.workshopClick(shopUndo, shopUndoState, 'remove-coin', 1);
assert.deepEqual(shopUndoState.coins, [1, 1], 'removes tapped middle coin, not the last');
workshopUi.workshopClick(shopUndo, shopUndoState, 'remove-coin', 99);
assert.deepEqual(shopUndoState.coins, [1, 1], 'invalid coin position is ignored');
const moneyHtml = workshopUi.workshopHtml(shopUndo, shopUndoState, false);
assert(moneyHtml.includes('aria-label="1えんを もどす"'), 'coin removal has accessible labels');

const routineEdit = engine.makeQuestion('routine', 0, 1), editableSteps = workshopUi.freshWorkshop();
assert(workshopUi.workshopHtml(routineEdit, editableSteps, false).includes('routine-options'));
workshopUi.workshopClick(routineEdit, editableSteps, 'routine', 0);
workshopUi.workshopClick(routineEdit, editableSteps, 'routine', 1);
assert(workshopUi.workshopHtml(routineEdit, editableSteps, false).includes('routine-remove'));
workshopUi.workshopClick(routineEdit, editableSteps, 'routine-remove', 0);
assert.deepEqual(editableSteps.sequence, [1], 'removing the first placed step keeps later choice');
assert(!workshopUi.workshopHtml(routineEdit, editableSteps, false).includes('ひとつ もどす'));
const splitEdit = engine.makeQuestion('split', 0, 2), editableStones = workshopUi.freshWorkshop();
for (let n = 0; n < 3; n++) workshopUi.workshopClick(splitEdit, editableStones, 'left');
workshopUi.workshopClick(splitEdit, editableStones, 'left-undo');
assert.equal(editableStones.left, 2);
assert(workshopUi.workshopHtml(splitEdit, editableStones, false).includes('data-workshop="left-undo"'));
assert(!workshopUi.workshopHtml(splitEdit, editableStones, false).includes('↩ もどす'));
const rhythmQ = engine.makeQuestion('rhythm', 6, 3), rhythmState = workshopUi.freshWorkshop();
const wrongBeat = rhythmQ.visual.preview[0] === '🔵' ? 1 : 0;
assert.equal(workshopUi.workshopClick(rhythmQ, rhythmState, 'beat', wrongBeat).finished, false);
assert.equal(rhythmState.beats.length, 0);
const sampleSave = engine.freshSave();
sampleSave.completed.add = 5;
sampleSave.completed.shop = 2;
const wp = world.worldProgress(sampleSave);
assert.equal(wp.clears, 7);
assert.equal(wp.unlocked, 3);
assert(world.worldHtml(sampleSave).includes('みどりの こうえん'));
const reportDay = new Date(2026, 9, 26, 14, 0);
progress.recordDaily(sampleSave, reportDay, 'shop', 'independent', 10);
progress.recordDaily(sampleSave, reportDay, 'shop', 'clear');
const r7 = reporting.parentPeriod(sampleSave, reportDay, 7);
assert.equal(r7.days, 1);
assert.equal(r7.independent, 1);
const csv = reporting.learningCsv(sampleSave, reportDay);
assert(csv.startsWith('\ufeff'));
assert(csv.includes('"独力正答"'));
assert(csv.includes('"おかいもの ごっこ"'));
assert(csv.includes('"2026-10-26"'));
const treeWithStarts = progressUi.skillTreeHtml(sampleSave, 'きつね', 'math');
assert(treeWithStarts.includes('data-game="shop"'));
assert(treeWithStarts.includes('data-skill-play="shop"'));
console.log('PASS: four direct-manipulation games, 1600 workshop input simulations, station unlocks and parent CSV');
for (let lv = 1; lv <= 5; lv++) for (let i = 0; i < 80; i++) {
  const q = engine.makeQuestion('digits', i, lv);
  assert(/^[0-9]$/.test(q.answer));
  const guide = activity.TRACE_GUIDES[q.answer];
  assert(guide.strokes.length >= 1);
  const state = activityUi.newActivityState(q);
  assert(!activityUi.activityHtml(q, state).includes('trace-point'));
  let result;
  for (const stroke of guide.strokes) {
    for (let j = 0; j < stroke.length; j++)
      result = activityUi.traceSample(q, state,
        j === 0 ? 'down' : j === stroke.length - 1 ? 'up' : 'move', stroke[j]);
  }
  assert.equal(result.kind, 'submit', 'digit '+q.id);
  assert.equal(result.assisted, true);
}
assert.equal(activity.TRACE_GUIDES['4'].strokes.length, 2);
console.log('PASS: 0-9 number tracing and stroke order across 400 questions, no tap bypass');


// Persistent commits must be immutable; callers can safely recover from QuotaExceededError.
const oldSave = engine.freshSave(), answerQ = engine.makeQuestion('shop', 0);
const oldDate = new Date(2026, 9, 26, 15);
const preparedAnswer = commit.prepareAnswer(oldSave, answerQ, 'independent', true, 10, oldDate);
assert.equal(oldSave.xp, 0);
assert.equal(Object.keys(oldSave.daily).length, 0);
assert.equal(preparedAnswer.data.xp, 10);
assert.equal(preparedAnswer.data.daily['2026-10-26'].independent, 1);
const failedMistake = commit.prepareMistake(oldSave, answerQ, oldDate);
assert.equal(oldSave.daily['2026-10-26'], undefined);
assert.equal(failedMistake.daily['2026-10-26'].mistakes, 1);
assert.equal(failedMistake.xp, 0);
assert.throws(() => storage.persistSlot({ setItem: () => { throw new Error('QuotaExceededError'); } }, 1, failedMistake));
assert.equal(oldSave.daily['2026-10-26'], undefined, 'failed mistake log must not touch existing state');
const mockFail = { setItem: () => { throw new Error('QuotaExceededError'); } };
assert.throws(() => storage.persistSlot(mockFail, 1, preparedAnswer.data));
assert.equal(oldSave.xp, 0, 'failed persistent write must not award in-memory XP');
const learningSession = session.createSession('shop', 1, [answerQ]);
learningSession.practiced = 0;
const clearCandidate = commit.prepareClear(preparedAnswer.data, learningSession, oldDate);
assert.equal(preparedAnswer.data.sessions, 0);
assert.equal(clearCandidate.sessions, 1);
assert.equal(clearCandidate.completed.shop, 1);
assert.equal(clearCandidate.daily['2026-10-26'].clears, 1);
assert.equal(preparedAnswer.data.daily['2026-10-26'].clears, 0);
const restSession = session.createSession('move', 1, [engine.makeQuestion('move', 0)]);
const rested = commit.prepareClear(oldSave, restSession, oldDate);
assert.equal(rested.completed.move, undefined, 'rest-only movement cannot unlock levels');
console.log('PASS: immutable persistence candidates protect XP, daily logs, unlocks and rest outcomes');


// Optional tactile feedback: disabled or unsupported devices are strictly no-op.
assert.equal(engine.freshSave().settings.haptics, true);
const migratedHaptics = storage.normalizeSave({ schema: 2, settings: { sound: true, bgm: true } });
assert.equal(migratedHaptics.settings.haptics, true, 'existing V2 records must keep working');
assert.equal(storage.normalizeSave({
  schema: 2, settings: { haptics: false }
}).settings.haptics, false, 'haptic preference must persist after reload');
const emitted = [];
const vibrate = pattern => { emitted.push(pattern); return true; };
const enabled = { haptics: true, quiet: false };
assert.equal(haptics.emitHaptic('correct', enabled, { vibrate }), true);
assert.equal(haptics.emitHaptic('retry', enabled, { vibrate }), true);
assert.equal(haptics.emitHaptic('level', enabled, { vibrate }), true);
assert.deepEqual(emitted, [32, [35,45,35], [35,50,45,50,75]]);
assert.equal(haptics.emitHaptic('tap', { haptics: false, quiet: false }, { vibrate }), false);
assert.equal(haptics.emitHaptic('clear', { haptics: true, quiet: true }, { vibrate }), false);
assert.equal(haptics.emitHaptic('correct', enabled, { vibrate, reducedMotion: true }), false);
assert.equal(haptics.emitHaptic('correct', enabled, {}), false);
assert.equal(haptics.emitHaptic('correct', enabled, { vibrate: () => { throw Error('unsupported'); } }), false);
assert.equal(emitted.length, 3);
const sourceControl = readFileSync(new URL('../src/quest-main.ts', import.meta.url), 'utf8');
assert(sourceControl.includes('lockedSlotWrite'), 'all app saves use exclusive atomic Web Lock guard');
assert(!sourceControl.includes('persistSlot(localStorage'), 'unguarded app writes are forbidden');
assert(sourceControl.includes("window.addEventListener('storage'"), 'tab changes trigger safety screen');
assert(sourceControl.includes('navigator.locks'), 'all profile saves request browser locks');
assert(!sourceControl.includes('function makeHint('), 'pure hints moved out of main');
assert(!sourceControl.includes('function visualHtml('), 'pure visuals moved out of main');
assert(sourceControl.includes("data-action=\"sync-reload\""), 'stale users get a reload option');
assert(!sourceControl.includes('こたえを ひとつ えらんでね'), 'duplicated answer instructions should be gone');
const codeWithHaptics = readFileSync(new URL('../src/quest-main.ts', import.meta.url), 'utf8');
assert(codeWithHaptics.includes('data-action="haptics"'));
assert(codeWithHaptics.includes("action === 'test-haptics'"));
console.log('PASS: haptics toggle, settings migration, device fallback, sensory reduction and feedback patterns');

rmSync(temp, { recursive: true, force: true });

