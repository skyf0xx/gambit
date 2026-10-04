import { tool } from 'ai';
import { z } from 'zod';
import { writeSection, appendLog, setStatus, remember, forget, canLoad, canWrite, canRoute, WRITABLE_KEYS, MEMORY_KINDS, LOG_NOTES_MAX, LOG_RECENT, ROUTED_MAX, ROUTER_SKILL, ALL_STATUSES, type FlowSession } from '@gambit/core';
import { applyOp, readRecord } from './goals';
import { db } from './db';
import { today } from './dates';
import { getSkillStore, skillText, skillFile, skillFlows, flowOf, elicitationMethods } from './skills';

export interface ToolContext {
  goalId: string;
  /** Which skill is active, which were loaded this turn, which a routed
   * update cleared, and the routing set this turn. The tools update it in
   * place; the agent persists it when the turn ends. */
  session: FlowSession;
  onSkillLoaded: (name: string) => void;
}

const result = (r: Awaited<ReturnType<typeof applyOp>>) =>
  r.ok ? { ok: true as const, ...(r.warnings.length ? { warnings: r.warnings } : {}) } : { ok: false as const, errors: r.errors };

/** The flow's verdict on a write, as the same error shape a failed write returns. */
async function gate(session: FlowSession, key: string, op: 'write_section' | 'set_status' | 'append_log') {
  const r = canWrite(session, key, op, skillFlows(await getSkillStore()));
  return r.ok ? null : { ok: false as const, errors: [{ path: key, message: r.error }] };
}

/** The goal as it reads now, or null if it can't be read. */
export async function currentGoal(goalId: string) {
  const rec = await db.goals.get(goalId);
  if (!rec) return null;
  const read = await readRecord(rec);
  return read.status === 'ok' ? read.data : null;
}

/** Compact current state for the system prompt and get_goal: log trimmed to the newest LOG_RECENT entries. */
export async function goalStateJson(goalId: string): Promise<string> {
  const rec = await db.goals.get(goalId);
  if (!rec) return 'null';
  const read = await readRecord(rec);
  if (read.status !== 'ok') return JSON.stringify({ unreadable: read.status });
  const { log, updated: _stamps, ...rest } = read.data;
  return JSON.stringify({ ...rest, log: log.slice(-LOG_RECENT), logCount: log.length });
}

/** The one shape every turn ends in: what the user sees. Anything the
 * model writes outside this call is its reasoning, kept collapsed under
 * the reply (Chat.tsx). Caps are tight on purpose — a reply that runs long
 * fails validation and the model rewrites it. */
export const REPLY_KINDS = ['question', 'decision', 'confirm', 'fyi'] as const;
/** Everything the user sees of a turn, in words. Nothing actionable needs more. */
export const REPLY_MAX_WORDS = 80;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const replyWords = (r: { say: string; bottomLine: string; options?: string[] }) =>
  words(r.say) + words(r.bottomLine) + (r.options ?? []).reduce((n, o) => n + words(o), 0);
export const replySchema = z.object({
  say: z.string().min(1).max(160).describe('One short plain sentence: what you found or did. No headings, no lists.'),
  bottomLine: z.string().min(1).max(120).describe('What you need from the user now, or your one recommended next move. One sentence, with no label in front (the page adds one).'),
  kind: z.enum(REPLY_KINDS).describe('question: you need a fact only they have. decision: they must make a call. confirm: you want a yes before writing. fyi: nothing needed, here is the next move.'),
  options: z.array(z.string().min(1).max(40)).max(5).optional().describe('Up to 5 short answers the user can tap instead of typing, recommended one first. Omit for an open question.'),
}).refine((r) => replyWords(r) <= REPLY_MAX_WORDS, { message: `The reply runs past ${REPLY_MAX_WORDS} words in all. Cut it: one point, one ask.` });
export type Reply = z.infer<typeof replySchema>;

export function makeTools(ctx: ToolContext) {
  return {
    reply: tool({
      description: 'End every turn with exactly one call to this, after any goal writes. It is the only part of your turn the user sees by default; text you write outside it is shown collapsed as your reasoning.',
      inputSchema: replySchema,
      execute: async () => ({ ok: true }),
    }),
    load_skill: tool({
      description: 'Load a Gambit skill by name (see the skill index) and make it the active skill, replacing the one before. A checkpoint skill (elicit) runs inside the active skill instead and hands back to it on finish_skill.',
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        const store = await getSkillStore();
        const s = skillText(store, name);
        const flow = flowOf(store, name);
        if (!s || !flow) return { ok: false, error: `unknown skill "${name}"`, available: store.index.map((i) => i.name) };
        const goal = await currentGoal(ctx.goalId);
        const verdict = goal ? canLoad(flow, goal) : undefined;
        if (verdict && !verdict.ok) return { ok: false, error: verdict.error };
        const warning = verdict?.ok ? verdict.warning : undefined;
        const { session } = ctx;
        if (session.active !== name) {
          const current = session.active ? flowOf(store, session.active) : undefined;
          session.caller = flow.checkpoint ? (current?.checkpoint ? session.caller : session.active) : undefined;
          session.active = name;
          session.fresh.push(name);
          ctx.onSkillLoaded(name);
        }
        return { ok: true, skill: name, ...(warning ? { warning } : {}), text: s.text, supportingFiles: s.extras };
      },
    }),
    finish_skill: tool({
      description: 'End the active skill when its work is done. From a checkpoint skill (elicit), this hands back to the skill that called it and returns that skill\'s text. To move on to another skill, call load_skill instead.',
      inputSchema: z.object({}),
      execute: async () => {
        const { session } = ctx;
        if (!session.active) return { ok: false, error: 'no skill is active' };
        const done = session.active;
        const store = await getSkillStore();
        if (flowOf(store, done)?.checkpoint && session.caller) {
          const resumed = session.caller;
          session.active = resumed;
          session.caller = undefined;
          return { ok: true, finished: done, resumed, text: skillText(store, resumed)?.text };
        }
        session.active = undefined;
        session.caller = undefined;
        return { ok: true, finished: done };
      },
    }),
    read_skill_file: tool({
      description: 'Read a supporting reference file of a skill. Use skill "_shared" for shared docs such as HUMANIZE.md.',
      inputSchema: z.object({ skill: z.string(), path: z.string() }),
      execute: async ({ skill, path }) => {
        const text = skillFile(await getSkillStore(), skill, path);
        return text === null ? { ok: false, error: `no file ${path} in ${skill}` } : { ok: true, text };
      },
    }),
    get_goal: tool({
      description: 'Return the current goal state as compact JSON. Call it if the user may have edited the dashboard since the state in the system prompt.',
      inputSchema: z.object({}),
      execute: async () => JSON.parse(await goalStateJson(ctx.goalId)),
    }),
    write_section: tool({
      description: `Replace one owned key of the goal with a complete new value, validated against its schema. Keys: ${WRITABLE_KEYS.join(', ')}. Returns { ok: true } or { ok: false, errors: [{ path, message }] }; fix the listed fields and retry.`,
      inputSchema: z.object({
        key: z.enum(WRITABLE_KEYS as [string, ...string[]]),
        // Array items need a concrete type: Gemini rejects an array schema without `items`.
        value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.record(z.any())])), z.record(z.any())]).describe('The complete new value for the key, matching the section shapes in the system prompt.'),
      }),
      execute: async ({ key, value }) => (await gate(ctx.session, key, 'write_section')) ?? result(await applyOp(ctx.goalId, (g) => writeSection(g, key, value, new Date().toISOString(), today()) as never)),
    }),
    append_log: tool({
      description: `Append one entry to the log, the only append-only key: what happened or what the user decided in this exchange, in ${LOG_NOTES_MAX} notes at most. Never restate the situation; a note that repeats a recent entry is refused. date defaults to today.`,
      inputSchema: z.object({
        date: z.string().optional(),
        assessment: z.enum(['on_track', 'at_risk', 'stalled', 'regressing']).optional(),
        focus: z.string().nullable(),
        focusLine: z.string().optional(),
        notes: z.array(z.string()),
        source: z.string().optional(),
      }),
      execute: async (entry) => {
        const refused = await gate(ctx.session, 'log', 'append_log');
        if (refused) return refused;
        // A checkpoint (elicit) writes on behalf of the skill it runs inside.
        const active = skillFlows(await getSkillStore()).find((s) => s.name === ctx.session.active);
        const writer = active?.checkpoint ? ctx.session.caller : ctx.session.active;
        return result(await applyOp(ctx.goalId, (g) => appendLog(g, { ...entry, date: entry.date ?? today() }, writer) as never));
      },
    }),
    remember: tool({
      description: 'Keep one thing the user told you that no goal key holds: a fact, a preference, a constraint, or a move they turned down (rejected). Use it the moment they say it, whatever skill is active. To correct or update an entry, pass replaces with its index in memory; it is overwritten, not added to.',
      inputSchema: z.object({
        kind: z.enum(MEMORY_KINDS as [string, ...string[]]),
        text: z.string().describe('One plain sentence, ≤120 chars, in the user\'s terms.'),
        replaces: z.number().int().optional().describe('Index of the memory entry this one corrects or supersedes.'),
      }),
      execute: async (item) => result(await applyOp(ctx.goalId, (g) => remember(g, item, today()) as never)),
    }),
    forget: tool({
      description: 'Drop one memory entry by its index, when it no longer holds or the user asks.',
      inputSchema: z.object({ index: z.number().int() }),
      execute: async ({ index }) => result(await applyOp(ctx.goalId, (g) => forget(g, index) as never)),
    }),
    set_status: tool({
      description: 'Flip one status without rewriting the section. A step, sub-item or next action takes pending, done or dropped (a next action can also be proposed); a ladder rung takes pending, sent, answered, unanswered or skipped (sent stamps sentOn and marks the rung out before it unanswered); a decision point takes open, taken or passed. path is dotted, e.g. "plan.linesOfOperation.0.nextActions.2" or "plan.linesOfOperation.0.ladder.1".',
      inputSchema: z.object({ path: z.string(), status: z.enum(ALL_STATUSES as [string, ...string[]]) }),
      execute: async ({ path, status }) => (await gate(ctx.session, path.split('.')[0], 'set_status')) ?? result(await applyOp(ctx.goalId, (g) => setStatus(g, path, status, today()) as never)),
    }),
    route_updates: tool({
      description: `Only while ${ROUTER_SKILL} is active: route several updates the user just gave, each to the skill that writes it. Show the routing as a confirm reply; once the user answers, each routed skill may write in the turn it loads, so the next turn works through them all.`,
      inputSchema: z.object({
        items: z.array(z.object({
          skill: z.string().describe('The skill that writes this update, from the skill index.'),
          update: z.string().describe('What changed, in one short plain sentence.'),
        })).max(ROUTED_MAX),
      }),
      execute: async ({ items }) => {
        const r = canRoute(ctx.session, items, skillFlows(await getSkillStore()));
        if (!r.ok) return { ok: false, error: r.error };
        ctx.session.routed = r.routed;
        return { ok: true, routed: r.routed };
      },
    }),
    elicitation_methods: tool({
      description: 'Serve the elicitation method catalog used by the elicit skill.',
      inputSchema: z.object({
        command: z.enum(['categories', 'list', 'show', 'random']),
        categories: z.array(z.string()).optional(),
        names: z.array(z.string()).optional(),
        n: z.number().optional(),
        exclude: z.array(z.string()).optional(),
        all: z.boolean().optional(),
      }),
      execute: async (args) => elicitationMethods(args),
    }),
  };
}

export function toolLabel(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, string>;
  switch (name) {
    case 'load_skill': return `skill: ${i.name}`;
    case 'finish_skill': return 'skill done';
    case 'write_section': return `wrote ${i.key}`;
    case 'set_status': return `${i.status}: ${String(i.path).split('.').slice(-2).join('.')}`;
    case 'append_log': return 'log entry';
    case 'remember': return `remembered (${i.kind})`;
    case 'forget': return 'forgot one thing';
    case 'read_skill_file': return `read ${i.skill}/${i.path}`;
    case 'web_search': return i.query ? `searched: ${i.query}` : 'web search';
    case 'get_goal': return 'read goal';
    case 'elicitation_methods': return 'method catalog';
    case 'route_updates': return 'routed updates';
    default: return name;
  }
}
