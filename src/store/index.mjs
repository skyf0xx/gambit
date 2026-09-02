// Store operations: list, create, switch, and keep the SQLite index in
// sync with the GOAL.json files that are the actual source of truth.

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync, rmSync, unlinkSync } from 'node:fs';
import { openDb, withDb, inTransaction, ensureStoreDirs } from './db.mjs';
import { goalsDir, goalDir, goalFile, activeFile } from './paths.mjs';
import { safeParseGoalJson, stubGoal } from './schema.mjs';

function slugify(title) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'goal';
}

function uniqueSlug(base) {
  if (!existsSync(goalFile(base))) return base;
  let n = 2;
  while (existsSync(goalFile(`${base}-${n}`))) n++;
  return `${base}-${n}`;
}

function listSlugsOnDisk() {
  if (!existsSync(goalsDir())) return [];
  return readdirSync(goalsDir(), { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(goalFile(e.name)))
    .map((e) => e.name);
}

// Rebuilds both tables from goals/*/GOAL.json. Preserves status, created_at,
// and last_active for slugs the index already knew about; anything no
// longer on disk is dropped.
export function reindex() {
  ensureStoreDirs();
  const slugs = listSlugsOnDisk();

  withDb((db) => {
    inTransaction(db, () => {
      const existing = new Map(
        db.prepare('SELECT slug, status, created_at, last_active FROM goals').all().map((r) => [r.slug, r])
      );

      db.exec('DELETE FROM goals');
      db.exec('DELETE FROM goals_fts');

      const insertGoal = db.prepare(
        `INSERT INTO goals (slug, title, deadline, status, created_at, last_active, indexed_mtime)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      const insertFts = db.prepare('INSERT INTO goals_fts (slug, body) VALUES (?, ?)');

      for (const slug of slugs) {
        const body = readFileSync(goalFile(slug), 'utf8');
        const result = safeParseGoalJson(body);
        if (!result.success) {
          console.error(`gambit: skipping "${slug}" — invalid GOAL.json (${result.error})`);
          continue;
        }
        const { goal: title, deadline } = result.data;
        const prior = existing.get(slug);
        const status = prior?.status ?? 'active';
        const createdAt = prior?.created_at ?? new Date().toISOString();
        const lastActive = prior?.last_active ?? createdAt;
        const mtime = Math.floor(statSync(goalFile(slug)).mtimeMs);
        insertGoal.run(slug, title, deadline, status, createdAt, lastActive, mtime);
        insertFts.run(slug, body);
      }
    });
  });
}

// Reindexes whenever the on-disk goal set has drifted from the index: a
// slug added or removed, or a GOAL.json hand-edited (mtime newer than the
// mtime recorded at last index time). Cheap on the common case — one
// query plus one stat() per goal, no reindex — so every read path can
// call it unconditionally.
export function ensureIndexFresh() {
  ensureStoreDirs();
  const slugs = listSlugsOnDisk();

  const indexed = withDb((db) => db.prepare('SELECT slug, indexed_mtime FROM goals').all());
  const indexedMtimes = new Map(indexed.map((r) => [r.slug, r.indexed_mtime]));

  const staleSlugCount = slugs.length !== indexed.length;
  const staleMtime = slugs.some((slug) => {
    const recorded = indexedMtimes.get(slug);
    if (recorded == null) return true;
    return Math.floor(statSync(goalFile(slug)).mtimeMs) > recorded;
  });

  if (staleSlugCount || staleMtime) reindex();
}

export function list() {
  ensureIndexFresh();
  return withDb((db) =>
    db.prepare('SELECT slug, title, deadline, status, last_active FROM goals ORDER BY last_active DESC').all()
  );
}

export function create(title) {
  ensureStoreDirs();
  const slug = uniqueSlug(slugify(title));
  mkdirSync(goalDir(slug), { recursive: true });

  const body = JSON.stringify(stubGoal(title), null, 2) + '\n';
  writeFileSync(goalFile(slug), body);

  reindex();
  setActive(slug);
  return slug;
}

export function resolveActive() {
  ensureIndexFresh();
  if (!existsSync(activeFile())) return null;
  const slug = readFileSync(activeFile(), 'utf8').trim();
  if (!slug || !existsSync(goalFile(slug))) return null;
  return slug;
}

export function setActive(slug) {
  if (!existsSync(goalFile(slug))) {
    throw new Error(`No such goal: ${slug}`);
  }
  ensureStoreDirs();
  writeFileSync(activeFile(), `${slug}\n`);
  touch(slug);
}

export function touch(slug) {
  withDb((db) => {
    db.prepare("UPDATE goals SET last_active = datetime('now') WHERE slug = ?").run(slug);
  });
}

// Deletes one goal: its goals/<slug>/ directory (GOAL.json and all) and its
// row in the index. If it was the active goal, clears `active` — the next
// resolution falls through to the single-goal or onboard rule rather than
// pointing at a slug that no longer exists.
export function remove(slug) {
  if (!existsSync(goalFile(slug))) {
    throw new Error(`No such goal: ${slug}`);
  }
  const wasActive = resolveActive() === slug;

  rmSync(goalDir(slug), { recursive: true, force: true });

  withDb((db) => {
    inTransaction(db, () => {
      db.prepare('DELETE FROM goals WHERE slug = ?').run(slug);
      db.prepare('DELETE FROM goals_fts WHERE slug = ?').run(slug);
    });
  });

  if (wasActive && existsSync(activeFile())) {
    unlinkSync(activeFile());
  }
}

// Deletes every goal in the store: all goals/<slug>/ directories, the
// active pointer, and the index rows. Leaves gambit.db itself in place
// (reindex() will recreate an empty schema on next use) rather than
// deleting the database file, so callers don't need to worry about a
// concurrent open handle.
export function removeAll() {
  const slugs = listSlugsOnDisk();
  for (const slug of slugs) {
    rmSync(goalDir(slug), { recursive: true, force: true });
  }

  withDb((db) => {
    inTransaction(db, () => {
      db.exec('DELETE FROM goals');
      db.exec('DELETE FROM goals_fts');
    });
  });

  if (existsSync(activeFile())) {
    unlinkSync(activeFile());
  }

  return slugs;
}
