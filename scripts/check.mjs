#!/usr/bin/env node
// Smoke test for src/store/ and src/visualize/, run against a throwaway
// GAMBIT_HOME. The skills themselves are prompt files with no build step
// (AGENTS.md, "Working on this repo"), but these two directories are real
// code, so this is the one thing worth checking mechanically.
//
// Usage: node scripts/check.mjs

import { mkdtempSync, rmSync, writeFileSync, statSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

process.emitWarning = (() => {
  const prev = process.emitWarning;
  return (warning, ...rest) => {
    const type = typeof rest[0] === 'string' ? rest[0] : rest[0]?.type;
    if (type === 'ExperimentalWarning' && String(warning).includes('SQLite')) return;
    prev.call(process, warning, ...rest);
  };
})();

const tmpRoot = mkdtempSync(join(tmpdir(), 'gambit-check-'));
process.env.GAMBIT_HOME = tmpRoot;

const store = await import('../src/store/index.mjs');
const { goalFile, activeFile } = await import('../src/store/paths.mjs');
const { goalSchema, safeParseGoalJson } = await import('../src/store/schema.mjs');

let failures = 0;
function check(label, cond) {
  if (cond) {
    console.log(`  ok    ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

console.log(`Using GAMBIT_HOME=${tmpRoot}\n`);

console.log('create + list:');
const slug = store.create('Test goal');
check('slug derived', slug === 'test-goal');
check('goal file written', statSync(goalFile(slug)).isFile());
check('set active', readFileSync(activeFile(), 'utf8').trim() === slug);

let goals = store.list();
check('list shows one goal', goals.length === 1 && goals[0].slug === slug);

console.log('\nreindex from scratch:');
rmSync(join(tmpRoot, 'gambit.db'));
store.reindex();
goals = store.list();
check('list identical after reindex', goals.length === 1 && goals[0].slug === slug && goals[0].title === 'Test goal');

console.log('\nhand-edit detection (ensureIndexFresh):');
const before = store.list()[0].title;
const stubBody = JSON.parse(readFileSync(goalFile(slug), 'utf8'));
stubBody.goal = 'Renamed goal';
writeFileSync(goalFile(slug), JSON.stringify(stubBody, null, 2) + '\n');
const after = store.list()[0].title;
check('title picked up without explicit reindex', before === 'Test goal' && after === 'Renamed goal');

console.log('\ninvalid GOAL.json is skipped, not fatal:');
const slugBad = store.create('Bad goal');
writeFileSync(goalFile(slugBad), JSON.stringify({ schemaVersion: 1, goal: 'Bad goal', deadline: 'next month' }, null, 2));
store.reindex();
const goalsAfterBad = store.list();
check('reindex does not throw on an invalid GOAL.json', true);
check('invalid goal skipped from the index', goalsAfterBad.every((g) => g.slug !== slugBad));
check('other goals still listed', goalsAfterBad.some((g) => g.slug === slug));
store.remove(slugBad);

console.log('\nsecond goal + switch:');
const slug2 = store.create('Second goal');
check('second goal becomes active', store.resolveActive() === slug2);
store.setActive(slug);
check('switch back', store.resolveActive() === slug);

console.log('\npath resolution:');
check('resolveActive matches switch target', store.resolveActive() === slug);

console.log('\ndelete one goal:');
store.remove(slug2);
check('goal file removed', !existsSync(goalFile(slug2)));
check('list no longer shows it', store.list().every((g) => g.slug !== slug2));
check('active goal untouched', store.resolveActive() === slug);

console.log('\ndelete active goal clears active pointer:');
store.remove(slug);
check('goal file removed', !existsSync(goalFile(slug)));
check('active pointer cleared', !existsSync(activeFile()));
check('resolveActive returns null', store.resolveActive() === null);

console.log('\ndelete all:');
const slugA = store.create('Goal A');
const slugB = store.create('Goal B');
const deleted = store.removeAll();
check('removeAll returns deleted slugs', deleted.includes(slugA) && deleted.includes(slugB));
check('list is empty', store.list().length === 0);
check('active pointer cleared', !existsSync(activeFile()));
check('goal dirs removed', !existsSync(goalFile(slugA)) && !existsSync(goalFile(slugB)));

rmSync(tmpRoot, { recursive: true, force: true });

console.log('\nschema validation:');
check(
  'invalid deadline rejected',
  !safeParseGoalJson({ schemaVersion: 1, goal: 'x', successCriteria: [{ text: 'y', kind: 'control' }], deadline: 'next month', people: [], posture: null, plan: null, systemsNotes: null, riskNotes: [], criteriaStatus: [], stakeholders: [], exposure: [], capacity: null, forecasts: [], experiments: [], decisions: [], log: [] }).success
);
check(
  'invalid deadline error mentions the field',
  safeParseGoalJson({ schemaVersion: 1, goal: 'x', successCriteria: [{ text: 'y', kind: 'control' }], deadline: 'next month', people: [], posture: null, plan: null, systemsNotes: null, riskNotes: [], criteriaStatus: [], stakeholders: [], exposure: [], capacity: null, forecasts: [], experiments: [], decisions: [], log: [] }).error.includes('deadline')
);
check(
  'unreal calendar date rejected',
  !safeParseGoalJson({ schemaVersion: 1, goal: 'x', successCriteria: [{ text: 'y', kind: 'control' }], deadline: '2026-02-30', people: [], posture: null, plan: null, systemsNotes: null, riskNotes: [], criteriaStatus: [], stakeholders: [], exposure: [], capacity: null, forecasts: [], experiments: [], decisions: [], log: [] }).success
);
check(
  'invalid enum value rejected',
  !safeParseGoalJson({ schemaVersion: 1, goal: 'x', successCriteria: [{ text: 'y', kind: 'sideways' }], deadline: null, people: [], posture: null, plan: null, systemsNotes: null, riskNotes: [], criteriaStatus: [], stakeholders: [], exposure: [], capacity: null, forecasts: [], experiments: [], decisions: [], log: [] }).success
);

console.log('\nvisualize: registry <-> SKILL.md frontmatter consistency:');
const { SECTION_RENDERERS } = await import('../src/visualize/registry.mjs');
const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(__dirname, '..', 'skills');
const skillNames = readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== '_shared')
  .map((e) => e.name);
const validRenderers = new Set(['lines-of-operation', 'checklist', 'network', 'timeline', 'decision-fork', 'plain-card']);
let missingDisplay = 0;
let invalidDisplay = 0;
for (const name of skillNames) {
  const body = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
  const match = body.match(/^display:\s*(\S+)/m);
  if (!match) missingDisplay++;
  else if (!validRenderers.has(match[1])) invalidDisplay++;
}
check('every skill declares a display type', missingDisplay === 0);
check('every declared display type is one of the six renderers', invalidDisplay === 0);
check('registry only maps to the six renderer types', Object.values(SECTION_RENDERERS).every((r) => validRenderers.has(r)));

console.log('\nvisualize: schema keys <-> skills cross-check:');
const schemaKeys = new Set(Object.keys(goalSchema.shape));
let undeclaredKeys = 0;
for (const name of skillNames) {
  const body = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
  // Every fenced ```json block under an "Update GOAL.json" step declares the
  // key(s) it owns as top-level object keys — cross-check those against the
  // schema so a skill can't silently drift out of sync with it.
  const blocks = [...body.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  for (const block of blocks) {
    try {
      const obj = JSON.parse(block);
      for (const key of Object.keys(obj)) {
        if (!schemaKeys.has(key)) {
          console.error(`  FAIL  ${name}/SKILL.md declares undeclared schema key "${key}"`);
          undeclaredKeys++;
        }
      }
    } catch {
      // Not every fenced json block is a strict single-object example
      // (some show partial/illustrative shapes) — skip ones that don't parse.
    }
  }
}
check('every skill-declared JSON key exists in goalSchema', undeclaredKeys === 0);

console.log('\nvisualize: parse + render against representative fixtures:');
const { parseGoalMd } = await import('../src/visualize/parse.mjs');
const { renderGoal } = await import('../src/visualize/render.mjs');

const fixtureObj = {
  schemaVersion: 1,
  goal: 'A short test goal for the visualize smoke test.',
  successCriteria: [
    { text: 'First criterion', kind: 'control' },
    { text: 'Second criterion', kind: 'influence' },
  ],
  deadline: '2026-12-31',
  people: [],
  posture: null,
  plan: { criticalPath: ['A', 'B', 'C'], nextActions: [] },
  systemsNotes: null,
  riskNotes: [{ item: 'Some risk', detail: 'likelihood low', source: 'threat', accepted: false }],
  criteriaStatus: [
    { text: 'First criterion', kind: 'control', status: 'on_track' },
    { text: 'Second criterion', kind: 'influence', status: 'at_risk' },
  ],
  stakeholders: [
    { name: 'Ally org', power: 'high', stanceCurrent: 'supportive', stanceTarget: 'supportive', via: 'nothing' },
  ],
  exposure: [],
  capacity: null,
  forecasts: [],
  experiments: [],
  decisions: [{ date: '2026-01-01', choice: 'Chose X over Y', reverseIf: 'Z happens' }],
  log: [
    { date: '2026-01-01', assessment: 'on_track', focus: 'concentrate on the wrapped focus line', notes: ['tests log entry'] },
    { date: '2026-01-02', assessment: 'at_risk', focus: null, notes: ['a later entry with no focus'] },
  ],
};
const fixture = JSON.stringify(fixtureObj);

const parsed = parseGoalMd(fixture);
check('title parsed', parsed.title === fixtureObj.goal);
check('deadline parsed', parsed.deadline === '2026-12-31');
check('criteria parsed with control/influence', parsed.criteria.length === 2 && parsed.criteria[0].kind === 'control' && parsed.criteria[1].kind === 'influence');
check('sections exclude empty/null owned keys', parsed.sections.every((s) => s.data != null && (Array.isArray(s.data) ? s.data.length > 0 : true)));
check('focus is most recent non-null log entry focus', parsed.focus === 'concentrate on the wrapped focus line');

const rendered = renderGoal(fixture);
const byTitle = Object.fromEntries(rendered.cards.map((c) => [c.title, c]));
check('Plan renders as mermaid lines-of-operation', byTitle['Plan']?.kind === 'mermaid' && byTitle['Plan'].body.includes('flowchart LR'));
check('Criteria status renders as html checklist', byTitle['Criteria status']?.kind === 'html' && byTitle['Criteria status'].body.includes('checklist'));
check('Stakeholders renders as mermaid network', byTitle['Stakeholders']?.kind === 'mermaid' && byTitle['Stakeholders'].body.includes('center'));
check('Risk notes renders as mermaid network', byTitle['Risk notes']?.kind === 'mermaid');
check('Decisions renders as mermaid decision-fork', byTitle['Decisions']?.kind === 'mermaid' && byTitle['Decisions'].body.includes('Decision'));
check('no card exceeds a sane line count (stays legible, not overdrawn)', rendered.cards.every((c) => c.body.split('\n').length <= 20));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll checks passed.');
}
