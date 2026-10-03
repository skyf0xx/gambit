import Dexie, { type Table } from 'dexie';
import type { ModelMessage } from 'ai';
import type { Reply } from './tools';
import type { PageEdit } from './edits';
import type { RoutedUpdate } from '@gambit/core';

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
  kind: 'turn' | 'premigration' | 'edit' | 'import';
  doc: unknown;
}
export interface DisplayMsg {
  id: string;
  role: 'user' | 'assistant';
  /** The model's own text outside the reply tool: its reasoning, shown
   * collapsed — or the whole answer when it never called reply. */
  text: string;
  reply?: Reply;
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
  /** The skill a checkpoint skill (elicit) runs inside, resumed when it finishes. */
  callerSkill?: string;
  /** Updates sitrep routed in the last turn and showed the user to confirm.
   * The next turn clears each routed skill to write in the turn it loads,
   * then replaces this with its own routing, if any. */
  routed?: RoutedUpdate[];
  /** Older turns have been dropped from this chat (agent.ts's CHAT_TURNS),
   * so the conversation says so above its first message. */
  trimmed?: boolean;
  /** Edits the user made on the page since the last turn (lib/edits.ts),
   * told to the advisor in the next turn's state block, then cleared. */
  pendingEdits?: PageEdit[];
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
    // Skills ship in the app bundle; version 2 drops the skillPacks table.
    this.version(2).stores({ skillPacks: null });
  }
}

export const db = new GambitDB();

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined;
}
export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}
