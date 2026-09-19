import Dexie, { type Table } from 'dexie';
import type { ModelMessage } from 'ai';

export interface GoalRecord {
  id: string;
  title: string;
  /** Raw stored document; always read through readGoal(). */
  doc: unknown;
  schemaVersion: number;
  updatedAt: number;
}
export interface SnapshotRecord {
  id?: number;
  goalId: string;
  ts: number;
  kind: 'turn' | 'premigration' | 'preupdate' | 'edit' | 'import';
  doc: unknown;
}
export interface DisplayMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tools?: { name: string; label: string; ok: boolean }[];
  summary?: string[];
  snapshotId?: number;
  undone?: boolean;
  error?: string;
}
export interface ChatRecord {
  goalId: string;
  model: ModelMessage[];
  display: DisplayMsg[];
  activeSkill?: string;
}
export interface SkillPackRecord {
  version: string;
  files: Record<string, string>;
  integrity: string;
  migrations: unknown[];
  appVersionMin: string;
  installedAt: number;
  source: 'bundled' | 'npm';
  /** Version this pack replaced, for rollback. */
  previous?: string;
  /** Pre-update snapshots taken when this pack was applied. */
  preUpdateSnapshots?: number[];
  migrated?: boolean;
}
export interface UsageRecord {
  id?: number;
  ts: number;
  goalId: string;
  model: string;
  input: number;
  cached: number;
  output: number;
  /** Estimated characters per prompt component (chars/4 ~ tokens). */
  parts: { system: number; skill: number; state: number; history: number };
  skillLoads: number;
}

class GambitDB extends Dexie {
  goals!: Table<GoalRecord, string>;
  snapshots!: Table<SnapshotRecord, number>;
  chats!: Table<ChatRecord, string>;
  settings!: Table<{ key: string; value: unknown }, string>;
  secrets!: Table<{ id: string; value: unknown }, string>;
  skillPacks!: Table<SkillPackRecord, string>;
  usage!: Table<UsageRecord, number>;

  constructor() {
    super('gambit');
    this.version(1).stores({
      goals: 'id, updatedAt',
      snapshots: '++id, goalId, ts',
      chats: 'goalId',
      settings: 'key',
      secrets: 'id',
      skillPacks: 'version',
      usage: '++id, ts, goalId',
    });
  }
}

export const db = new GambitDB();

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined;
}
export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}
