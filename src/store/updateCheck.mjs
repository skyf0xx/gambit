// Checks whether a newer @skyf0xx/gambit is published to npm, for the
// CLI-only install path (npm install -g @skyf0xx/gambit). The plugin
// install path has its own, unrelated check in hooks/session-start that
// reads a local marketplace git clone — this module is the npm-registry
// equivalent for whoever only has the bare `gambit` command.
//
// Every command must stay fast and must never hang on a bad network, so
// the actual `npm view` call never runs inline: printNoticeIfDue() only
// ever reads a small cache file, and separately kicks off a detached,
// fire-and-forget refresh when that cache is stale. The result lands in
// time for the *next* invocation, never this one.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { updateCheckFile } from './paths.mjs';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REGISTRY_URL = 'https://registry.npmjs.org/@skyf0xx%2Fgambit/latest';
const FETCH_TIMEOUT_MS = 3000;

function readCache() {
  try {
    return JSON.parse(readFileSync(updateCheckFile(), 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    mkdirSync(dirname(updateCheckFile()), { recursive: true });
    writeFileSync(updateCheckFile(), JSON.stringify(data));
  } catch {
    // Best-effort — a failed write just means the next command checks again.
  }
}

function isNewer(latest, current) {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

// Runs this same file's refreshInBackground() in a detached child process
// so the fetch survives after the parent CLI command exits, then that
// child exits too — nothing is left running.
function spawnBackgroundRefresh() {
  const child = spawn(process.execPath, [new URL(import.meta.url).pathname, '--refresh'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function refreshInBackground() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(REGISTRY_URL, { signal: controller.signal });
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.version === 'string') {
      writeCache({ checkedAt: Date.now(), latest: data.version });
    }
  } catch {
    // Offline, timed out, or registry unreachable — leave the existing
    // cache as-is and try again after the next interval.
    writeCache({ checkedAt: Date.now(), latest: readCache()?.latest ?? null });
  } finally {
    clearTimeout(timeout);
  }
}

// Prints a one-line notice if the cache says a newer version is out, then
// (regardless of whether the cache was fresh or stale) kicks off a
// background refresh when the cache has aged past CHECK_INTERVAL_MS.
// Call this once near the top of the CLI entrypoint.
export function printNoticeIfDue(currentVersion) {
  const cache = readCache();

  if (cache?.latest && isNewer(cache.latest, currentVersion)) {
    console.error(
      `A newer version of gambit is available (${currentVersion} -> ${cache.latest}). Run: npm install -g @skyf0xx/gambit\n`
    );
  }

  const stale = !cache || Date.now() - cache.checkedAt > CHECK_INTERVAL_MS;
  if (stale) spawnBackgroundRefresh();
}

// Entrypoint for the detached child process spawned above.
if (process.argv[2] === '--refresh') {
  refreshInBackground().then(() => process.exit(0));
}
