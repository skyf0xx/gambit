import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stubGoal, writeSection, appendLog, setStatus, remember, forget, sameLine, MEMORY_CAP, LOG_NOTES_MAX, LOG_RECENT, summarizeChange, WRITABLE_KEYS, capLog, currentFocusEntry, LOG_CAP, GOAL_MAX_WORDS, goalSchema, readingGrade, READING_GRADE_MAX } from '../src/index.mjs';
import * as core from '../src/index.mjs';

const plan = {
  linesOfOperation: [{
    label: 'L', criticalPath: [{ label: 'a', status: 'pending', after: ['x'] }],
    nextActions: [{ id: 'x', action: 'do x', who: 'me', when: '2026-10-09' }, { action: 'do y', who: 'me', when: '2026-10-12', if: { event: 'no word by Friday' } }],
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
  const fork = { action: 'call them', who: 'me', if: { event: 'no word by Friday' } };
  const rewrite = (nextActions) => ({ linesOfOperation: [{ ...plan.linesOfOperation[0], criticalPath: [], nextActions: [...nextActions, fork] }] });
  const next = writeSection(g, 'plan', rewrite([
    { action: 'do x', who: 'me', status: 'done' },
    { action: 'do y', who: 'me', status: 'done' },
    { action: 'do z', who: 'me', status: 'pending', doneOn: '2026-10-02' },
  ]), '2026-10-03T09:00:00Z', '2026-10-03');
  assert.equal(next.ok, true);
  assert.deepEqual(actions(next.goal.plan).map((a) => a.doneOn), ['2026-10-01', '2026-10-03', undefined, undefined]);
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
  const line = (label) => ({ label, criticalPath: [], nextActions: plan.linesOfOperation[0].nextActions, focus: true });
  const r = writeSection(stubGoal('g'), 'plan', { linesOfOperation: [line('A'), line('B')] });
  assert.equal(r.ok, false);
  assert.equal(writeSection(stubGoal('g'), 'plan', { linesOfOperation: [line('A'), { label: 'B', criticalPath: [], nextActions: [] }] }).ok, true);
});

test('a proposed move needs its detail on write, but an older one without it still reads and can be kept', () => {
  const g = stubGoal('g');
  const withProposal = (detail) => ({
    linesOfOperation: [{ ...plan.linesOfOperation[0], criticalPath: [], nextActions: [{ action: 'call the landlord', who: 'me', when: '2026-10-09', status: 'proposed', detail }, plan.linesOfOperation[0].nextActions[1]] }],
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
  assert.match(addNextAction(g, 0, 'one too many').errors[0].message, /already has 10/);
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


const mapped = { ...stubGoal('g'), stakeholders: [{ name: 'Council', power: 'high', stanceCurrent: 'unaware', stanceTarget: 'acts', via: 'complaints line' }, { name: 'Rail Corp', power: 'high', stanceCurrent: 'silent', stanceTarget: 'acts', via: 'complaints' }] };
const letter = { id: 'letter', action: 'Send the complaint letter', who: 'me', to: 'Council', level: 'interests' };
const escalate = (over) => ({ id: 'ombuds', action: 'Complain to the Ombudsman', who: 'me', to: 'Rail Corp', level: 'rights', if: { noReply: 'letter', days: 14 }, ...over });
const line = (nextActions, over) => ({ linesOfOperation: [{ label: 'L', criticalPath: [], nextActions, ...over }] });
const errs = (r) => (r.ok ? [] : r.errors.map((e) => `${e.path}: ${e.message}`));

test('a plan written by a skill carries a conditional task on its focus line; a page edit is let through', () => {
  const flat = { linesOfOperation: [{ label: 'A', criticalPath: [{ label: 'a', status: 'done' }], nextActions: [] }, { label: 'B', criticalPath: [], nextActions: [letter, escalate()] }] };
  const r = writeSection(mapped, 'plan', flat);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].path, 'plan.linesOfOperation.0');
  assert.match(r.errors[0].message, /"A" needs a conditional task/);
  const focusB = { linesOfOperation: [flat.linesOfOperation[0], { ...flat.linesOfOperation[1], focus: true }] };
  assert.equal(writeSection(mapped, 'plan', focusB).ok, true);
  const legacy = { ...mapped, plan: goalSchema.shape.plan.parse(flat) };
  assert.equal(core.editLine(legacy, 'plan.linesOfOperation.0.criticalPath.0', 'b', 'a').ok, true);
  assert.equal(core.addNextAction(legacy, 0, 'book the van').ok, true);
});

test('task links point at real tasks, never loop, and ids are unique', () => {
  assert.deepEqual(errs(writeSection(mapped, 'plan', line([letter, escalate()]))), []);
  assert.match(errs(writeSection(mapped, 'plan', line([letter, escalate({ if: { noReply: 'nope', days: 14 } })])))[0], /noReply: no other task has id "nope"/);
  assert.match(errs(writeSection(mapped, 'plan', line([letter, escalate(), { action: 'x', who: 'me', after: ['gone'] }])))[0], /after\.0: no other task or milestone has id "gone"/);
  assert.match(errs(writeSection(mapped, 'plan', line([letter, escalate({ id: 'letter' })])))[0], /id "letter" is already used/);
  assert.match(errs(writeSection(mapped, 'plan', line([{ ...letter, after: ['ombuds'] }, escalate()]))).join(), /waits on itself/);
  assert.equal(writeSection(mapped, 'plan', line([letter, escalate({ id: 'Bad Id' })])).ok, false);
});

test('an escalation goes to someone mapped, never the user, and climbs', () => {
  assert.match(errs(writeSection(mapped, 'plan', line([letter, escalate({ to: 'me' })]))).join(), /never the user/);
  assert.match(errs(writeSection(mapped, 'plan', line([letter, escalate({ to: 'Mayor' })]))).join(), /"Mayor" is not in people or stakeholders/);
  assert.match(errs(writeSection(mapped, 'plan', line([letter, escalate({ level: undefined })]))).join(), /who it goes to \(to\) and how hard it pushes \(level\)/);
  assert.match(errs(writeSection(mapped, 'plan', line([{ ...letter, level: 'rights' }, escalate({ level: 'interests' })]))).join(), /one at "interests" can't follow one at "rights"/);
  assert.match(errs(writeSection(mapped, 'plan', line([{ ...letter, to: undefined, level: undefined }, escalate()]))).join(), /goes to no one, so it can't get a reply/);
  assert.match(errs(writeSection(mapped, 'plan', line([{ action: 'x', who: 'me', level: 'power', if: { event: 'rain' } }]))).join(), /a task on the ladder \(level\) is a message/);
});

test('a fork is a move made only if its event happens, said plainly', () => {
  const fork = (over) => ({ action: 'Door-knock the street first', who: 'me', if: { event: 'Under 10 sign-ups', by: '2026-11-01' }, ...over });
  const ok = writeSection(mapped, 'plan', line([fork(), fork({ action: 'Ask for the date in writing', if: { event: 'Council offers a one-off clean' } })]));
  assert.deepEqual(errs(ok), []);
  assert.deepEqual(ok.goal.plan.linesOfOperation[0].nextActions.map((a) => a.if.event), ['under 10 sign-ups', 'Council offers a one-off clean']);
  assert.match(errs(writeSection(mapped, 'plan', line([fork({ action: 'Send the follow-up anyway' })]))).join(), /forks nothing/);
  assert.match(errs(writeSection(mapped, 'plan', line([{ action: 'Send the follow-up letter', who: 'me' }, fork({ action: 'Send the follow-up letter' })]))).join(), /already happens whatever the condition/);
  assert.match(errs(writeSection(mapped, 'plan', line([fork({ if: { event: "council's reply names no chase to rail" } })]))).join(), /names something missing/);
  assert.match(errs(writeSection(mapped, 'plan', line([fork({ if: { event: 'if the council offers a one-off clean-up of the tunnel this month' } })]))).join(), /words; keep it to 8.*drop the leading "if"/);
});

test('markReplied and resolveFork settle a message and a fork from the page', () => {
  const g = writeSection(mapped, 'plan', line([letter, escalate(), { action: 'Door-knock the street first', who: 'me', if: { event: 'under 10 sign-ups' } }])).goal;
  const path = (i) => `plan.linesOfOperation.0.nextActions.${i}`;
  assert.match(core.markReplied(g, path(0)).errors[0].message, /not gone out yet/);
  const sent = setStatus(g, path(0), 'done', '2026-10-01').goal;
  const replied = core.markReplied(sent, path(0), '2026-10-05');
  assert.equal(replied.goal.plan.linesOfOperation[0].nextActions[0].replied, '2026-10-05');
  assert.match(core.markReplied(sent, path(2)).errors[0].message, /goes to no one/);
  assert.equal(core.resolveFork(g, path(2), true).goal.plan.linesOfOperation[0].nextActions[2].if.happened, true);
  assert.equal(core.resolveFork(g, path(2), false).goal.plan.linesOfOperation[0].nextActions[2].status, 'dropped');
  assert.match(core.resolveFork(g, path(1), true).errors[0].message, /waits on no event/);
});

test('a message to someone the goal no longer holds is flagged', () => {
  const g = writeSection(mapped, 'plan', line([letter, escalate()])).goal;
  const r = writeSection(g, 'stakeholders', []);
  assert.ok(r.warnings.some((w) => /to "Council" matches no people or stakeholders name/.test(w)));
});

test('a milestone comes after the tasks that reach it, sharing their ids', () => {
  const steps = (criticalPath, nextActions) => ({ linesOfOperation: [{ label: 'L', criticalPath, nextActions: [...nextActions, { action: 'Rethink the approach', who: 'me', if: { event: 'no date by December' } }] }] });
  const sign = { id: 'sign', action: 'Collect signatures', who: 'me' };
  const ok = writeSection(mapped, 'plan', steps([{ id: 'date', label: 'Clean-up date set', after: ['sign'] }], [sign, { action: 'Book the walk-through', who: 'me', after: ['date'] }]));
  assert.deepEqual(errs(ok), []);
  // A task waiting on a milestone is blocked until the milestone is reached.
  const plan = ok.goal.plan;
  assert.equal(core.taskState(plan.linesOfOperation[0].nextActions[1], plan, '2026-10-20'), 'blocked');
  assert.match(errs(writeSection(mapped, 'plan', steps([{ id: 'date', label: 'Date set', after: ['nope'] }], [sign]))).join(), /no task has id "nope"/);
  assert.match(errs(writeSection(mapped, 'plan', steps([{ id: 'sign', label: 'Date set' }], [sign]))).join(), /id "sign" is already used/);
  assert.match(errs(writeSection(mapped, 'plan', steps([{ id: 'date', label: 'Date set', after: ['sign'] }], [{ ...sign, after: ['date'] }]))).join(), /waits on itself/);
});

test('a milestone still ahead must list the tasks that reach it', () => {
  const r = writeSection(mapped, 'plan', line([letter, escalate()], { criticalPath: [{ label: 'Date set', status: 'pending' }, { label: 'Reached', status: 'done' }] }));
  assert.deepEqual(r.errors.map((e) => e.path), ['plan.linesOfOperation.0.criticalPath.0.after']);
  assert.match(r.errors[0].message, /"Date set" lists no tasks/);
});
