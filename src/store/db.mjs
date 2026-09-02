// The Gambit store index — see AGENTS.md, "SQLite is an index, not the
// source of truth". Goal state lives in GOAL.json files under goals/<slug>/;
// this schema records only what's needed to list, switch, and search
// across goals. Deleting gambit.db and running `gambit reindex` loses
// nothing.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { dbPath, storeRoot } from './paths.mjs';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS goals (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  deadline    TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','done','abandoned','paused')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_active TEXT NOT NULL DEFAULT (datetime('now')),
  -- Epoch millis of the GOAL.json mtime at the moment this row was written.
  -- Compared against the file's current mtime to decide staleness —
  -- separate from last_active, which tracks goal *usage*, not indexing.
  indexed_mtime INTEGER NOT NULL DEFAULT 0
);
CREATE VIRTUAL TABLE IF NOT EXISTS goals_fts USING fts5(slug, body);
`;

// node:sqlite emits an ExperimentalWarning the instant this module is
// imported (Node 22.23.2, verified locally) — a filter placed inside any
// function here runs too late. bin/cli.mjs installs a process.emitWarning
// filter before dynamically importing this module, which is the only
// place that can actually suppress it for CLI output.
export function openDb({ readOnly = false } = {}) {
  if (!readOnly) mkdirSync(dirname(dbPath()), { recursive: true });
  const db = new DatabaseSync(dbPath(), { readOnly });
  db.exec('PRAGMA busy_timeout = 10000');
  if (!readOnly) db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  if (!readOnly) db.exec(SCHEMA_SQL);
  return db;
}

export function withDb(fn, opts) {
  const db = openDb(opts);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export function inTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Rollback failing must not mask the original error.
    }
    throw err;
  }
}

// Ensures the store root exists before any path inside it is touched.
export function ensureStoreDirs() {
  mkdirSync(storeRoot(), { recursive: true });
}
