import { tool } from 'ai';
import { z } from 'zod';
import { writeSection, appendLog, setStatus, WRITABLE_KEYS, readingGrade, READING_GRADE_MAX } from '@gambit/core';
import { applyOp, readRecord } from './goals';
import { db } from './db';
import { getSkillStore, skillText, skillFile, elicitationMethods } from './skills';

export interface ToolContext {
  goalId: string;
  onSkillLoaded: (name: string) => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const result = (r: Awaited<ReturnType<typeof applyOp>>) =>
  r.ok ? { ok: true as const, ...(r.warnings.length ? { warnings: r.warnings } : {}) } : { ok: false as const, errors: r.errors };

/** Compact current state for the system prompt and get_goal: log trimmed to the last 5 entries. */
export async function goalStateJson(goalId: string): Promise<string> {
  const rec = await db.goals.get(goalId);
  if (!rec) return 'null';
  const read = await readRecord(rec);
  if (read.status !== 'ok') return JSON.stringify({ unreadable: read.status });
  const { log, ...rest } = read.data;
  return JSON.stringify({ ...rest, log: log.slice(-5), logCount: log.length });
}

/** The one shape every turn ends in: what the user sees. Anything the
 * model writes outside this call is its reasoning, kept collapsed under
 * the reply (Chat.tsx). Caps are tight on purpose — a reply that runs long
 * fails validation and the model rewrites it. */
export const REPLY_KINDS = ['question', 'decision', 'confirm', 'fyi'] as const;
export const REPLY_WORDS_MAX = 20;
/** A shown line: capped in characters and words, and held to the same
 * grade-7 reading level as goal writes (readability.mjs). */
const shownLine = (chars: number) =>
  z.string().min(1).max(chars)
    .refine((s) => s.trim().split(/\s+/).length <= REPLY_WORDS_MAX, `must be ${REPLY_WORDS_MAX} words or fewer`)
    .refine((s) => (readingGrade(s) ?? 0) <= READING_GRADE_MAX, `keep it at grade ${READING_GRADE_MAX} or below: shorter sentences, plainer words`);
export const replySchema = z.object({
  say: shownLine(160).describe(`One short plain sentence, at most ${REPLY_WORDS_MAX} words: what you found or did. No headings, no lists.`),
  bottomLine: shownLine(120).describe(`What you need from the user now, or your one recommended next move. One sentence, at most ${REPLY_WORDS_MAX} words, with no label in front (the page adds one).`),
  kind: z.enum(REPLY_KINDS).describe('question: you need a fact only they have. decision: they must make a call. confirm: you want a yes before writing. fyi: nothing needed, here is the next move.'),
  options: z.array(z.string().min(1).max(40)).max(5).optional().describe('Up to 5 short answers the user can tap instead of typing, recommended one first. Omit for an open question.'),
});
export type Reply = z.infer<typeof replySchema>;

export function makeTools(ctx: ToolContext) {
  return {
    reply: tool({
      description: 'End every turn with exactly one call to this, after any goal writes. It is the only part of your turn the user sees by default; text you write outside it is shown collapsed as your reasoning.',
      inputSchema: replySchema,
      execute: async () => ({ ok: true }),
    }),
    load_skill: tool({
      description: 'Load the full text of a Gambit skill by name (see the skill index). The skill stays active for the rest of its session.',
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        const store = await getSkillStore();
        const s = skillText(store, name);
        if (!s) return { ok: false, error: `unknown skill "${name}"`, available: store.index.map((i) => i.name) };
        ctx.onSkillLoaded(name);
        return { ok: true, skill: name, text: s.text, supportingFiles: s.extras };
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
      execute: async ({ key, value }) => result(await applyOp(ctx.goalId, (g) => writeSection(g, key, value) as never)),
    }),
    append_log: tool({
      description: 'Append one entry to the log, the only append-only key. date defaults to today.',
      inputSchema: z.object({
        date: z.string().optional(),
        assessment: z.enum(['on_track', 'at_risk', 'stalled', 'regressing']).optional(),
        focus: z.string().nullable(),
        focusLine: z.string().optional(),
        notes: z.array(z.string()),
        source: z.string().optional(),
      }),
      execute: async (entry) => result(await applyOp(ctx.goalId, (g) => appendLog(g, { ...entry, date: entry.date ?? today() }) as never)),
    }),
    set_status: tool({
      description: 'Flip one step, sub-item or next action to pending, done or dropped without rewriting the section (a next action can also be set to proposed). path is dotted, e.g. "plan.linesOfOperation.0.nextActions.2".',
      inputSchema: z.object({ path: z.string(), status: z.enum(['proposed', 'pending', 'done', 'dropped']) }),
      execute: async ({ path, status }) => result(await applyOp(ctx.goalId, (g) => setStatus(g, path, status) as never)),
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
    case 'write_section': return `wrote ${i.key}`;
    case 'set_status': return `${i.status}: ${String(i.path).split('.').slice(-2).join('.')}`;
    case 'append_log': return 'log entry';
    case 'read_skill_file': return `read ${i.skill}/${i.path}`;
    case 'get_goal': return 'read goal';
    case 'elicitation_methods': return 'method catalog';
    default: return name;
  }
}
