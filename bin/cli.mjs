#!/usr/bin/env node
// Gambit installer. Copies the skills/ payload into the current
// directory's .claude/skills/ (Claude Code discovery), and links the
// skill set into the project's AGENTS.md for any other agent that reads
// that file, so the skills travel with the project rather than living
// only in this package.
//
// Usage (as a global command after `npm install -g @skyf0xx/gambit`, or
// prefixed with `npx @skyf0xx/gambit` with no install step):
//   gambit init      install skills into ./.claude/skills
//   gambit init --force   overwrite files that differ
//   gambit update    re-copy the current package's skills
//   gambit --help

import { cp, mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

// node:sqlite emits an ExperimentalWarning the instant it's imported (Node
// 22.23.2, verified locally) — before any code in that module runs, so
// filtering process.emitWarning from inside src/store/db.mjs is too late.
// The store is imported dynamically, after the filter below is installed,
// so the warning never reaches the user on every CLI invocation.
const prevEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  const type = typeof rest[0] === 'string' ? rest[0] : rest[0]?.type;
  if (type === 'ExperimentalWarning' && String(warning).includes('SQLite')) return;
  prevEmitWarning.call(process, warning, ...rest);
};

const store = await import('../src/store/index.mjs');
const { goalFile } = await import('../src/store/paths.mjs');
const { safeParseGoalJson } = await import('../src/store/schema.mjs');
const { printNoticeIfDue } = await import('../src/store/updateCheck.mjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
const SRC_SKILLS = join(PKG_ROOT, 'skills');
const CWD = process.cwd();
const DEST_SKILLS = join(CWD, '.claude', 'skills');
const DEST_AGENTS_MD = join(CWD, 'AGENTS.md');
const CWD_GOAL_JSON = join(CWD, 'GOAL.json');

const MARKER_START = '<!-- gambit:skills start -->';
const MARKER_END = '<!-- gambit:skills end -->';

function help() {
  console.log(`
Gambit — strategic-advisor skills for an AI agent working a goal.

\`gambit\` below is the global command, available after:
  npm install -g @skyf0xx/gambit
\`npx @skyf0xx/gambit\` works the same way with no install step.

Legacy per-project install:
  gambit init [--force]   install skills into ./.claude/skills
  gambit update           re-copy skills from the installed package version

Global goal store (~/.gambit, or $GAMBIT_HOME):
  gambit list             goals, with active marked
  gambit new <title>      create a goal, make it active
  gambit switch <slug>    set the active goal
  gambit path             print the resolved GOAL.json path
  gambit reindex          rebuild gambit.db from goals/
  gambit check            validate the resolved GOAL.json against the
                          schema — run after any skill writes it
  gambit adopt [path]     move an existing ./GOAL.json into the store
  gambit delete <slug> --force   delete one goal (GOAL.json + index row)
  gambit delete --all --force    delete every goal in the store

  gambit visualize [--port N] [--no-open]
                          open a local live-updating diagram
                          view of the resolved GOAL.json

  gambit --help           show this message

Without --force, init will not overwrite a skill file that already
differs from the package's copy — pass --force to sync anyway.
`);
}

function formatGoalRow(g, activeSlug) {
  const mark = g.slug === activeSlug ? '*' : ' ';
  const deadline = g.deadline ? ` — due ${g.deadline}` : '';
  return `${mark} ${g.slug}  ${g.title}${deadline}`;
}

async function storeList() {
  const goals = store.list();
  const activeSlug = store.resolveActive();
  if (goals.length === 0) {
    console.log('No goals yet. Create one with: gambit new "<title>"');
    return;
  }
  for (const g of goals) console.log(formatGoalRow(g, activeSlug));
}

async function storeNew(title) {
  if (!title) {
    console.error('Usage: gambit new "<title>"');
    process.exitCode = 1;
    return;
  }
  const slug = store.create(title);
  console.log(`Created goal "${title}" (${slug}) and made it active.`);
  console.log(goalFile(slug));
}

async function storeSwitch(slug) {
  if (!slug) {
    console.error('Usage: gambit switch <slug>');
    process.exitCode = 1;
    return;
  }
  try {
    store.setActive(slug);
    console.log(`Active goal: ${slug}`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

// Same precedence rule documented in AGENTS.md / RESOLVING.md, all five
// cases: a CWD-local GOAL.json wins (case 1); otherwise the active goal in
// the store (case 2); otherwise, if exactly one goal exists in the store,
// it resolves to that goal and is set active so the next call resolves via
// case 2 (case 3). Returns null if none of those apply — either no goals
// exist anywhere (case 4) or several exist with none active (case 5);
// callers distinguish those two by checking store.list().length.
function resolveGoalPath() {
  if (existsSync(CWD_GOAL_JSON)) return CWD_GOAL_JSON;
  const slug = store.resolveActive();
  if (slug) return goalFile(slug);
  const goals = store.list();
  if (goals.length === 1) {
    store.setActive(goals[0].slug);
    return goalFile(goals[0].slug);
  }
  return null;
}

// Shared "couldn't resolve" message for storePath/storeCheck — cases 4
// (nothing exists) and 5 (several goals, none active) need different next
// steps, so this distinguishes them rather than printing one generic line.
function noGoalResolvedMessage() {
  const goals = store.list();
  if (goals.length === 0) {
    return 'No GOAL.json in the working directory and no goals in the store. Create one with: gambit new "<title>"';
  }
  const list = goals.map((g) => `  ${g.slug}  ${g.title}`).join('\n');
  return `No GOAL.json in the working directory and no active goal in the store. Several goals exist — pick one:\n${list}\n\nSwitch with: gambit switch <slug>`;
}

async function storePath() {
  const path = resolveGoalPath();
  if (!path) {
    console.error(noGoalResolvedMessage());
    process.exitCode = 1;
    return;
  }
  console.log(path);
}

// Validates the resolved GOAL.json against the schema — the same check
// the visualizer and `adopt` run, but on demand, right after a skill
// writes the file, instead of only surfacing at the next visualize/adopt.
async function storeCheck() {
  const path = resolveGoalPath();
  if (!path) {
    console.error(noGoalResolvedMessage());
    process.exitCode = 1;
    return;
  }

  if (!existsSync(path)) {
    console.error(`${path} does not exist.`);
    process.exitCode = 1;
    return;
  }

  const body = await readFile(path, 'utf8');
  const result = safeParseGoalJson(body);
  if (!result.success) {
    console.error(`${path} does not match the schema — fix it by hand and save.`);
    console.error(result.error);
    process.exitCode = 1;
    return;
  }

  console.log(`${path} is valid.`);
}

async function storeReindex() {
  store.reindex();
  console.log('Reindexed.');
}

async function storeAdopt(pathArg) {
  const src = pathArg ? join(CWD, pathArg) : CWD_GOAL_JSON;

  if (!existsSync(src)) {
    console.error(`No GOAL.json found at ${src}`);
    process.exitCode = 1;
    return;
  }

  const body = await readFile(src, 'utf8');
  const result = safeParseGoalJson(body);
  if (!result.success) {
    console.error(`Cannot adopt ${relative(CWD, src)} — invalid GOAL.json:`);
    console.error(`  ${result.error}`);
    process.exitCode = 1;
    return;
  }

  const slug = store.create(result.data.goal);
  await writeFile(goalFile(slug), JSON.stringify(result.data, null, 2) + '\n');
  store.reindex();
  store.setActive(slug);

  console.log(`Adopted ${relative(CWD, src)} into the store as "${slug}".`);
  console.log(`The original file at ${relative(CWD, src)} was left in place —`);
  console.log(`remove it yourself once you've confirmed the store copy is correct.`);
}

async function storeDelete(args, { force }) {
  const all = args.includes('--all');
  const slug = args.find((a) => a !== '--all' && a !== '--force');

  if (!all && !slug) {
    console.error('Usage: gambit delete <slug> --force\n       gambit delete --all --force');
    process.exitCode = 1;
    return;
  }

  if (!force) {
    console.error('Refusing to delete without --force (this permanently removes GOAL.json and cannot be undone).');
    process.exitCode = 1;
    return;
  }

  if (all) {
    const goals = store.list();
    if (goals.length === 0) {
      console.log('No goals to delete.');
      return;
    }
    const slugs = store.removeAll();
    console.log(`Deleted ${slugs.length} goal(s): ${slugs.join(', ')}`);
    return;
  }

  try {
    store.remove(slug);
    console.log(`Deleted goal "${slug}".`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

async function listSkillDirs() {
  const entries = await readdir(SRC_SKILLS, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  // skills/_shared/ holds RESOLVING.md, not a SKILL.md — it's referenced by
  // other skills, not a skill to install itself.
  const checks = await Promise.all(dirs.map((name) => stat(join(SRC_SKILLS, name, 'SKILL.md')).then(() => true, () => false)));
  return dirs.filter((_, i) => checks[i]);
}

async function filesDiffer(src, dest) {
  if (!existsSync(dest)) return true;
  const [ca, cb] = await Promise.all([readFile(src, 'utf8'), readFile(dest, 'utf8')]);
  return ca !== cb;
}

// Copies one file from the package into DEST_SKILLS, honoring --force the
// same way for every payload file (a SKILL.md or the shared resolution
// doc). Returns 'written', 'skipped', or 'unchanged'.
async function copyOne(relPath, { force }) {
  const srcPath = join(SRC_SKILLS, relPath);
  const destPath = join(DEST_SKILLS, relPath);
  const differs = await filesDiffer(srcPath, destPath);

  if (existsSync(destPath) && !differs) return 'unchanged';
  if (existsSync(destPath) && differs && !force) {
    console.log(`  skip   ${relative(CWD, destPath)} (differs from package — use --force to overwrite)`);
    return 'skipped';
  }

  await mkdir(dirname(destPath), { recursive: true });
  await cp(srcPath, destPath);
  console.log(`  write  ${relative(CWD, destPath)}`);
  return 'written';
}

async function copySkills({ force }) {
  await mkdir(DEST_SKILLS, { recursive: true });
  const names = await listSkillDirs();
  let written = 0;
  let skipped = 0;

  for (const name of names) {
    const result = await copyOne(join(name, 'SKILL.md'), { force });
    if (result === 'written') written++;
    if (result === 'skipped') skipped++;
  }

  // The four skills that reference the resolution rule (onboard, strategy,
  // status, brief) point at skills/_shared/RESOLVING.md by path — a
  // per-project install has to carry it too, or those references dangle.
  const sharedResult = await copyOne(join('_shared', 'RESOLVING.md'), { force });
  if (sharedResult === 'written') written++;
  if (sharedResult === 'skipped') skipped++;

  return { written, skipped, total: names.length };
}

function skillsSection(names) {
  const lines = names
    .slice()
    .sort()
    .map((n) => `- \`${n}\``)
    .join('\n');
  return `${MARKER_START}

## Gambit skills

This project has [Gambit](https://github.com/skyf0xx/gambit) installed —
a set of skills for working a goal (\`GOAL.json\`) as a strategic advisor
would: assessing progress, planning, red-teaming, researching, and more.
Skills live in \`.claude/skills/\` and are self-contained \`SKILL.md\`
files any capable agent can read directly, not just tools that
auto-discover that directory.

${lines}

Read the relevant \`.claude/skills/<name>/SKILL.md\` before acting on a
request that matches one of these triggers.

${MARKER_END}`;
}

async function upsertAgentsMd(names) {
  const section = skillsSection(names);

  if (!existsSync(DEST_AGENTS_MD)) {
    await writeFile(DEST_AGENTS_MD, `${section}\n`);
    console.log(`  write  AGENTS.md`);
    return;
  }

  const existing = await readFile(DEST_AGENTS_MD, 'utf8');
  const markerRe = new RegExp(`${escapeRe(MARKER_START)}[\\s\\S]*?${escapeRe(MARKER_END)}`);

  if (markerRe.test(existing)) {
    const updated = existing.replace(markerRe, section);
    if (updated !== existing) {
      await writeFile(DEST_AGENTS_MD, updated);
      console.log(`  update AGENTS.md (gambit section)`);
    }
    return;
  }

  const updated = `${existing.trimEnd()}\n\n${section}\n`;
  await writeFile(DEST_AGENTS_MD, updated);
  console.log(`  append AGENTS.md (gambit section)`);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function init({ force }) {
  console.log(`Installing Gambit skills into ${relative(CWD, DEST_SKILLS) || '.'}\n`);
  const { written, skipped, total } = await copySkills({ force });
  const names = await listSkillDirs();
  await upsertAgentsMd(names);

  console.log(`\n${written} written, ${skipped} skipped, ${total} skills total.`);
  if (skipped > 0) {
    console.log(`Run with --force to overwrite skipped files.`);
  }
  console.log(`\nNext: ask your agent to run the \`onboard\` skill to start a GOAL.json.`);
}

async function update() {
  return init({ force: true });
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const force = args.includes('--force');

  if (!cmd || cmd === '--help' || cmd === '-h') {
    help();
    return;
  }

  try {
    const pkg = JSON.parse(await readFile(join(PKG_ROOT, 'package.json'), 'utf8'));
    printNoticeIfDue(pkg.version);
  } catch {
    // Never let the update check block or fail a real command.
  }

  if (cmd === 'init') {
    await init({ force });
    return;
  }

  if (cmd === 'update') {
    await update();
    return;
  }

  if (cmd === 'list') {
    await storeList();
    return;
  }

  if (cmd === 'new') {
    await storeNew(args.slice(1).join(' '));
    return;
  }

  if (cmd === 'switch') {
    await storeSwitch(args[1]);
    return;
  }

  if (cmd === 'path') {
    await storePath();
    return;
  }

  if (cmd === 'reindex') {
    await storeReindex();
    return;
  }

  if (cmd === 'check') {
    await storeCheck();
    return;
  }

  if (cmd === 'adopt') {
    await storeAdopt(args[1]);
    return;
  }

  if (cmd === 'delete') {
    await storeDelete(args.slice(1), { force });
    return;
  }

  if (cmd === 'visualize') {
    const { startServer, killExistingOnPort } = await import('../src/visualize/server.mjs');
    const portArg = args.find((a) => a === '--port');
    const port = portArg ? Number(args[args.indexOf(portArg) + 1]) : 4173;
    const open = !args.includes('--no-open');
    await killExistingOnPort(port);
    const server = startServer({ port, open });
    if (server) {
      process.on('SIGINT', () => { server.close(); process.exit(0); });
    }
    return new Promise(() => {}); // keep the process alive until Ctrl+C
  }

  console.error(`Unknown command: ${cmd}\n`);
  help();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
