import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stubGoal, writeSection, appendLog, setStatus, remember, forget, sameLine, MEMORY_CAP, LOG_NOTES_MAX, LOG_RECENT, summarizeChange, WRITABLE_KEYS, capLog, currentFocusEntry, LOG_CAP, GOAL_MAX_WORDS, goalSchema, readingGrade, READING_GRADE_MAX } from '../src/index.mjs';
import * as core from '../src/index.mjs';

const plan = {
  linesOfOperation: [{
    label: 'L', criticalPath: [{ label: 'a', status: 'pending' }],
    nextActions: [{ action: 'do x', who: 'me', when: '2026-10-09' }, { action: 'do y', who: 'me', when: '2026-10-12' }],
    decisionPoints: [{ if: 'no word by Friday', then: 'call them', by: '2026-10-16' }],
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

test('setStatus stamps doneOn on a next action done, and clears it on any other status', () => {
  const g = writeSection(stubGoal('g'), 'plan', plan).goal;
  const path = 'plan.linesOfOperation.0.nextActions.0';
  const done = setStatus(g, path, 'done', '2026-10-03').goal;
  assert.equal(done.plan.linesOfOperation[0].nextActions[0].doneOn, '2026-10-03');
  // Done again keeps the first date.
  assert.equal(setStatus(done, path, 'done', '2026-10-05').goal.plan.linesOfOperation[0].nextActions[0].doneOn, '2026-10-03');
  assert.equal(setStatus(done, path, 'pending', '2026-10-05').goal.plan.linesOfOperation[0].nextActions[0].doneOn, undefined);
  // Steps carry no stamp.
  assert.equal(setStatus(g, 'plan.linesOfOperation.0.criticalPath.0', 'done', '2026-10-03').goal.plan.linesOfOperation[0].criticalPath[0].doneOn, undefined);
});

test('writeSection keeps doneOn true across a plan rewrite', () => {
  const g = setStatus(writeSection(stubGoal('g'), 'plan', plan).goal, 'plan.linesOfOperation.0.nextActions.0', 'done', '2026-10-01').goal;
  const actions = (p) => p.linesOfOperation[0].nextActions;
  const rewrite = (nextActions) => ({ linesOfOperation: [{ ...plan.linesOfOperation[0], nextActions }] });
  const next = writeSection(g, 'plan', rewrite([
    { action: 'do x', who: 'me', status: 'done' },
    { action: 'do y', who: 'me', status: 'done' },
    { action: 'do z', who: 'me', status: 'pending', doneOn: '2026-10-02' },
  ]), '2026-10-03T09:00:00Z', '2026-10-03');
  assert.equal(next.ok, true);
  assert.deepEqual(actions(next.goal.plan).map((a) => a.doneOn), ['2026-10-01', '2026-10-03', undefined]);
  // A date the model passes stands; one that is not a date is refused.
  const given = writeSection(g, 'plan', rewrite([{ action: 'do y', who: 'me', status: 'done', doneOn: '2026-09-30' }]));
  assert.equal(actions(given.goal.plan)[0].doneOn, '2026-09-30');
  assert.equal(writeSection(g, 'plan', rewrite([{ action: 'do y', who: 'me', when: 'Friday' }])).ok, false);
});

test('intel, courses and prep validate their caps', () => {
  const g = stubGoal('g');
  const q = { question: 'Will the council meet in May?', via: 'ask the clerk', status: 'open', by: '2026-10-10' };
  assert.equal(writeSection(g, 'intel', [q]).ok, true);
  assert.equal(writeSection(g, 'intel', Array.from({ length: 9 }, () => q)).ok, false);
  assert.equal(writeSection(g, 'intel', [{ ...q, status: 'maybe' }]).ok, false);
  const c = (name, chosen) => ({ name, idea: 'Go to the press first', ...(chosen ? { chosen: true } : {}) });
  assert.equal(writeSection(g, 'courses', [c('A', true), c('B')]).ok, true);
  assert.equal(writeSection(g, 'courses', [c('A', true), c('B', true)]).ok, false);
  assert.equal(writeSection(g, 'courses', [c('A'), c('B'), c('C'), c('D')]).ok, false);
  const p = { with: 'Priya', on: '2026-10-08', ask: 'A two-year lease', batna: 'The unit on Hill Street', walkAway: 'Rent over 2,000 a month', concessions: ['pay a deposit'], done: false };
  assert.equal(writeSection(g, 'prep', [p]).ok, true);
  assert.equal(writeSection(g, 'prep', [{ ...p, concessions: Array.from({ length: 6 }, () => 'x') }]).ok, false);
  assert.equal(writeSection(g, 'prep', Array.from({ length: 6 }, () => p)).ok, false);
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
  const line = (label) => ({ label, criticalPath: [], nextActions: [], focus: true, decisionPoints: plan.linesOfOperation[0].decisionPoints });
  const r = writeSection(stubGoal('g'), 'plan', { linesOfOperation: [line('A'), line('B')] });
  assert.equal(r.ok, false);
  assert.equal(writeSection(stubGoal('g'), 'plan', { linesOfOperation: [line('A'), { label: 'B', criticalPath: [], nextActions: [] }] }).ok, true);
});

test('a proposed move needs its detail on write, but an older one without it still reads and can be kept', () => {
  const g = stubGoal('g');
  const withProposal = (detail) => ({
    linesOfOperation: [{ ...plan.linesOfOperation[0], nextActions: [{ action: 'call the landlord', who: 'me', when: '2026-10-09', status: 'proposed', detail }] }],
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

test('appendLog caps notes per entry', () => {
  const notes = Array.from({ length: LOG_NOTES_MAX + 1 }, (_, i) => `note ${i}`);
  assert.equal(appendLog(stubGoal('g'), { date: '2026-10-02', focus: null, notes }).ok, false);
});

test('sameLine catches a restatement, not two lines that share a name', () => {
  assert.equal(sameLine('Complaint sent to council, Blackmore copied. It asks for nothing.', 'Complaint lodged with council, Blackmore copied. It asks for nothing.'), true);
  assert.equal(sameLine('Blackmore first: on council before 2019.', 'Blackmore drops to a fallback. A council referral may arrive free.'), false);
});

test('appendLog refuses a note that repeats a recent entry or its own entry', () => {
  const said = 'Complaint sent to council, Blackmore copied. It asks for nothing and sets no date.';
  const again = 'Complaint lodged with council, Blackmore copied. It asks for nothing and sets no date.';
  const g = appendLog(stubGoal('g'), { date: '2026-10-02', focus: null, notes: [said] }, 'negotiate').goal;
  const r = appendLog(g, { date: '2026-10-02', focus: null, notes: ['Posture held at quiet.', again] }, 'strategy');
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].path, 'log.notes.1');
  assert.match(r.errors[0].message, /repeats the 2026-10-02 negotiate entry/);
  assert.equal(appendLog(stubGoal('g'), { date: '2026-10-02', focus: null, notes: [said, again] }).errors[0].path, 'log.notes.1');
  // Past the recent window, a line may come up again.
  let h = g;
  for (let i = 0; i < LOG_RECENT; i++) h = appendLog(h, { date: '2026-10-02', focus: null, notes: [`step ${i}`] }).goal;
  assert.equal(appendLog(h, { date: '2026-10-02', focus: null, notes: [again] }).ok, true);
});

test('remember keeps, corrects in place, refuses repeats and overflow; forget drops', () => {
  const day = '2026-10-02';
  let g = remember(stubGoal('g'), { kind: 'rejected', text: 'No cold outreach to the rail company.' }, day).goal;
  assert.deepEqual(g.memory, [{ kind: 'rejected', text: 'No cold outreach to the rail company.', date: day }]);
  const twin = remember(g, { kind: 'rejected', text: 'No cold outreach at all to the rail company, ever.' }, day);
  assert.equal(twin.ok, false);
  assert.match(twin.errors[0].message, /replaces: 0/);
  g = remember(g, { kind: 'fact', text: 'Complaint went to Cr Blackmore directly.' }, day).goal;
  g = remember(g, { kind: 'fact', text: 'Complaint went to Cr Blackmore, not as a copy.', replaces: 1 }, day).goal;
  assert.equal(g.memory.length, 2);
  assert.equal(g.memory[1].text, 'Complaint went to Cr Blackmore, not as a copy.');
  assert.equal(remember(g, { kind: 'fact', text: 'x', replaces: 9 }, day).ok, false);
  assert.equal(remember(g, { kind: 'guess', text: 'x' }, day).ok, false);
  assert.equal(writeSection(g, 'memory', []).ok, false);
  let full = stubGoal('g');
  for (let i = 0; i < MEMORY_CAP; i++) full = { ...full, memory: [...full.memory, { kind: 'fact', text: `fact ${i}`, date: day }] };
  assert.match(remember(full, { kind: 'fact', text: 'one more' }, day).errors[0].message, /full/);
  g = forget(g, 0).goal;
  assert.equal(g.memory.length, 1);
  assert.equal(forget(g, 5).ok, false);
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

test('writeSection stamps each key whose value changes', () => {
  const g = stubGoal('g');
  const a = writeSection(g, 'plan', plan, '2026-10-01T09:00:00Z').goal;
  assert.deepEqual(a.updated, { plan: '2026-10-01T09:00:00Z' });
  assert.deepEqual(writeSection(a, 'plan', a.plan, '2026-10-02T09:00:00Z').goal.updated, a.updated);
  const withSide = { ...a, stakeholders: [{ name: 'Ann', power: 'high', stanceCurrent: 'neutral', stanceTarget: 'for', via: 'a call' }] };
  const moved = writeSection(withSide, 'people', [{ name: 'Ann', status: 'confirmed', doing: 'edits the paper' }], '2026-10-03T09:00:00Z');
  assert.equal(moved.ok, true, JSON.stringify(moved.errors));
  assert.equal(moved.goal.updated.people, '2026-10-03T09:00:00Z');
  assert.equal(moved.goal.updated.stakeholders, '2026-10-03T09:00:00Z');
  assert.equal(WRITABLE_KEYS.includes('updated'), false);
});

test('editLine edits one line through writeSection: rules, stamps, and a stale start refused', () => {
  const { editLine, lineText, isEditableLine } = core;
  let g = writeSection(stubGoal('Open a third salon'), 'plan', plan, '2026-01-01T00:00:00.000Z').goal;
  const path = 'plan.linesOfOperation.0.nextActions.1';
  assert.equal(lineText(g, path), 'do y');
  const ok = editLine(g, path, '  call the landlord ', 'do y');
  assert.equal(ok.ok, true);
  assert.equal(ok.goal.plan.linesOfOperation[0].nextActions[1].action, 'call the landlord');
  assert.equal(ok.goal.plan.linesOfOperation[0].nextActions[1].who, 'me');
  assert.notEqual(ok.goal.updated.plan, '2026-01-01T00:00:00.000Z');

  assert.match(editLine(g, path, 'x', 'something else').errors[0].message, /just changed/);
  assert.equal(editLine(g, path, '   ', 'do y').ok, false);
  assert.equal(editLine(g, 'posture', 'x').ok, false);
  assert.equal(isEditableLine('experiments.0'), false);

  const step = editLine(g, 'plan.linesOfOperation.0.criticalPath.0', 'b', 'a');
  assert.equal(step.goal.plan.linesOfOperation[0].criticalPath[0].label, 'b');

  const goal = editLine(g, 'goal', 'Open a third salon by March', 'Open a third salon');
  assert.equal(goal.goal.goal, 'Open a third salon by March');
  assert.match(editLine(g, 'goal', 'Open a third salon by March without burning out or losing Priya').errors[0].message, /10 words/);

  g = writeSection(g, 'subGoals', ['without burning out']).goal;
  assert.deepEqual(editLine(g, 'subGoals.0', 'without debt').goal.subGoals, ['without debt']);

  const hard = 'Notwithstanding considerable organizational complexity, institutional stakeholders systematically deprioritize operational accountability considerations.';
  assert.equal(editLine(g, 'subGoals.0', hard).ok, false);
});

test('addNextAction adds a pending move of the user\'s own, up to the cap', () => {
  const { addNextAction, NEXT_ACTIONS_MAX } = core;
  let g = writeSection(stubGoal('g'), 'plan', plan).goal;
  const r = addNextAction(g, 0, 'book the van');
  assert.equal(r.ok, true);
  assert.deepEqual(r.goal.plan.linesOfOperation[0].nextActions.at(-1), { action: 'book the van', who: 'me', status: 'pending' });
  assert.equal(addNextAction(g, 3, 'x').ok, false);
  g = r.goal;
  while (g.plan.linesOfOperation[0].nextActions.length < NEXT_ACTIONS_MAX) g = addNextAction(g, 0, 'more').goal;
  assert.match(addNextAction(g, 0, 'one too many').errors[0].message, /already has 5/);
});

test('editLine reaches risks, what a person is doing, and an open decision only', () => {
  const { editLine, isEditableLine, lineText } = core;
  let g = writeSection(stubGoal('g'), 'riskNotes', [{ item: 'the lease falls through', source: 'threat', accepted: false }]).goal;
  g = writeSection(g, 'people', [{ name: 'Priya', status: 'confirmed', doing: 'runs the front desk' }]).goal;
  g = writeSection(g, 'decisions', [
    { date: '2026-09-01', status: 'open', question: 'lease or buy the van' },
    { date: '2026-09-02', status: 'decided', choice: 'hire one stylist', reverseIf: 'bookings drop' },
  ]).goal;

  assert.equal(editLine(g, 'riskNotes.0', 'the landlord sells', 'the lease falls through').goal.riskNotes[0].item, 'the landlord sells');
  assert.equal(editLine(g, 'people.0.doing', 'runs the till', 'runs the front desk').goal.people[0].doing, 'runs the till');
  assert.equal(editLine(g, 'people.0', 'Pri', 'Priya').ok, false);
  assert.equal(isEditableLine('people.0'), false);

  assert.equal(editLine(g, 'decisions.0', 'rent or buy the van', 'lease or buy the van').goal.decisions[0].question, 'rent or buy the van');
  assert.equal(isEditableLine('decisions.1', g), false);
  assert.match(editLine(g, 'decisions.1', 'hire two', 'hire one stylist').errors[0].message, /through the chat/);
  assert.equal(lineText(g, 'decisions.1'), 'hire one stylist');
  assert.equal(lineText(g, 'people.0'), 'Priya');
  assert.equal(isEditableLine('forecasts.0'), false);
});

test('a plan written by a skill says on its focus line what happens if it stalls; a page edit is let through', () => {
  const flat = { linesOfOperation: [{ label: 'A', criticalPath: [{ label: 'a', status: 'pending' }], nextActions: [] }, { ...plan.linesOfOperation[0], label: 'B' }] };
  const r = writeSection(stubGoal('g'), 'plan', flat);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].path, 'plan.linesOfOperation.0');
  assert.match(r.errors[0].message, /"A" needs an if-then/);
  // The focus line, not the first, is the one that needs it.
  const focusB = { linesOfOperation: [flat.linesOfOperation[0], { ...flat.linesOfOperation[1], focus: true }] };
  assert.equal(writeSection(stubGoal('g'), 'plan', focusB).ok, true);
  // An older plan with no if-then still takes the user's own edits.
  const legacy = { ...stubGoal('g'), plan: goalSchema.shape.plan.parse(flat) };
  assert.equal(core.editLine(legacy, 'plan.linesOfOperation.0.criticalPath.0', 'b', 'a').ok, true);
  assert.equal(core.addNextAction(legacy, 0, 'book the van').ok, true);
});

const rung = (over) => ({ level: 'interests', action: 'send letter', to: 'Council', waitDays: 14, ...over });
const withLadder = (ladder) => ({ linesOfOperation: [{ label: 'Council', criticalPath: [], nextActions: [], ladder }] });
const mapped = { ...stubGoal('g'), stakeholders: [{ name: 'Council', power: 'high', stanceCurrent: 'unaware', stanceTarget: 'acts', via: 'complaints line' }], people: [{ name: 'Sam', status: 'confirmed', doing: 'takes photos' }] };

test('a ladder names people the goal knows, climbs in order, and has one rung out at a time', () => {
  assert.equal(writeSection(mapped, 'plan', withLadder([rung(), rung({ level: 'power', to: 'sam', action: 'post photos' })])).ok, true);
  const stranger = writeSection(mapped, 'plan', withLadder([rung({ to: 'Mayor' })]));
  assert.equal(stranger.ok, false);
  assert.equal(stranger.errors[0].path, 'plan.linesOfOperation.0.ladder.0.to');
  const down = writeSection(mapped, 'plan', withLadder([rung({ level: 'rights' }), rung({ action: 'ask nicely' })]));
  assert.equal(down.ok, false);
  assert.match(down.errors[0].message, /interests rung can't follow a rights one/);
  const twoOut = writeSection(mapped, 'plan', withLadder([rung({ status: 'sent' }), rung({ level: 'rights', action: 'complain', status: 'sent' })]));
  assert.equal(twoOut.ok, false);
  assert.match(twoOut.errors[0].message, /one rung can be sent/);
  assert.equal(writeSection(mapped, 'plan', withLadder([rung({ waitDays: 0 })])).ok, false);
});

test('a rung going out is stamped sentOn, and keeps it across a rewrite', () => {
  const sent = writeSection(mapped, 'plan', withLadder([rung({ status: 'sent' }), rung({ level: 'rights', action: 'complain' })]), '2026-10-01T09:00:00Z');
  const ladder = (r) => r.goal.plan.linesOfOperation[0].ladder;
  assert.equal(ladder(sent)[0].sentOn, '2026-10-01');
  assert.equal(ladder(sent)[1].sentOn, undefined);
  const again = writeSection(sent.goal, 'plan', withLadder([rung({ status: 'unanswered' }), rung({ level: 'rights', action: 'complain', status: 'sent' })]), '2026-10-16T09:00:00Z');
  assert.deepEqual(ladder(again).map((r) => r.sentOn), ['2026-10-01', '2026-10-16']);
  const reset = writeSection(again.goal, 'plan', withLadder([rung({ status: 'pending', sentOn: '2026-10-01' })]));
  assert.equal(ladder(reset)[0].sentOn, undefined);
});

test('setStatus climbs a ladder and settles a decision point', () => {
  const g = writeSection(mapped, 'plan', {
    linesOfOperation: [{
      label: 'Council', criticalPath: [], nextActions: [],
      decisionPoints: [{ if: 'no reply by 20 Oct', then: 'start the petition' }],
      ladder: [rung(), rung({ level: 'rights', action: 'complain' })],
    }],
  }).goal;
  const path = (i) => `plan.linesOfOperation.0.ladder.${i}`;
  const first = setStatus(g, path(0), 'sent', '2026-10-01');
  assert.equal(first.ok, true);
  assert.equal(first.goal.plan.linesOfOperation[0].ladder[0].sentOn, '2026-10-01');
  // The next rung going out marks the silent one unanswered.
  const climbed = setStatus(first.goal, path(1), 'sent', '2026-10-16').goal.plan.linesOfOperation[0].ladder;
  assert.deepEqual(climbed.map((r) => [r.status, r.sentOn]), [['unanswered', '2026-10-01'], ['sent', '2026-10-16']]);
  assert.equal(setStatus(first.goal, path(0), 'answered', '2026-10-05').goal.plan.linesOfOperation[0].ladder[0].sentOn, '2026-10-01');
  assert.equal(setStatus(first.goal, path(0), 'pending').goal.plan.linesOfOperation[0].ladder[0].sentOn, undefined);
  assert.match(setStatus(g, path(0), 'done').errors[0].message, /a ladder rung takes one of pending, sent, answered, unanswered, skipped/);
  const dp = 'plan.linesOfOperation.0.decisionPoints.0';
  assert.equal(setStatus(g, dp, 'taken').goal.plan.linesOfOperation[0].decisionPoints[0].status, 'taken');
  assert.equal(setStatus(g, dp, 'sent').ok, false);
  assert.equal(setStatus(g, 'plan.linesOfOperation.0', 'taken').ok, false);
  assert.equal(core.lineText(g, path(1)), 'complain');
  assert.equal(core.lineText(g, dp), 'no reply by 20 Oct');
  assert.equal(core.isEditableLine(path(1)), false);
});

test('a ladder rung naming someone the goal no longer holds is flagged', () => {
  const g = writeSection(mapped, 'plan', withLadder([rung()])).goal;
  const r = writeSection(g, 'stakeholders', []);
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => /to "Council" matches no people or stakeholders name/.test(w)));
});

test('an if-then is two short phrases the page can label', () => {
  const write = (decisionPoints, ladder) => writeSection(mapped, 'plan', { linesOfOperation: [{ label: 'L', criticalPath: [], nextActions: [], decisionPoints, ...(ladder ? { ladder } : {}) }] });
  assert.equal(write([{ if: 'under 5 residents signed', then: 'door-knock the street first' }]).ok, true);
  const long = write([{ if: 'Council offers another one-off clean-up of the tunnel this month', then: 'Take the clean, keep the chase and the signs and bins ask on the record' }]);
  assert.equal(long.ok, false);
  assert.deepEqual(long.errors.map((e) => e.path), ['plan.linesOfOperation.0.decisionPoints.0.if', 'plan.linesOfOperation.0.decisionPoints.0.then']);
  assert.match(long.errors[1].message, /15 words; keep it to 8 or fewer/);
  const led = write([{ if: 'If two photos are missed', then: 'then restart the baseline' }]);
  assert.deepEqual(led.errors.map((e) => e.message), ['drop the leading "if"; the page adds it', 'drop the leading "then"; the page adds it']);
  assert.match(write([{ if: 'photos missed', then: 'restart: new week one' }]).errors[0].message, /no colon/);
  assert.equal(write([{ if: 'iffy weather', then: 'thence onward' }]).ok, true);
  assert.equal(write([{ if: 'x', then: 'y' }], [rung({ action: 'Send the letter of complaint with photos and the reference number' })]).ok, false);
});

test('a checkpoint starts in lower case unless it starts with a name', () => {
  const g = { ...mapped, stakeholders: [...mapped.stakeholders, { name: 'Rail Corp', power: 'high', stanceCurrent: 'silent', stanceTarget: 'acts', via: 'complaints' }] };
  const points = [
    { if: 'Two weekly photos get missed', then: 'Restart the baseline' },
    { if: 'Council offers a one-off clean', then: 'Ask for the date in writing' },
    { if: "Rail's written refusal arrives", then: 'TfNSW gets the trail' },
    { if: 'Friday rain over 50%', then: 'I move it indoors' },
  ];
  const r = writeSection(g, 'plan', { linesOfOperation: [{ label: 'L', criticalPath: [], nextActions: [], decisionPoints: points }] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.goal.plan.linesOfOperation[0].decisionPoints.map((d) => [d.if, d.then]), [
    ['two weekly photos get missed', 'restart the baseline'],
    ['Council offers a one-off clean', 'ask for the date in writing'],
    ["Rail's written refusal arrives", 'TfNSW gets the trail'],
    ['Friday rain over 50%', 'I move it indoors'],
  ]);
});

test('a ladder never climbs to the user, and a checkpoint never repeats a rung', () => {
  const me = writeSection(mapped, 'plan', withLadder([rung({ to: 'me', action: 'take the weekly photos' })]));
  assert.equal(me.ok, false);
  assert.match(me.errors[0].message, /never the user/);
  const twice = writeSection(mapped, 'plan', {
    linesOfOperation: [{
      label: 'L', criticalPath: [], nextActions: [],
      ladder: [rung(), rung({ level: 'rights', action: 'complaint to the head', to: 'Sam' })],
      decisionPoints: [{ if: 'six weeks of silence', then: 'Sam gets the paper trail' }, { if: 'under five signatures', then: 'door-knock the street first' }],
    }],
  });
  assert.equal(twice.ok, false);
  assert.deepEqual(twice.errors.map((e) => e.path), ['plan.linesOfOperation.0.decisionPoints.0.then']);
  assert.match(twice.errors[0].message, /the ladder already takes this to Sam/);
});

test('a checkpoint forks: a move that happens either way is refused', () => {
  const write = (then) => writeSection(mapped, 'plan', { linesOfOperation: [{ label: 'L', criticalPath: [], nextActions: [], decisionPoints: [{ if: 'under five residents signed', then }] }] });
  for (const then of ['send the follow-up anyway', 'take the clean, keep chasing', 'still send the letters', 'continue as planned', 'carry on regardless']) {
    const r = write(then);
    assert.equal(r.ok, false, then);
    assert.match(r.errors[0].message, /forks nothing/);
  }
  assert.equal(write('door-knock the street first').ok, true);
  assert.equal(write('rethink the approach').ok, true);
});

test('a checkpoint says what happened, not what is missing', () => {
  const write = (cond) => writeSection(mapped, 'plan', { linesOfOperation: [{ label: 'L', criticalPath: [], nextActions: [], decisionPoints: [{ if: cond, then: 'ask Cr Blackmore to raise it' }] }] });
  for (const cond of ["council's reply names no chase to rail", 'council sets no date', 'the reply has no date']) {
    const r = write(cond);
    assert.equal(r.ok, false, cond);
    assert.match(r.errors[0].message, /names something missing/);
  }
  assert.equal(write("the council hasn't asked Sydney Trains to act").ok, true);
  assert.equal(write('no reply to the letter in 3 weeks').ok, true);
});
