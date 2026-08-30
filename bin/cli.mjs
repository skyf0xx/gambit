#!/usr/bin/env node
// Gambit installer. Copies the skills/ payload into the current
// directory's .claude/skills/ (Claude Code discovery), and links the
// skill set into the project's AGENTS.md for any other agent that reads
// that file, so the skills travel with the project rather than living
// only in this package.
//
// Usage:
//   npx @skyf0xx/gambit init      install skills into ./.claude/skills
//   npx @skyf0xx/gambit init --force   overwrite files that differ
//   npx @skyf0xx/gambit update    re-copy the current package's skills
//   npx @skyf0xx/gambit --help

import { cp, mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
const SRC_SKILLS = join(PKG_ROOT, 'skills');
const CWD = process.cwd();
const DEST_SKILLS = join(CWD, '.claude', 'skills');
const DEST_AGENTS_MD = join(CWD, 'AGENTS.md');

const MARKER_START = '<!-- gambit:skills start -->';
const MARKER_END = '<!-- gambit:skills end -->';

function help() {
  console.log(`
Gambit — strategic-advisor skills for an AI agent working a goal.

Usage:
  npx @skyf0xx/gambit init [--force]   install skills into ./.claude/skills
  npx @skyf0xx/gambit update           re-copy skills from the installed package version
  npx @skyf0xx/gambit --help           show this message

Without --force, init will not overwrite a skill file that already
differs from the package's copy — pass --force to sync anyway.
`);
}

async function listSkillDirs() {
  const entries = await readdir(SRC_SKILLS, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function filesDiffer(src, dest) {
  if (!existsSync(dest)) return true;
  const [ca, cb] = await Promise.all([readFile(src, 'utf8'), readFile(dest, 'utf8')]);
  return ca !== cb;
}

async function copySkills({ force }) {
  await mkdir(DEST_SKILLS, { recursive: true });
  const names = await listSkillDirs();
  let written = 0;
  let skipped = 0;

  for (const name of names) {
    const srcDir = join(SRC_SKILLS, name, 'SKILL.md');
    const destDir = join(DEST_SKILLS, name, 'SKILL.md');
    const differs = await filesDiffer(srcDir, destDir);

    if (existsSync(destDir) && !differs) continue;
    if (existsSync(destDir) && differs && !force) {
      console.log(`  skip   ${relative(CWD, destDir)} (differs from package — use --force to overwrite)`);
      skipped++;
      continue;
    }

    await mkdir(dirname(destDir), { recursive: true });
    await cp(srcDir, destDir);
    console.log(`  write  ${relative(CWD, destDir)}`);
    written++;
  }

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
a set of skills for working a goal (\`GOAL.md\`) as a strategic advisor
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
  console.log(`\nNext: ask your agent to run the \`onboard\` skill to start a GOAL.md.`);
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

  if (cmd === 'init') {
    await init({ force });
    return;
  }

  if (cmd === 'update') {
    await update();
    return;
  }

  console.error(`Unknown command: ${cmd}\n`);
  help();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
