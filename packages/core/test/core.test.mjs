import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalSchema, stubGoal, safeParseGoalJson, parseGoalJson, reconcileGoal } from '../src/schema.mjs';
import { rendererForSection, groupForSection, GROUP_ORDER, SECTION_GROUPS } from '../src/registry.mjs';

const step = (status) => ({ label: 's', status });
const goalWithPlan = (line) => ({ ...stubGoal('g'), plan: { linesOfOperation: [{ label: 'L', criticalPath: [], nextActions: [], ...line }] } });

test('stubGoal is valid and seeded from title', () => {
  const g = stubGoal('Ship it');
  assert.equal(goalSchema.safeParse(g).success, true);
  assert.equal(g.goal, 'Ship it');
  assert.equal(g.schemaVersion, 3);
});

test('schema rejects bad dates, enums, and over-long labels', () => {
  const bad = (patch) => safeParseGoalJson({ ...stubGoal('g'), ...patch });
  assert.match(bad({ deadline: 'next month' }).error, /deadline/);
  assert.equal(bad({ deadline: '2026-02-30' }).success, false);
  assert.equal(bad({ successCriteria: [{ text: 'y', kind: 'sideways' }] }).success, false);
  assert.equal(bad({ people: [{ name: 'x'.repeat(41), status: 'lead', doing: 'd' }] }).success, false);
  assert.equal(bad({ deadline: '2028-02-29' }).success, true);
});

test('subGoals: optional, capped at 5 entries, each at most 12 words / 100 chars', () => {
  const ok = (patch) => goalSchema.safeParse({ ...stubGoal('g'), ...patch }).success;
  assert.equal(ok({}), true, 'subGoals is optional');
  assert.equal(ok({ subGoals: ['without burning out', 'without losing Priya'] }), true);
  assert.equal(ok({ subGoals: Array.from({ length: 5 }, (_, i) => `part ${i}`) }), true);
  assert.equal(ok({ subGoals: Array.from({ length: 6 }, (_, i) => `part ${i}`) }), false, 'max 5 items');
  assert.equal(ok({ subGoals: [Array.from({ length: 13 }, () => 'word').join(' ')] }), false, 'max 12 words');
  assert.equal(ok({ subGoals: ['x'.repeat(101)] }), false, 'max 100 chars');
  assert.equal(ok({ subGoals: [''] }), false, 'no empty entries');
});

test('caps: 6 critical-path steps, 5 next actions', () => {
  const six = Array.from({ length: 6 }, () => step('pending'));
  assert.equal(goalSchema.safeParse(goalWithPlan({ criticalPath: six })).success, true);
  assert.equal(goalSchema.safeParse(goalWithPlan({ criticalPath: [...six, step('pending')] })).success, false);
});

test('safeParseGoalJson reports invalid JSON; parseGoalJson throws', () => {
  assert.match(safeParseGoalJson('{nope').error, /invalid JSON/);
  assert.throws(() => parseGoalJson({}));
});

test('reconcileGoal warns when children are all done but parent lags', () => {
  const done = [step('done'), step('done')];
  assert.equal(reconcileGoal(goalWithPlan({ criticalPath: done, status: 'done' })).length, 0);
  assert.equal(reconcileGoal(goalWithPlan({ criticalPath: done, status: 'at_risk' })).length, 1);
  const items = [{ label: 'a', status: 'done' }];
  assert.equal(reconcileGoal(goalWithPlan({ criticalPath: [{ label: 's', status: 'pending', items }] })).length, 1);
});

test('registry: every schema key maps to a group in GROUP_ORDER', () => {
  for (const key of Object.keys(goalSchema.shape)) {
    if (['schemaVersion', 'goal', 'subGoals', 'successCriteria', 'deadline', 'updated', 'log', 'posture'].includes(key)) continue;
    assert.ok(GROUP_ORDER.includes(groupForSection(key)), key);
  }
  assert.ok(Object.values(SECTION_GROUPS).every((g) => GROUP_ORDER.includes(g)));
  assert.equal(rendererForSection('unknown'), 'plain-card');
});

import { readGoal } from '../src/read.mjs';

test('readGoal: ok, invalid, and newer-version paths', () => {
  assert.equal(readGoal(stubGoal('g')).status, 'ok');
  assert.equal(readGoal('{nope').status, 'invalid');
  assert.equal(readGoal({ goal: 'x' }).status, 'invalid');
  assert.deepEqual(readGoal({ ...stubGoal('g'), schemaVersion: 4 }), { status: 'needs_app_update', version: 4 });
});

test('readGoal: migration chain runs then validates', () => {
  const migrations = [{ from: 3, to: 4, transform: (d) => ({ ...d, goal: d.goal.toUpperCase() }) }];
  const r = readGoal(stubGoal('abc'), { migrations, current: 4 });
  // current schema is still literal(3), so the migrated v4 doc must fail validation loudly rather than pass
  assert.equal(r.status, 'invalid');
  const noPath = readGoal(stubGoal('abc'), { migrations: [], current: 4 });
  assert.match(noPath.error, /no migration from schemaVersion 3/);
});

test('readGoal: a v1 document migrates all the way to v3 unchanged (short goal)', () => {
  const v1 = { ...stubGoal('abc'), schemaVersion: 1 };
  const r = readGoal(v1);
  assert.equal(r.status, 'ok');
  assert.equal(r.migratedFrom, 1);
  assert.deepEqual(r.data, { ...v1, schemaVersion: 3 });
});

test('readGoal: v2 -> v3 migration splits an over-long goal on a dash', () => {
  const v2 = { ...stubGoal('Open a third salon by March — without burning out or losing Priya'), schemaVersion: 2 };
  const r = readGoal(v2);
  assert.equal(r.status, 'ok');
  assert.equal(r.data.goal, 'Open a third salon by March');
  assert.deepEqual(r.data.subGoals, ['without burning out or losing Priya']);
});

test('readGoal: v2 -> v3 migration splits an over-long goal on a semicolon, further on commas', () => {
  const v2 = { ...stubGoal('Launch the new product line by Q2; hire two engineers, keep runway above six months'), schemaVersion: 2 };
  const r = readGoal(v2);
  assert.equal(r.status, 'ok');
  assert.equal(r.data.goal, 'Launch the new product line by Q2');
  assert.deepEqual(r.data.subGoals, ['hire two engineers', 'keep runway above six months']);
});

test('readGoal: v2 -> v3 migration leaves a short goal untouched, with no subGoals', () => {
  const v2 = { ...stubGoal('Open a third salon by March'), schemaVersion: 2 };
  const r = readGoal(v2);
  assert.equal(r.status, 'ok');
  assert.equal(r.data.goal, 'Open a third salon by March');
  assert.equal(r.data.subGoals, undefined);
});

test('readGoal: v2 -> v3 migration leaves an over-long goal with no separator as-is', () => {
  const longGoal = 'Grow the business steadily while keeping quality high and staff happy this year';
  const v2 = { ...stubGoal(longGoal), schemaVersion: 2 };
  const r = readGoal(v2);
  assert.equal(r.status, 'ok');
  assert.equal(r.data.goal, longGoal);
  assert.equal(r.data.subGoals, undefined);
});

test('v2: proposed next actions, met criteria, focusLine', () => {
  const ok = (patch) => goalSchema.safeParse({ ...stubGoal('g'), ...patch }).success;
  const na = (status) => goalWithPlan({ nextActions: [{ action: 'get two quotes', who: 'me', when: 'Fri', status }] });
  assert.equal(goalSchema.safeParse(na('proposed')).success, true);
  assert.equal(goalSchema.safeParse(goalWithPlan({ criticalPath: [step('proposed')] })).success, false);
  assert.equal(ok({ criteriaStatus: [{ text: 't', kind: 'control', status: 'met' }] }), true);
  assert.equal(ok({ log: [{ date: '2026-09-30', assessment: 'met', focus: null, notes: [] }] }), false);
  assert.equal(ok({ log: [{ date: '2026-09-30', focus: 'f', focusLine: 'Know the real hours', notes: [] }] }), true);
});

test('v2: open decisions need a question; decided ones need choice and reverse-if', () => {
  const ok = (d) => goalSchema.safeParse({ ...stubGoal('g'), decisions: [{ date: '2026-09-30', ...d }] }).success;
  assert.equal(ok({ status: 'open', question: 'Take the 10-year lease?' }), true);
  assert.equal(ok({ status: 'open' }), false);
  assert.equal(ok({ choice: 'Take it', reverseIf: 'No break clause' }), true);
  assert.equal(ok({ choice: 'Take it' }), false);
  assert.equal(ok({ status: 'decided', question: 'q' }), false);
});

test('reconcileGoal warns when a risk dependsOn nobody on the page', () => {
  const g = {
    ...stubGoal('g'),
    people: [{ name: 'Priya', status: 'confirmed', doing: 'runs Moseley' }],
    riskNotes: [
      { item: 'Moseley depends on one person', source: 'threat', accepted: false, dependsOn: 'Priya' },
      { item: 'Fit-out overruns', source: 'threat', accepted: false, dependsOn: 'Dev' },
    ],
  };
  assert.equal(goalSchema.safeParse(g).success, true);
  const w = reconcileGoal(g);
  assert.equal(w.length, 1);
  assert.match(w[0], /Dev/);
});
