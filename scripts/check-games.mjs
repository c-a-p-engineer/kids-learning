#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import ts from 'typescript';

const source = readFileSync(new URL('../src/engine.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const engine = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(output.outputText));
const now = Date.UTC(2026, 9, 26);

assert.equal(engine.GAMES.length, 10);
assert.equal(new Set(engine.GAMES.map(g => g.id)).size, 10);
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
    if (game.id === 'memory') assert(q.visual.preview.includes(q.answer));
    if (game.id === 'clock') {
      assert(q.visual.hour >= 1 && q.visual.hour <= 12);
      assert([0, 30].includes(q.visual.minute));
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
console.log('PASS: 10 games × 80 cases, answer validity, arithmetic, finite rounds, recall scheduler');
