#!/usr/bin/env node
// Smoke test for src/store/, run against a throwaway GAMBIT_HOME. This repo
// has no build/test step (AGENTS.md, "Working on this repo") — the store is
// its first real code, so this is the one thing worth checking mechanically.
//
// Usage: node scripts/check.mjs

import { mkdtempSync, rmSync, writeFileSync, statSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll checks passed.');
}
