// Resolves the root of the global Gambit store and the paths inside it.
//
// Root resolution order: $GAMBIT_HOME -> $XDG_DATA_HOME/gambit -> ~/.gambit.
// Every other path in this module is derived from that root, so tests can
// redirect the whole store by setting GAMBIT_HOME alone.

import { homedir } from 'node:os';
import { join } from 'node:path';

export function storeRoot() {
  if (process.env.GAMBIT_HOME) return process.env.GAMBIT_HOME;
  if (process.env.XDG_DATA_HOME) return join(process.env.XDG_DATA_HOME, 'gambit');
  return join(homedir(), '.gambit');
}

export function goalsDir() {
  return join(storeRoot(), 'goals');
}

export function goalDir(slug) {
  return join(goalsDir(), slug);
}

export function goalFile(slug) {
  return join(goalDir(slug), 'GOAL.json');
}

export function activeFile() {
  return join(storeRoot(), 'active');
}

export function dbPath() {
  return join(storeRoot(), 'gambit.db');
}

export function updateCheckFile() {
  return join(storeRoot(), 'update-check.json');
}
