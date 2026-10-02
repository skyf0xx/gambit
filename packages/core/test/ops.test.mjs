import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stubGoal, writeSection, appendLog, setStatus, summarizeChange, WRITABLE_KEYS, capLog, currentFocusEntry, LOG_CAP, GOAL_MAX_WORDS, goalSchema, readingGrade, READING_GRADE_MAX } from '../src/index.mjs';

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

test('writeSection rejects a goal sentence over 10 words with a helpful message, but allows subGoals separately', () => {
  const g = stubGoal('Open a third salon');
  const tooLong = writeSection(g, 'goal', 'Open a third salon by March without burning out or losing Priya');
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.errors.length, 1);
  assert.match(tooLong.errors[0].message, /10 words or fewer/);
  assert.match(tooLong.errors[0].message, /subGoals/);

  const short = writeSection(g, 'goal', 'Open a third salon by March');
  assert.equal(short.ok, true);
  assert.equal(short.goal.goal, 'Open a third salon by March');

  const withParts = writeSection(short.goal, 'subGoals', ['without burning out', 'without losing Priya']);
  assert.equal(withParts.ok, true);
  assert.deepEqual(withParts.goal.subGoals, ['without burning out', 'without losing Priya']);

  // exactly GOAL_MAX_WORDS words is fine
  const exact = writeSection(g, 'goal', Array.from({ length: GOAL_MAX_WORDS }, () => 'word').join(' '));
  assert.equal(exact.ok, true);
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
  g.plan.linesOfOperation[0].nextActions[1].detail = 'unblocks the lease talk';
  const proposed = setStatus(g, 'plan.linesOfOperation.0.nextActions.1', 'proposed');
  assert.equal(proposed.ok, true);
  assert.equal(setStatus(proposed.goal, 'plan.linesOfOperation.0.nextActions.1', 'pending').goal.plan.linesOfOperation[0].nextActions[1].status, 'pending');
  assert.equal(setStatus(g, 'plan.linesOfOperation.0.criticalPath.0', 'proposed').ok, false);
  // No detail, no proposal.
  const bare = setStatus(g, 'plan.linesOfOperation.0.nextActions.0', 'proposed');
  assert.equal(bare.ok, false);
  assert.equal(bare.errors[0].path, 'plan.linesOfOperation.0.nextActions.0.detail');
});

test('only one line of the plan can carry focus', () => {
  const line = (label) => ({ label, criticalPath: [], nextActions: [], focus: true });
  const r = writeSection(stubGoal('g'), 'plan', { linesOfOperation: [line('A'), line('B')] });
  assert.equal(r.ok, false);
  assert.equal(writeSection(stubGoal('g'), 'plan', { linesOfOperation: [line('A'), { label: 'B', criticalPath: [], nextActions: [] }] }).ok, true);
});

test('a proposed move needs its detail on write, but an older one without it still reads and can be kept', () => {
  const g = stubGoal('g');
  const withProposal = (detail) => ({
    linesOfOperation: [{ ...plan.linesOfOperation[0], nextActions: [{ action: 'call the landlord', who: 'me', when: 'Fri', status: 'proposed', detail }] }],
  });
  const bare = writeSection(g, 'plan', withProposal(undefined));
  assert.equal(bare.ok, false);
  assert.equal(bare.errors[0].path, 'plan.linesOfOperation.0.nextActions.0.detail');
  assert.match(bare.errors[0].message, /why this, why now/);
  assert.equal(writeSection(g, 'plan', withProposal('  ')).ok, false);
  assert.equal(writeSection(g, 'plan', withProposal('the lease renews in March')).ok, true);

  // Saved before the rule: reads fine, and the user can still keep it.
  const legacy = { ...g, plan: withProposal(undefined) };
  assert.equal(goalSchema.safeParse(legacy).success, true);
  assert.equal(setStatus(legacy, 'plan.linesOfOperation.0.nextActions.0', 'pending').ok, true);
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

test('capLog preserves the current focus entry even when older than the cap', () => {
  const entries = Array.from({ length: LOG_CAP + 5 }, (_, i) => ({ date: '2026-09-19', focus: null, notes: [`e${i}`] }));
  entries[2] = { ...entries[2], focus: 'f', focusLine: 'the focused line' };
  const capped = capLog(entries);
  assert.equal(capped.length, LOG_CAP + 1);
  assert.equal(capped[0].focusLine, 'the focused line');
  assert.equal(capped[0].notes[0], 'e2');
});

test('capLog does not duplicate-preserve a focusLine entry already inside the window', () => {
  const entries = Array.from({ length: LOG_CAP + 5 }, (_, i) => ({ date: '2026-09-19', focus: null, notes: [`e${i}`] }));
  entries[LOG_CAP + 2] = { ...entries[LOG_CAP + 2], focus: 'f', focusLine: 'recent focus' };
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

test('writes reject prose above the reading-grade cap; short labels and names are not scored', () => {
  const g = stubGoal('g');
  const dense = writeSection(g, 'riskNotes', [{
    item: 'Landlord timing', source: 'threat', accepted: false,
    detail: 'Negotiate an extended contingency period with the landlord, contingent on financing approval documentation.',
  }]);
  assert.equal(dense.ok, false);
  assert.equal(dense.errors[0].path, 'riskNotes.0.detail');
  assert.match(dense.errors[0].message, /grade 7 or below/);

  const plain = writeSection(g, 'riskNotes', [{
    item: 'Landlord timing', source: 'threat', accepted: false,
    detail: 'Ask the landlord for two more weeks so the bank has time to say yes.',
  }]);
  assert.equal(plain.ok, true);

  assert.equal(writeSection(g, 'riskNotes', [{ item: 'Operationalize distribution', source: 'threat', accepted: false }]).ok, true);
  assert.equal(readingGrade('Call Mediterranean Shipping Company on Monday to ask when the boat gets in.') <= READING_GRADE_MAX, true);

  const log = appendLog(g, { date: '2026-10-01', focus: null, notes: ['We leveraged cross-functional stakeholder alignment to operationalize the strategic distribution initiative.'] });
  assert.equal(log.ok, false);
  assert.equal(log.errors[0].path, 'log.notes.0');
});

test('a name lives in people or stakeholders, never both', () => {
  const sh = (name) => ({ name, power: 'high', stanceCurrent: 'unaware', stanceTarget: 'chases it', via: 'one email' });
  const g = { ...stubGoal('g'), people: [{ name: 'Cr Blackmore', status: 'lead', doing: 'asked to chase it' }] };

  const refused = writeSection(g, 'stakeholders', [sh('Rail'), sh(' cr blackmore')]);
  assert.equal(refused.ok, false);
  assert.equal(refused.errors[0].path, 'stakeholders.1.name');

  const withRail = writeSection(g, 'stakeholders', [sh('Rail')]).goal;
  const moved = writeSection(withRail, 'people', [...withRail.people, { name: 'Rail', status: 'lead', doing: 'emailed' }]);
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.goal.stakeholders, []);
  assert.match(moved.warnings[0], /"Rail" taken off stakeholders/);
});

test('reconcile flags a record that still holds someone in both lists', () => {
  const g = { ...stubGoal('g'), people: [{ name: 'Ann', status: 'lead', doing: 'x' }], stakeholders: [{ name: 'Ann', power: 'low', stanceCurrent: 'a', stanceTarget: 'b', via: 'c' }] };
  const r = writeSection(g, 'deadline', null);
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => /in both people and stakeholders/.test(w)));
});

test('only strategy names the highlighted line; other writers are stamped as the source', () => {
  const g = stubGoal('g');
  const fromPlan = appendLog(g, { date: '2026-09-19', focus: 'x', focusLine: 'a line', notes: [] }, 'plan');
  assert.equal(fromPlan.ok, true);
  assert.equal(fromPlan.goal.log.at(-1).focusLine, undefined);
  assert.equal(fromPlan.goal.log.at(-1).source, 'plan');
  assert.match(fromPlan.warnings[0], /only strategy/);
  const fromStrategy = appendLog(g, { date: '2026-09-19', focus: 'x', focusLine: 'a line', notes: [] }, 'strategy');
  assert.equal(fromStrategy.goal.log.at(-1).focusLine, 'a line');
  assert.deepEqual(fromStrategy.warnings, []);
});

test('currentFocusEntry is the newest strategy (or unsourced) entry that sets a focus', () => {
  const log = [
    { date: '2026-09-01', focus: 'old', focusLine: 'old line', notes: [] },
    { date: '2026-09-02', focus: 'plan says', focusLine: 'plan line', source: 'plan', notes: [] },
    { date: '2026-09-03', focus: null, notes: [] },
  ];
  assert.equal(currentFocusEntry(log).focusLine, 'old line');
  assert.equal(currentFocusEntry([...log, { date: '2026-09-04', focus: 'new', source: 'strategy', notes: [] }]).focusLine, undefined);
});
