#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import ts from 'typescript';

const source = readFileSync(new URL('../src/engine.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const engine = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(output.outputText));
const now = Date.UTC(2026, 9, 26);

assert.equal(engine.GAMES.length, 15);
// Audio settings are stored in the existing V2 profile object, never legacy keys.
const defaults = engine.freshSave();
assert.equal(defaults.schema, 2);
assert.equal(defaults.settings.bgm, true);
assert.equal(defaults.settings.sound, true);
assert.equal(defaults.settings.bgmVolume, 75);
assert.equal(defaults.settings.seVolume, 65);
assert.equal(engine.clampVolume(43.9, 75), 44);
assert.equal(engine.clampVolume(120, 75), 100);
assert.equal(engine.clampVolume(-20, 65), 0);
assert.equal(engine.clampVolume(Number.NaN, 65), 65);
assert.equal(engine.clampVolume('50', 75), 75);

assert.equal(new Set(engine.GAMES.map(g => g.id)).size, 15);
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
// All 15 games must generate five distinct items with a correct option at levels 2–5.
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

console.log('PASS: 15 games × 80 cases, answer validity, arithmetic, finite rounds, recall scheduler');
