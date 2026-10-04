import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stubGoal, isStub, skillFlow, canLoad, canWrite, canRoute, routedText, writersOf, suggestSkills, dueNow, staleSections, methodStep, methodText, PHASES } from '../src/index.mjs';

const skills = [
  skillFlow('intake', { writes: 'goal, successCriteria, log', requires: 'any', phase: 'define' }),
  skillFlow('plan', { writes: 'plan, log', next: 'decide, threat', phase: 'plan' }),
  skillFlow('review', { writes: 'plan, riskNotes, log', phase: 'run' }),
  skillFlow('brief', { phase: 'any' }),
  skillFlow('elicit', { requires: 'any', checkpoint: 'true', phase: 'any' }),
  skillFlow('sitrep', { writes: 'log', phase: 'run' }),
  skillFlow('capacity', { writes: 'capacity, log', phase: 'understand' }),
];
const defined = { ...stubGoal('g'), successCriteria: [{ text: 'ship it', kind: 'control' }] };
const branch = { decisionPoints: [{ if: 'no word by Friday', then: 'call them', status: 'open' }] };
const plan = { linesOfOperation: [{ label: 'L', criticalPath: [], nextActions: [], ...branch }] };

test('skillFlow parses lists and flags bad keys and requires', () => {
  assert.deepEqual(skills[1].writes, ['plan', 'log']);
  assert.deepEqual(skills[1].next, ['decide', 'threat']);
  assert.equal(skills[1].requires, 'goal');
  assert.equal(skills[4].checkpoint, true);
  assert.deepEqual(skills[1].errors, []);
  assert.equal(skills[1].phase, 'plan');
  assert.equal(skillFlow('x', { writes: 'plan, nope', requires: 'maybe', phase: 'plan' }).errors.length, 2);
  assert.deepEqual(skillFlow('x', { writes: 'plan', reads: 'posture, log', phase: 'plan' }).errors, ['reads: "log" is not a writable goal key']);
  assert.equal(skillFlow('x', { writes: 'log', reads: 'posture', phase: 'run' }).errors.length, 1);
  assert.match(skillFlow('x', {}).errors[0], /^phase: must be one of define, understand/);
  assert.match(skillFlow('x', { phase: 'later' }).errors[0], /^phase:/);
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
  assert.deepEqual(suggestSkills(defined, '2026-10-02'), [{ skill: 'strategy', why: 'no focus set yet', todo: 'Set the focus' }]);

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
    { skill: 'forecast', why: '1 forecast ready to score', todo: 'Score a forecast' },
    { skill: 'decide', why: '1 open decision waiting', todo: 'Settle an open decision' },
    { skill: 'strategy', why: 'focus last reviewed 62 days ago', todo: 'Review your focus' },
    { skill: 'eval', why: 'no progress check yet', todo: 'Check progress' },
  ]);
  const checked = { ...g, log: [...g.log, { date: '2026-09-28', focus: null, notes: [], source: 'eval' }] };
  assert.equal(suggestSkills(checked, '2026-10-02').some((s) => s.skill === 'eval'), false);
  assert.equal(suggestSkills({ ...g, capacity: null }, '2026-10-02').at(-1).skill, 'capacity');
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
    plan: { linesOfOperation: [{ label: 'L', criticalPath: [], ...branch, nextActions: [
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
    { skill: 'recon', why: '1 open question due', todo: 'Answer an open question' },
    { skill: 'negotiate', why: 'talk with Priya on 30 Sep needs its outcome recorded', todo: 'Record how the talk with Priya went' },
    { skill: 'premortem', why: 'deadline in 10 days, no premortem yet', todo: 'Find what could sink this before the deadline' },
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

test('methodStep walks the method, asking only what the goal calls for', () => {
  const day = '2026-10-02';
  const step = (g) => { const { phase, skill } = methodStep(g); return skill ? `${phase}:${skill}` : phase; };
  assert.deepEqual(PHASES, ['define', 'understand', 'direct', 'develop', 'plan', 'stress', 'run']);
  assert.equal(step(stubGoal('g')), 'define:intake');

  // A campaign: it rests on the council's decision.
  const campaign = { ...defined, successCriteria: [{ text: 'council cleans it', kind: 'influence' }] };
  assert.equal(step(campaign), 'understand:stakeholders');
  const mapped = { ...campaign, stakeholders: [{ name: 'Council', power: 'high', stanceCurrent: 'unaware', stanceTarget: 'acts', via: 'complaints line' }] };
  assert.equal(step(mapped), 'direct:strategy');
  const focused = { ...mapped, log: [{ date: day, focus: 'get the council to act', notes: [], source: 'strategy' }] };
  assert.equal(step(focused), 'develop:options');
  const compared = { ...focused, courses: [{ name: 'Complain', idea: 'formal complaint' }, { name: 'Press', idea: 'go to the paper' }] };
  assert.equal(methodStep(compared).why, 'routes compared, none chosen');
  const chosen = { ...compared, courses: [{ ...compared.courses[0], chosen: true }, compared.courses[1]] };
  assert.equal(step(chosen), 'plan:plan');
  const flat = { ...chosen, plan: { linesOfOperation: [{ label: 'Council', criticalPath: [], nextActions: [] }] } };
  assert.deepEqual(methodStep(flat), { phase: 'plan', skill: 'plan', why: '"Council" has no if-then yet', todo: 'Decide what happens if it stalls' });
  const rungs = [
    { level: 'interests', action: 'send letter', to: 'Council', waitDays: 14, status: 'pending' },
    { level: 'power', action: 'go to the paper', to: 'Council', waitDays: 14, status: 'pending' },
  ];
  const laddered = { ...flat, plan: { linesOfOperation: [{ ...flat.plan.linesOfOperation[0], ladder: rungs }] } };
  assert.equal(step(laddered), 'stress:threat');
  const redTeamed = { ...laddered, riskNotes: [{ item: 'they stall', source: 'threat', accepted: false }] };
  assert.equal(step(redTeamed), 'stress:exposure');
  assert.equal(step({ ...redTeamed, exposure: [{ item: 'named in the paper', status: 'accepted' }] }), 'run');

  // A picnic: nothing rests on anyone else, so focus goes straight to plan,
  // and a plan with its if-then is ready to run.
  const picnic = { ...defined, log: [{ date: day, focus: 'book the spot', notes: [], source: 'strategy' }] };
  assert.equal(step(picnic), 'plan:plan');
  assert.equal(step({ ...picnic, plan }), 'run');
  assert.equal(methodText({ ...picnic, plan }), 'Method: run. Work the plan; loop back to strategy on a review, a stale focus or a branch taken.');
  assert.equal(methodText(picnic), 'Method: plan, next plan (no plan yet).');
});

test('canLoad warns when a skill skips ahead of the method, and still loads it', () => {
  const campaign = { ...defined, successCriteria: [{ text: 'council cleans it', kind: 'influence' }] };
  const r = canLoad(skills[1], campaign);
  assert.equal(r.ok, true);
  assert.match(r.warning, /the method is at understand \(1 criterion depends on others; no one mapped\); plan belongs to plan/);
  assert.equal(canLoad(skills[3], campaign).warning, undefined);
  assert.equal(canLoad(skills[6], campaign).warning, undefined);
  assert.equal(canLoad(skills[1], { ...defined, log: [{ date: '2026-10-01', focus: 'x', notes: [], source: 'strategy' }] }).warning, undefined);
});

test('suggestSkills flags a rung with no reply, an answer not recorded, and a decision point due', () => {
  const day = '2026-10-20';
  const g = {
    ...defined,
    posture: { current: { level: 1, label: 'steady' }, levels: [{ level: 1, label: 'steady' }], triggers: [], lastReviewed: '2026-10-19' },
    capacity: { availableHrsPerWeek: 5, runway: '3 months', lastReviewed: '2026-10-19' },
    log: [{ date: '2026-10-19', focus: null, notes: [], source: 'eval' }],
    riskNotes: [{ item: 'they stall', source: 'threat', accepted: false }],
    plan: { linesOfOperation: [{
      label: 'L', criticalPath: [], nextActions: [],
      decisionPoints: [{ if: 'under 10 names by 20 Oct', by: '2026-10-20', then: 'door-knock', status: 'open' }],
      ladder: [
        { level: 'interests', action: 'send letter', to: 'Council', waitDays: 14, status: 'sent', sentOn: '2026-10-01' },
        { level: 'rights', action: 'send the ref number', to: 'Head of council', waitDays: 14, status: 'pending' },
      ],
    }] },
  };
  assert.deepEqual(suggestSkills(g, day), [
    { skill: 'plan', why: 'no reply from Council in 19 days; next rung: Head of council', todo: 'Take it to Head of council' },
    { skill: 'plan', why: 'decision point due: under 10 names by 20 Oct', todo: 'Check: under 10 names by 20 Oct' },
  ]);
  assert.equal(suggestSkills(g, '2026-10-14').length, 0);
  const answered = structuredClone(g);
  answered.plan.linesOfOperation[0].ladder[0].status = 'answered';
  answered.plan.linesOfOperation[0].decisionPoints[0].status = 'passed';
  assert.deepEqual(suggestSkills(answered, day), [{ skill: 'plan', why: "Council answered; what they said isn't recorded", todo: 'Record what Council said' }]);
  const last = structuredClone(g);
  last.plan.linesOfOperation[0].ladder[1].status = 'skipped';
  assert.equal(suggestSkills(last, day)[0].why, 'no reply from Council in 19 days; no rung left');
});
