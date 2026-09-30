// Version-aware read path: read `schemaVersion` from the raw document, run
// the migration chain up to CURRENT_SCHEMA_VERSION, then validate against the
// current schema. A document from a newer schema is never migrated or opened
// for writing — it is reported as `needs_app_update` so a newer install's
// data cannot be silently downgraded.

import { goalSchema } from './schema.mjs';

export const CURRENT_SCHEMA_VERSION = 2;

// Declarative migrations: { from: n, to: n + 1, transform: (doc) => doc }.
// `transform` is a pure data function shipped in-app, never downloaded code.
export const MIGRATIONS = [
  // v2 only adds optional fields and enum values (proposed next actions,
  // riskNotes.dependsOn, criteriaStatus 'met', open decisions, log focusLine),
  // so every v1 document is already a valid v2 one.
  { from: 1, to: 2, transform: (doc) => doc },
];

function formatIssues(error) {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

/** @typedef {import('zod').infer<typeof goalSchema>} Goal */
/**
 * @param {unknown} raw
 * @param {{ migrations?: { from: number, to: number, transform: (doc: any) => any }[], current?: number }} [opts]
 * @returns {{ status: 'ok', data: Goal, migratedFrom?: number } | { status: 'needs_app_update', version: number } | { status: 'invalid', error: string }}
 */
export function readGoal(raw, { migrations = MIGRATIONS, current = CURRENT_SCHEMA_VERSION } = {}) {
  let doc;
  try {
    doc = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    return { status: 'invalid', error: `invalid JSON: ${err.message}` };
  }
  const v = doc?.schemaVersion;
  if (!Number.isInteger(v) || v < 1) return { status: 'invalid', error: 'schemaVersion: missing or not a positive integer' };
  if (v > current) return { status: 'needs_app_update', version: v };

  let migratedFrom;
  for (let at = v; at < current; at++) {
    const m = migrations.find((x) => x.from === at);
    if (!m) return { status: 'invalid', error: `no migration from schemaVersion ${at}` };
    migratedFrom ??= v;
    doc = { ...m.transform(doc), schemaVersion: m.to };
  }

  const result = goalSchema.safeParse(doc);
  if (!result.success) return { status: 'invalid', error: formatIssues(result.error) };
  return migratedFrom ? { status: 'ok', data: result.data, migratedFrom } : { status: 'ok', data: result.data };
}
