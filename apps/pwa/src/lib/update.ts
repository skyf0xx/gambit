import { db, getSetting, setSetting, type SkillPackRecord } from './db';
import { bundledFiles, buildStore, invalidateSkills } from './skills';
import { gunzip, untar } from './tar';
import { diffPacks, type PackDiff } from './diff';
import { migrateAll, restoreSnapshot, snapshot } from './goals';

const REGISTRY = 'https://registry.npmjs.org/';

export interface RegistryManifest {
  name: string;
  version: string;
  dist: { tarball: string; integrity?: string };
  gambit?: { appVersionMin?: string; migrations?: unknown[] };
}

export function compareVersions(a: string, b: string): number {
  const p = (v: string) => v.split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const [x, y] = [p(a), p(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

export type UpdateCheck =
  | { status: 'up_to_date'; version: string }
  | { status: 'needs_app_update'; version: string; appVersionMin: string }
  | { status: 'available'; manifest: RegistryManifest };

/** Pure gate: decide what to do about a candidate manifest. */
export function evaluateManifest(m: RegistryManifest, installed: string, appVersion: string): UpdateCheck {
  if (compareVersions(m.version, installed) <= 0) return { status: 'up_to_date', version: installed };
  const min = m.gambit?.appVersionMin;
  if (min && compareVersions(min, appVersion) > 0) return { status: 'needs_app_update', version: m.version, appVersionMin: min };
  return { status: 'available', manifest: m };
}

export async function installedPackVersion(): Promise<string> {
  return (await getSetting<string>('activePack')) ?? __PACK_VERSION__;
}

export async function checkForUpdate(): Promise<UpdateCheck> {
  const name = __PACK_NAME__.replace('/', '%2F');
  const res = await fetch(`${REGISTRY}${name}/latest`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`registry returned ${res.status}`);
  const manifest = (await res.json()) as RegistryManifest;
  await setSetting('lastUpdateCheck', Date.now());
  return evaluateManifest(manifest, await installedPackVersion(), __APP_VERSION__);
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

/** Verify bytes against an npm `dist.integrity` string (sha512 required). */
export async function verifyIntegrity(bytes: Uint8Array<ArrayBuffer>, integrity: string | undefined): Promise<void> {
  const want = integrity?.split(/\s+/).find((s) => s.startsWith('sha512-'));
  if (!want) throw new Error('registry metadata has no sha512 integrity hash; refusing to install');
  const got = `sha512-${b64(await crypto.subtle.digest('SHA-512', bytes))}`;
  if (got !== want) throw new Error('tarball integrity check failed; nothing was installed');
}

export interface PreparedUpdate {
  manifest: RegistryManifest;
  files: Record<string, string>;
  diff: PackDiff;
  changelog: string;
}

/** Fetch the exact pinned version, verify the registry's hash, unpack in the browser. Nothing is applied. */
export async function prepareUpdate(manifest: RegistryManifest): Promise<PreparedUpdate> {
  if (!manifest.dist.tarball.startsWith(REGISTRY)) throw new Error('tarball is not hosted on the npm registry');
  const res = await fetch(manifest.dist.tarball);
  if (!res.ok) throw new Error(`tarball fetch failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  await verifyIntegrity(bytes, manifest.dist.integrity);
  const all = untar(await gunzip(bytes));
  const pkg = JSON.parse(all['package/package.json'] ?? '{}');
  if (pkg.name !== manifest.name || pkg.version !== manifest.version) throw new Error('tarball contents do not match the pinned version');
  const files: Record<string, string> = {};
  for (const [p, t] of Object.entries(all)) if (/^package\/skills\/.+\.md$/.test(p)) files[p.slice('package/'.length)] = t;
  const current = await currentPackFiles();
  return { manifest, files, diff: diffPacks(current, files), changelog: all['package/CHANGELOG.md']?.slice(0, 4000) ?? '' };
}

export async function currentPackFiles(): Promise<Record<string, string>> {
  const id = await getSetting<string>('activePack');
  return (id && (await db.skillPacks.get(id))?.files) || bundledFiles;
}

/** Snapshot all goals, install the pack, migrate goals, and roll everything back if a goal fails to migrate. */
export async function applyUpdate(p: PreparedUpdate): Promise<{ migrated: number }> {
  const prev = await installedPackVersion();
  const snaps: number[] = [];
  for (const g of await db.goals.toArray()) snaps.push(await snapshot(g.id, 'preupdate'));
  const rec: SkillPackRecord = {
    version: p.manifest.version,
    files: p.files,
    integrity: p.manifest.dist.integrity ?? '',
    migrations: p.manifest.gambit?.migrations ?? [],
    appVersionMin: p.manifest.gambit?.appVersionMin ?? '0.0.0',
    installedAt: Date.now(),
    source: 'npm',
    previous: prev,
    preUpdateSnapshots: snaps,
  };
  await db.skillPacks.put(rec);
  await setSetting('activePack', rec.version);
  invalidateSkills();
  const r = await migrateAll();
  if (r.failed.length) {
    for (const s of snaps) await restoreSnapshot(s);
    await setSetting('activePack', prev);
    await db.skillPacks.delete(rec.version);
    invalidateSkills();
    throw new Error(`update rolled back: could not migrate ${r.failed.join(', ')}`);
  }
  await db.skillPacks.update(rec.version, { migrated: r.migrated > 0 });
  return { migrated: r.migrated };
}

/** Return to the previous pack; goals migrated by the update are restored from their pre-update snapshots. */
export async function rollbackPack(): Promise<void> {
  const cur = await db.skillPacks.get(await installedPackVersion());
  if (!cur?.previous) throw new Error('nothing to roll back to');
  if (cur.migrated) for (const s of cur.preUpdateSnapshots ?? []) await restoreSnapshot(s);
  await setSetting('activePack', cur.previous);
  invalidateSkills();
}

export const canRollback = async () => !!(await db.skillPacks.get(await installedPackVersion()))?.previous;
export { buildStore };
