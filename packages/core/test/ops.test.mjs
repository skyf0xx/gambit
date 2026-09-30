import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stubGoal, writeSection, appendLog, setStatus, summarizeChange, WRITABLE_KEYS } from '../src/index.mjs';

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

test('summarizeChange', () => {
  const a = stubGoal('g');
  const b = writeSection(a, 'plan', plan).goal;
  assert.deepEqual(summarizeChange(a, b), ['+3 tasks']);
  const c = writeSection(b, 'riskNotes', [{ item: 'x', source: 'threat', accepted: false }]).goal;
  assert.deepEqual(summarizeChange(b, c), ['+1 risk']);
  const d = setStatus(c, 'plan.linesOfOperation.0.nextActions.0', 'done').goal;
  assert.deepEqual(summarizeChange(c, d), ['1 status change']);
});
