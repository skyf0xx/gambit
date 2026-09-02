// Resolves the same GOAL.md the rest of Gambit would use — mirrors
// bin/cli.mjs's storePath(), which mirrors skills/_shared/RESOLVING.md.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as store from '../store/index.mjs';
import { goalFile } from '../store/paths.mjs';

export function resolveGoalPath(cwd = process.cwd()) {
  const cwdGoal = join(cwd, 'GOAL.md');
  if (existsSync(cwdGoal)) return cwdGoal;

  const slug = store.resolveActive();
  if (!slug) return null;
  return goalFile(slug);
}
