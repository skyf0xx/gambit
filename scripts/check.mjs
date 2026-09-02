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
writeFileSync(goalFile(slug), readFileSync(goalFile(slug), 'utf8').replace('Test goal', 'Renamed goal'));
const after = store.list()[0].title;
check('title picked up without explicit reindex', before === 'Test goal' && after === 'Renamed goal');

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

console.log('\nvisualize: parse + render against representative fixtures:');
const { parseGoalMd } = await import('../src/visualize/parse.mjs');
const { renderGoal } = await import('../src/visualize/render.mjs');

const fixture = `# Goal

A short test goal for the visualize smoke test.

## Success criteria
- First criterion — control
- Second criterion — influence

## Deadline
2026-12-31

## Plan
Critical path: [A] → [B] → [C]

## Criteria status
- First criterion — control — on_track
- Second criterion — influence — at_risk

## Stakeholders
- Ally org — power: high — stance: supportive → supportive — via nothing

## Risk notes
- Some risk — likelihood: low — mitigation: none needed

## Decisions
- [2026-01-01] Chose X over Y — reverse if: Z happens

## Log
- 2026-01-01 on_track — Focus: concentrate on the wrapped focus line that
  continues here — Why: tests multi-line log entry folding
- 2026-01-02 at_risk — a later entry with no Focus: mentioned at all
`;

const parsed = parseGoalMd(fixture);
check('title parsed', parsed.title.startsWith('A short test goal'));
check('shortTitle set and bounded', typeof parsed.shortTitle === 'string' && parsed.shortTitle.length <= 81);
check('deadline parsed', parsed.deadline === '2026-12-31');
check('criteria parsed with control/influence', parsed.criteria.length === 2 && parsed.criteria[0].kind === 'control' && parsed.criteria[1].kind === 'influence');
check('log/deadline/criteria excluded from body sections', parsed.sections.every((s) => !['Success criteria', 'Deadline', 'Log'].includes(s.heading)));
check('focus extracted from a wrapped log entry, most recent Focus: wins over a later entry with none', parsed.focus === 'concentrate on the wrapped focus line that continues here');
check('log entries excluded from visualizer output entirely (internal, not for display)', parsed.lastLogLine === undefined && parsed.lastLogFull === undefined);

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
