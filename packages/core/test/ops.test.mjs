import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stubGoal, writeSection, appendLog, setStatus, summarizeChange, WRITABLE_KEYS, capLog, LOG_CAP } from '../src/index.mjs';

const plan = {
  linesOfOperation: [{
    label: 'L', criticalPath: [{ label: 'a', status: 'pending' }],
    nextActions: [{ action: 'do x', who: 'me', when: 'Fri' }, { action: 'do y', who: 'me', when: 'Mon' }],
  }],
};

test('writeSection validates, defaults, and rejects unknown/log keys', () => {
  const g = stubGoal('g');
  const ok = writeSection(g, 'plan', plan);
  assert.equal(ok.ok, true);
  assert.equal(ok.goal.plan.linesOfOperation[0].nextActions[0].status, 'pending');
  assert.equal(writeSection(g, 'log', []).ok, false);
  assert.equal(writeSection(g, 'schemaVersion', 2).ok, false);
  const bad = writeSection(g, 'riskNotes', [{ item: 'x', source: 'nope', accepted: false }]);
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0].path, /^riskNotes\.0\.source/);
  assert.ok(WRITABLE_KEYS.includes('plan') && !WRITABLE_KEYS.includes('log'));
});

test('setStatus flips one node and surfaces reconcile warnings', () => {
  const g = writeSection(stubGoal('g'), 'plan', plan).goal;
  const r = setStatus(g, 'plan.linesOfOperation.0.nextActions.1', 'done');
  assert.equal(r.goal.plan.linesOfOperation[0].nextActions[1].status, 'done');
  const w = setStatus(g, 'plan.linesOfOperation.0.criticalPath.0', 'done');
  assert.equal(w.warnings.length, 1);
  assert.equal(setStatus(g, 'plan.linesOfOperation.9', 'done').ok, false);
  assert.equal(setStatus(g, 'goal', 'done').ok, false);
  assert.equal(setStatus(g, 'plan.linesOfOperation.0.nextActions.0', 'maybe').ok, false);
});

test('setStatus: a proposed next action is kept or tossed; steps cannot be proposed', () => {
  const g = writeSection(stubGoal('g'), 'plan', plan).goal;
  const proposed = setStatus(g, 'plan.linesOfOperation.0.nextActions.1', 'proposed');
  assert.equal(proposed.ok, true);
  assert.equal(setStatus(proposed.goal, 'plan.linesOfOperation.0.nextActions.1', 'pending').goal.plan.linesOfOperation[0].nextActions[1].status, 'pending');
  assert.equal(setStatus(g, 'plan.linesOfOperation.0.criticalPath.0', 'proposed').ok, false);
});

test('appendLog is append-only and validated', () => {
  const g = stubGoal('g');
  const r = appendLog(g, { date: '2026-09-19', focus: null, notes: ['started'] });
  assert.equal(r.goal.log.length, 1);
  assert.equal(appendLog(g, { date: 'today', focus: null, notes: [] }).ok, false);
});

test('capLog keeps only the newest LOG_CAP entries once over the cap', () => {
  const entries = Array.from({ length: LOG_CAP + 5 }, (_, i) => ({ date: '2026-09-19', focus: null, notes: [`e${i}`] }));
  const capped = capLog(entries);
  assert.equal(capped.length, LOG_CAP);
  assert.equal(capped[0].notes[0], 'e5');
  assert.equal(capped.at(-1).notes[0], `e${LOG_CAP + 4}`);
});

test('capLog preserves the most recent focusLine entry even when older than the cap', () => {
  const entries = Array.from({ length: LOG_CAP + 5 }, (_, i) => ({ date: '2026-09-19', focus: null, notes: [`e${i}`] }));
  entries[2] = { ...entries[2], focusLine: 'the focused line' };
  const capped = capLog(entries);
  assert.equal(capped.length, LOG_CAP + 1);
  assert.equal(capped[0].focusLine, 'the focused line');
  assert.equal(capped[0].notes[0], 'e2');
});

test('capLog does not duplicate-preserve a focusLine entry already inside the window', () => {
  const entries = Array.from({ length: LOG_CAP + 5 }, (_, i) => ({ date: '2026-09-19', focus: null, notes: [`e${i}`] }));
  entries[LOG_CAP + 2] = { ...entries[LOG_CAP + 2], focusLine: 'recent focus' };
  const capped = capLog(entries);
  assert.equal(capped.length, LOG_CAP);
  assert.equal(capped.filter((e) => e.focusLine).length, 1);
});

test('appendLog trims to LOG_CAP on overflow, keeping the newest entries', () => {
  let g = stubGoal('g');
  for (let i = 0; i < LOG_CAP + 3; i++) {
    g = appendLog(g, { date: '2026-09-19', focus: null, notes: [`n${i}`] }).goal;
  }
  assert.equal(g.log.length, LOG_CAP);
  assert.equal(g.log[0].notes[0], 'n3');
});

test('appendLog keeps an old focusLine entry alive past the cap', () => {
  let g = stubGoal('g');
  g = appendLog(g, { date: '2026-09-19', focus: 'early focus', focusLine: 'do the early thing', notes: [] }).goal;
  for (let i = 0; i < LOG_CAP + 5; i++) {
    g = appendLog(g, { date: '2026-09-19', focus: null, notes: [`n${i}`] }).goal;
  }
  const focused = g.log.find((e) => e.focusLine);
  assert.equal(focused.focusLine, 'do the early thing');
});

test('summarizeChange', () => {
  const a = stubGoal('g');
  const b = writeSection(a, 'plan', plan).goal;
  assert.deepEqual(summarizeChange(a, b), ['+3 tasks']);
  const c = writeSection(b, 'riskNotes', [{ item: 'x', source: 'threat', accepted: false }]).goal;
  assert.deepEqual(summarizeChange(b, c), ['+1 risk']);
  const d = setStatus(c, 'plan.linesOfOperation.0.nextActions.0', 'done').goal;
  assert.deepEqual(summarizeChange(c, d), ['1 status change']);
});
