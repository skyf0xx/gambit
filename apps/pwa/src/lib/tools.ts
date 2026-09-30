import { tool } from 'ai';
import { z } from 'zod';
import { writeSection, appendLog, setStatus, WRITABLE_KEYS } from '@gambit/core';
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

export function makeTools(ctx: ToolContext) {
  return {
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
        value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.any()), z.record(z.any())]).describe('The complete new value for the key, matching the section shapes in the system prompt.'),
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
