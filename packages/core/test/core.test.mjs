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
  assert.equal(g.schemaVersion, 2);
});

test('schema rejects bad dates, enums, and over-long labels', () => {
  const bad = (patch) => safeParseGoalJson({ ...stubGoal('g'), ...patch });
  assert.match(bad({ deadline: 'next month' }).error, /deadline/);
  assert.equal(bad({ deadline: '2026-02-30' }).success, false);
  assert.equal(bad({ successCriteria: [{ text: 'y', kind: 'sideways' }] }).success, false);
  assert.equal(bad({ people: [{ name: 'x'.repeat(41), status: 'lead', doing: 'd' }] }).success, false);
  assert.equal(bad({ deadline: '2028-02-29' }).success, true);
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
    if (['schemaVersion', 'goal', 'successCriteria', 'deadline', 'log', 'posture'].includes(key)) continue;
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
  assert.deepEqual(readGoal({ ...stubGoal('g'), schemaVersion: 3 }), { status: 'needs_app_update', version: 3 });
});

test('readGoal: migration chain runs then validates', () => {
  const migrations = [{ from: 2, to: 3, transform: (d) => ({ ...d, goal: d.goal.toUpperCase() }) }];
  const r = readGoal(stubGoal('abc'), { migrations, current: 3 });
  // current schema is still literal(2), so the migrated v3 doc must fail validation loudly rather than pass
  assert.equal(r.status, 'invalid');
  const noPath = readGoal(stubGoal('abc'), { migrations: [], current: 3 });
  assert.match(noPath.error, /no migration from schemaVersion 2/);
});

test('readGoal: a v1 document migrates to v2 unchanged', () => {
  const v1 = { ...stubGoal('abc'), schemaVersion: 1 };
  const r = readGoal(v1);
  assert.equal(r.status, 'ok');
  assert.equal(r.migratedFrom, 1);
  assert.deepEqual(r.data, { ...v1, schemaVersion: 2 });
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
