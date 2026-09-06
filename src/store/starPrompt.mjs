// Ask-once/cooldown state for the agent-side "star Gambit on GitHub" prompt.
// Cross-goal, tool-level state — lives at the store root (like
// update-check.json), not inside any GOAL.json, since the ask is about
// Gambit itself and must fire once regardless of which goal is active.
//
// The ask is presented yes/no/remind-me-later and the turn stops for a
// real answer — nothing is recorded until the user actually responds.
// "Yes" or "no" both close it permanently (a "no" is a clear enough
// signal not to ask again); "remind me later" re-opens it after a
// cooldown, up to a hard cap on total defers.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { starPromptStateFile } from './paths.mjs';

const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_DEFERS = 3;

const DEFAULT_STATE = { timesDeferred: 0, lastDeferredAt: null, closed: false };

function readState() {
  try {
    const parsed = JSON.parse(readFileSync(starPromptStateFile(), 'utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.timesDeferred !== 'number' ||
      typeof parsed.closed !== 'boolean'
    ) {
      return DEFAULT_STATE;
    }
    return parsed;
  } catch {
    return DEFAULT_STATE;
  }
}

function writeState(state) {
  try {
    mkdirSync(dirname(starPromptStateFile()), { recursive: true });
    writeFileSync(starPromptStateFile(), JSON.stringify(state));
  } catch {
    // Best-effort — a failed write just means the next command re-evaluates.
  }
}

// Returns whether the agent should show the star ask right now.
export function isEligible() {
  const state = readState();
  if (state.closed) return false;
  if (state.timesDeferred === 0) return true;
  if (state.timesDeferred >= MAX_DEFERS) return false;
  return Date.now() - state.lastDeferredAt > COOLDOWN_MS;
}

// Call when the user answers "remind me later" — re-eligible after cooldown.
export function recordDeferred() {
  const state = readState();
  writeState({ ...state, timesDeferred: state.timesDeferred + 1, lastDeferredAt: Date.now() });
}

// Call when the user answers "yes" (starred) or "no" — either closes it
// permanently, since both are a real answer, not a non-response.
export function recordClosed() {
  const state = readState();
  writeState({ ...state, closed: true });
}
