import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stubGoal, isStub, skillFlow, canLoad, canWrite, canRoute, routedText, writersOf, suggestSkills, dueNow, staleSections } from '../src/index.mjs';

const skills = [
  skillFlow('intake', { writes: 'goal, successCriteria, log', requires: 'any' }),
  skillFlow('plan', { writes: 'plan, log', next: 'decide, threat' }),
  skillFlow('review', { writes: 'plan, riskNotes, log' }),
  skillFlow('brief', {}),
  skillFlow('elicit', { requires: 'any', checkpoint: 'true' }),
  skillFlow('sitrep', { writes: 'log' }),
  skillFlow('capacity', { writes: 'capacity, log' }),
];
const defined = { ...stubGoal('g'), successCriteria: [{ text: 'ship it', kind: 'control' }] };
const plan = { linesOfOperation: [{ label: 'L', criticalPath: [], nextActions: [] }] };

test('skillFlow parses lists and flags bad keys and requires', () => {
  assert.deepEqual(skills[1].writes, ['plan', 'log']);
  assert.deepEqual(skills[1].next, ['decide', 'threat']);
  assert.equal(skills[1].requires, 'goal');
  assert.equal(skills[4].checkpoint, true);
  assert.deepEqual(skills[1].errors, []);
  assert.equal(skillFlow('x', { writes: 'plan, nope', requires: 'maybe' }).errors.length, 2);
  assert.deepEqual(skillFlow('x', { writes: 'plan', reads: 'posture, log' }).errors, ['reads: "log" is not a writable goal key']);
  assert.equal(skillFlow('x', { writes: 'log', reads: 'posture' }).errors.length, 1);
  assert.deepEqual(writersOf('plan', skills), ['plan', 'review']);
});

test('canLoad holds a goal-requiring skill back from a stub', () => {
  assert.equal(isStub(stubGoal('g')), true);
  assert.equal(isStub(defined), false);
  const r = canLoad(skills[3], stubGoal('g'));
  assert.equal(r.ok, false);
  assert.match(r.error, /intake/);
  assert.equal(canLoad(skills[0], stubGoal('g')).ok, true);
  assert.equal(canLoad(skills[3], defined).ok, true);
});

test('canWrite needs an active skill that declares the key', () => {
  assert.match(canWrite({ fresh: [] }, 'plan', 'set_status', skills).error, /no skill is active.*plan or review/);
  assert.match(canWrite({ active: 'brief', fresh: [] }, 'plan', 'set_status', skills).error, /brief does not write plan/);
  assert.equal(canWrite({ active: 'plan', fresh: [] }, 'plan', 'write_section', skills).ok, true);
  assert.equal(canWrite({ active: 'review', fresh: [] }, 'riskNotes', 'write_section', skills).ok, true);
});

test('canWrite holds a write_section back in the turn its skill loaded', () => {
  const s = { active: 'plan', fresh: ['plan'] };
  assert.match(canWrite(s, 'plan', 'write_section', skills).error, /confirm/);
  assert.equal(canWrite(s, 'plan', 'set_status', skills).ok, true);
  assert.equal(canWrite(s, 'log', 'append_log', skills).ok, true);
});

test('a checkpoint keeps its caller\'s write rights', () => {
  assert.equal(canWrite({ active: 'elicit', caller: 'plan', fresh: ['elicit'] }, 'plan', 'write_section', skills).ok, true);
  assert.equal(canWrite({ active: 'elicit', caller: 'plan', fresh: [] }, 'riskNotes', 'write_section', skills).ok, false);
  assert.equal(canWrite({ active: 'elicit', fresh: [] }, 'plan', 'write_section', skills).ok, false);
});

test('suggestSkills reads what is due from the goal', () => {
  assert.deepEqual(suggestSkills(stubGoal('g'), '2026-10-02'), [{ skill: 'intake', why: 'the goal is not defined yet', todo: 'Define the goal' }]);
  assert.deepEqual(suggestSkills(defined, '2026-10-02').map((s) => s.skill), ['strategy', 'plan']);

  const g = {
    ...defined,
    plan,
    posture: { current: { level: 1, label: 'steady' }, levels: [{ level: 1, label: 'steady' }], triggers: [], lastReviewed: '2026-08-01' },
    capacity: { availableHrsPerWeek: 5, runway: '3 months', lastReviewed: '2026-09-30' },
    forecasts: [
      { statement: 'a', probability: 60, resolvesBy: '2026-10-01', resolvesVia: 'x', resolved: false },
      { statement: 'b', probability: 60, resolvesBy: '2026-12-01', resolvesVia: 'x', resolved: false },
    ],
    experiments: [{ assumption: 'a', test: 't', passIf: 'p', by: '2026-09-01', done: true }],
    decisions: [{ date: '2026-09-01', status: 'open', question: 'q?' }],
    log: [{ date: '2026-09-01', focus: null, notes: [] }],
  };
  assert.deepEqual(suggestSkills(g, '2026-10-02'), [
    { skill: 'forecast', why: '1 forecast ready to score', todo: 'Score 1 forecast' },
    { skill: 'decide', why: '1 open decision waiting', todo: 'Settle 1 open decision' },
    { skill: 'strategy', why: 'focus last reviewed 62 days ago', todo: 'Review your focus' },
    { skill: 'eval', why: 'no progress check yet', todo: 'Check progress' },
    { skill: 'threat', why: 'plan not red-teamed yet', todo: 'Find weak spots in the plan' },
  ]);
  const checked = { ...g, log: [...g.log, { date: '2026-09-28', focus: null, notes: [], source: 'eval' }] };
  assert.equal(suggestSkills(checked, '2026-10-02').some((s) => s.skill === 'eval'), false);
  assert.equal(suggestSkills({ ...g, capacity: null }, '2026-10-02').at(-2).skill, 'capacity');
  assert.deepEqual(dueNow(g, '2026-10-02').map((s) => s.skill), ['forecast', 'decide', 'strategy']);
});

test('suggestSkills flags overdue moves, due questions, talks with no outcome, and unchecked risk', () => {
  const day = '2026-10-02';
  const g = {
    ...defined,
    successCriteria: [{ text: 'ship it', kind: 'control' }, { text: 'council says yes', kind: 'influence' }, { text: 'press runs it', kind: 'influence' }],
    deadline: '2026-10-12',
    posture: { current: { level: 1, label: 'steady' }, levels: [{ level: 1, label: 'steady' }], triggers: [], lastReviewed: '2026-10-01' },
    capacity: { availableHrsPerWeek: 5, runway: '3 months', lastReviewed: '2026-09-30' },
    plan: { linesOfOperation: [{ label: 'L', criticalPath: [], nextActions: [
      { action: 'a', who: 'me', when: '2026-10-01', status: 'pending' },
      { action: 'b', who: 'me', when: '2026-09-20', status: 'pending' },
      { action: 'c', who: 'me', when: '2026-10-02', status: 'pending' },
      { action: 'd', who: 'me', when: '2026-09-20', status: 'done' },
    ] }] },
    intel: [
      { question: 'q1', via: 'ask', status: 'open', by: '2026-10-02' },
      { question: 'q2', via: 'ask', status: 'answered', by: '2026-09-01' },
      { question: 'q3', via: 'ask', status: 'open' },
    ],
    prep: [
      { with: 'Priya', on: '2026-09-30', ask: 'a', batna: 'b', walkAway: 'w', concessions: [], done: false },
      { with: 'Dev', on: '2026-09-29', ask: 'a', batna: 'b', walkAway: 'w', concessions: [], done: true },
    ],
    log: [{ date: '2026-09-30', focus: null, notes: [], source: 'eval' }],
  };
  assert.deepEqual(suggestSkills(g, day), [
    { skill: 'plan', why: '2 moves overdue', todo: 'Catch up on 2 overdue moves' },
    { skill: 'recon', why: '1 open question due', todo: 'Answer 1 open question' },
    { skill: 'negotiate', why: 'talk with Priya on 30 Sep needs its outcome recorded', todo: 'Record how the talk with Priya went' },
    { skill: 'premortem', why: 'deadline in 10 days, no premortem yet', todo: 'Find what could sink this before the deadline' },
    { skill: 'threat', why: 'plan not red-teamed yet', todo: 'Find weak spots in the plan' },
    { skill: 'stakeholders', why: '2 criteria depend on others; no one mapped', todo: 'Map who else has a say' },
  ]);
  const twoTalks = { ...g, prep: g.prep.map((p) => ({ ...p, done: false })) };
  assert.equal(suggestSkills(twoTalks, day)[2].why, '2 talks need their outcomes recorded');
  const handled = {
    ...g,
    deadline: '2026-10-30',
    riskNotes: [{ item: 'x', source: 'threat', accepted: false }],
    stakeholders: [{ name: 'Council', power: 'high', stanceCurrent: 'unsure', stanceTarget: 'for', via: 'the clerk' }],
  };
  assert.deepEqual(suggestSkills(handled, day).map((s) => s.skill), ['plan', 'recon', 'negotiate']);
  assert.equal(suggestSkills({ ...g, deadline: day }, day)[3].why, 'deadline today, no premortem yet');
  assert.equal(suggestSkills({ ...g, riskNotes: [{ item: 'x', source: 'premortem', accepted: false }] }, day).some((s) => s.skill === 'premortem'), false);
  assert.equal(suggestSkills({ ...g, deadline: '2026-09-01' }, day).some((s) => s.skill === 'premortem'), false);
});

test('canRoute takes a routing only from sitrep, to skills that write', () => {
  const items = [{ skill: 'plan', update: 'the venue moved to Friday ' }, { skill: 'capacity', update: 'two hours a week less' }];
  assert.match(canRoute({ active: 'plan', fresh: [] }, items, skills).error, /only sitrep/);
  const r = canRoute({ active: 'sitrep', fresh: [] }, items, skills);
  assert.deepEqual(r, { ok: true, routed: [{ skill: 'plan', update: 'the venue moved to Friday' }, { skill: 'capacity', update: 'two hours a week less' }] });
  assert.match(canRoute({ active: 'sitrep', fresh: [] }, [{ skill: 'nope', update: 'x' }], skills).error, /no skill "nope"/);
  assert.match(canRoute({ active: 'sitrep', fresh: [] }, [{ skill: 'brief', update: 'x' }], skills).error, /writes nothing/);
  assert.match(canRoute({ active: 'sitrep', fresh: [] }, [{ skill: 'plan', update: ' ' }], skills).error, /empty/);
  assert.equal(canRoute({ active: 'sitrep', fresh: [] }, [], skills).ok, false);
  assert.equal(routedText(undefined), '');
  assert.equal(routedText(r.routed), 'Routed updates the user confirmed: plan — the venue moved to Friday; capacity — two hours a week less. Load each in turn and write it now; skip any the user just turned down.');
});

test('a routed skill the user confirmed writes in the turn it loads', () => {
  const s = { active: 'capacity', fresh: ['capacity'], cleared: ['plan', 'capacity'] };
  assert.equal(canWrite(s, 'capacity', 'write_section', skills).ok, true);
  assert.match(canWrite({ ...s, cleared: ['plan'] }, 'capacity', 'write_section', skills).error, /confirm/);
});

test('staleSections flags a section built before one of its inputs changed', () => {
  const flows = [
    skillFlow('systems', { writes: 'systemsNotes, log', reads: 'people, stakeholders' }),
    skillFlow('threat', { writes: 'riskNotes, log', reads: 'plan' }),
  ];
  const notes = { schwerpunkt: 's', confidence: 'high', topFindings: [], lastReviewed: '2026-09-01' };
  const g = {
    ...defined,
    plan,
    systemsNotes: notes,
    updated: { systemsNotes: '2026-09-01T10:00:00Z', people: '2026-09-02T10:00:00Z', stakeholders: '2026-09-03T10:00:00Z', plan: '2026-09-04T10:00:00Z' },
  };
  assert.deepEqual(staleSections(g, flows), [{ skill: 'systems', why: 'people and stakeholders changed since systems last ran', todo: 'Update the systems notes' }]);
  assert.deepEqual(staleSections({ ...g, updated: { ...g.updated, systemsNotes: '2026-09-05T10:00:00Z' } }, flows), []);
  // No stamp of its own: the section's lastReviewed stands in.
  const { systemsNotes: _, ...unstamped } = g.updated;
  assert.equal(staleSections({ ...g, updated: unstamped }, flows).length, 1);
  assert.deepEqual(staleSections({ ...g, systemsNotes: null }, flows), []);
  assert.equal(suggestSkills(g, '2026-10-02', flows).at(-1).skill, 'systems');
});
