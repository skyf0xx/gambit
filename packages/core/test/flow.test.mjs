import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stubGoal, isStub, skillFlow, canLoad, canWrite, writersOf, suggestSkills } from '../src/index.mjs';

const skills = [
  skillFlow('intake', { writes: 'goal, successCriteria, log', requires: 'any' }),
  skillFlow('plan', { writes: 'plan, log', next: 'decide, threat' }),
  skillFlow('review', { writes: 'plan, riskNotes, log' }),
  skillFlow('brief', {}),
  skillFlow('elicit', { requires: 'any', checkpoint: 'true' }),
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
  assert.deepEqual(suggestSkills(stubGoal('g'), '2026-10-02'), [{ skill: 'intake', why: 'the goal is not defined yet' }]);
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
    { skill: 'forecast', why: '1 forecast ready to score' },
    { skill: 'decide', why: '1 open decision waiting' },
    { skill: 'strategy', why: 'focus last reviewed 62 days ago' },
    { skill: 'eval', why: 'no progress check yet' },
  ]);
  const checked = { ...g, log: [...g.log, { date: '2026-09-28', focus: null, notes: [], source: 'eval' }] };
  assert.equal(suggestSkills(checked, '2026-10-02').some((s) => s.skill === 'eval'), false);
  assert.equal(suggestSkills({ ...g, capacity: null }, '2026-10-02').at(-1).skill, 'capacity');
});
