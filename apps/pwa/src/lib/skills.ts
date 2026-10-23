import guidedMd from '../../../../skills/_shared/GUIDED.md?raw';
import methodsCsv from '../../vendor/BMAD/methods.csv?raw';
import { skillFlow, type SkillFlow } from '@gambit/core';
import { pageGlossary } from './glossary';
import { LOCALES, locale } from './i18n';

const packGlob = import.meta.glob('../../../../skills/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const nativeGlob = import.meta.glob('../../skills/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const domainGlob = import.meta.glob('../../../../domain-skills/*/*/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const packGlobInfo = import.meta.glob('../../../../domain-skills/*/PACK.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const rel = (k: string) => k.slice(k.lastIndexOf('/skills/') + 1);
/** domain-skills/<pack>/<skill>/... is served as skills/<skill>/...: a pack
 * skill loads like any other, and its frontmatter `pack` gates it. */
const domainRel = (k: string) => `skills/${k.slice(k.lastIndexOf('/domain-skills/') + '/domain-skills/'.length).split('/').slice(1).join('/')}`;

export const bundledFiles: Record<string, string> = Object.fromEntries([
  ...Object.entries(packGlob).map(([k, v]) => [rel(k), v]),
  ...Object.entries(domainGlob).map(([k, v]) => [domainRel(k), v]),
]);
/** Where each domain pack skill's files came from, `positioning` → `business`. */
export const domainPackOf: Record<string, string> = Object.fromEntries(
  Object.keys(domainGlob).map((k) => k.slice(k.lastIndexOf('/domain-skills/') + '/domain-skills/'.length).split('/')).map(([pack, skill]) => [skill, pack]),
);
/** PWA-native skills ship with the app. */
/** Each domain pack's one-line description, from domain-skills/<pack>/PACK.md:
 * what the skill index shows of a pack the goal isn't marked with. */
export const packDescriptions: Record<string, string> = Object.fromEntries(
  Object.entries(packGlobInfo).map(([k, v]) => [k.split('/').at(-2)!, parseFrontmatter(v).meta.description ?? '']),
);
export const nativeFiles: Record<string, string> = Object.fromEntries(Object.entries(nativeGlob).map(([k, v]) => [rel(k), v]));

export function parseFrontmatter(md: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  if (!m) return { meta: {}, body: md };
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return { meta, body: md.slice(m[0].length) };
}

export interface SkillStore {
  files: Record<string, string>;
  index: { name: string; description: string; flow: SkillFlow }[];
  version: string;
}

let cache: SkillStore | null = null;

export function buildStore(packFiles: Record<string, string>, version: string): SkillStore {
  const files = { ...packFiles, ...nativeFiles };
  const index = Object.keys(files)
    .filter((p) => /^skills\/[^/_][^/]*\/SKILL\.md$/.test(p))
    .map((p) => {
      const { meta } = parseFrontmatter(files[p]);
      const name = p.split('/')[1];
      return { name, description: meta.description ?? '', flow: skillFlow(name, meta) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { files, index, version };
}

export async function getSkillStore(): Promise<SkillStore> {
  if (cache) return cache;
  cache = buildStore(bundledFiles, __APP_VERSION__);
  return cache;
}

export const skillFlows = (store: SkillStore): SkillFlow[] => store.index.map((i) => i.flow);
export const flowOf = (store: SkillStore, name: string): SkillFlow | undefined => store.index.find((i) => i.name === name)?.flow;

export function skillText(store: SkillStore, name: string): { text: string; extras: string[] } | null {
  const main = store.files[`skills/${name}/SKILL.md`];
  if (!main) return null;
  const prefix = `skills/${name}/`;
  const extras = Object.keys(store.files).filter((p) => p.startsWith(prefix) && p !== `${prefix}SKILL.md`).map((p) => p.slice(prefix.length));
  return { text: parseFrontmatter(main).body.trim(), extras };
}

export function skillFile(store: SkillStore, skill: string, path: string): string | null {
  if (path.split('/').includes('..') || path.startsWith('/')) return null;
  return store.files[`skills/${skill}/${path}`] ?? null;
}

// ---- Elicitation method catalog (ported BMAD data; owns no schema key) ----

export interface Method { num: number; category: string; name: string; description: string; pattern: string }

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function parseMethods(csv: string): Method[] {
  return csv.trim().split('\n').slice(1).filter(Boolean).map((l) => {
    const [num, category, name, description, pattern] = parseCsvLine(l);
    return { num: Number(num), category, name, description, pattern };
  });
}

export const methods = parseMethods(methodsCsv);

export function elicitationMethods(args: { command: string; categories?: string[]; names?: string[]; n?: number; exclude?: string[]; all?: boolean }) {
  const short = (m: Method) => `${m.num}. ${m.name} — ${m.description}`;
  switch (args.command) {
    case 'categories': {
      const counts: Record<string, number> = {};
      for (const m of methods) counts[m.category] = (counts[m.category] ?? 0) + 1;
      return counts;
    }
    case 'list': {
      const cats = args.all ? null : new Set(args.categories ?? []);
      return methods.filter((m) => !cats || cats.has(m.category)).map(short);
    }
    case 'show': {
      const want = new Set((args.names ?? []).map((s) => s.toLowerCase()));
      return methods.filter((m) => want.has(m.name.toLowerCase()) || want.has(String(m.num))).map((m) => ({ ...m }));
    }
    case 'random': {
      const ex = new Set((args.exclude ?? []).map((s) => s.toLowerCase()));
      const pool = methods.filter((m) => !ex.has(m.name.toLowerCase()) && !ex.has(String(m.num)));
      const byCat = new Map<string, Method[]>();
      for (const m of pool) byCat.set(m.category, [...(byCat.get(m.category) ?? []), m]);
      const picks: Method[] = [];
      const cats = [...byCat.keys()].sort(() => Math.random() - 0.5);
      for (let i = 0; picks.length < (args.n ?? 5) && cats.length && i < 50; i++) {
        const list = byCat.get(cats[i % cats.length])!;
        const m = list.splice(Math.floor(Math.random() * list.length), 1)[0];
        if (m) picks.push(m);
      }
      return picks.map(short);
    }
    default:
      return { error: 'command must be categories, list, show or random' };
  }
}

// ---- Surface preamble ----

export const guidedRules = guidedMd.trim();

const SHAPE_RULES = `Section shapes. Caps are hard: S = 40 chars, M = 120, D = 280 for optional detail. Date fields are YYYY-MM-DD; inside a sentence, write a date the way it is said ("19 Mar 2027"), never YYYY-MM-DD.`;

/** Each writable key's shape. Only the active skill's keys reach the model
 * (skillShapes): it can write no others, and the goal state reads as is. */
export const KEY_SHAPES: Record<string, string> = {
  goal: `goal: string, 10 words max — one plain idea, no dash-joined clauses. A write over 10 words is rejected; put parts or conditions in subGoals instead.`,
  subGoals: `subGoals?: [string] ≤5 entries, each ≤12 words / 100 chars — the parts or conditions of the aim itself (e.g. "without burning out"), not success criteria. Optional; omit if the goal has no distinct parts.`,
  successCriteria: `successCriteria: [{text ≤120, kind: control|influence, lineOfOperation?: S, detail?: D}] (at least 1) — what "done" looks like, measurable. Distinct from subGoals: a criterion is checked off; a sub-goal is a condition on the aim.`,
  deadline: `deadline: date | null`,
  people: `people: [{name: S, status: confirmed|tentative|lead, doing: M, detail?}] — anyone the user deals with directly; writing someone here takes them off stakeholders`,
  domains: `domains: [business|activism] — the domain packs this goal draws on; empty for a goal of no listed kind. Not shown on the page.`,
  posture: `posture: null | {current: {level: int ≥1, label: S}, levels: [{level, label: S, meaning?: M}], triggers: [M] ≤10, lastReviewed: date}`,
  plan: `plan: {linesOfOperation: [{label: S, focus?: true (the one line holding the Schwerpunkt; at most one), criticalPath: [{id: short-id, label: S (a milestone: a point the line passes, not a task), detail?, after: [task ids] ≥1 (the tasks that reach it; the page draws a line under them and writes the milestone beneath)}] ≤6 (no status: a milestone is reached once every task in its after is done or dropped, at least one done, and un-reached if one is unticked; ids shared with the tasks, so a task may list a milestone's id in its after and waits until it is reached), nextActions: [{id?: short-id (lower-case, digits, dashes; give one to any task another points at), action: M (a plain todo), who: S, when?: date (due by), status, doneOn?: date (stamped for you when it is done; keep it as is; for a message, the day it went out), detail?: D (required when proposed: why this, why now), after?: [id] ≤3 (tasks it waits on), if?: {noReply: id, days: int 1-90} (an escalation: due when that message went out and got no reply in days) | {event: ≤8 words (a fact outside the user's control, no leading "if"), by?: date (when to check), happened?: true} (a fork: a move made only if the event happens, never one the plan makes anyway; the page shows "if [event] then [move]", so the move never restates its condition and the event never says "by then"), to?: S (a message's recipient: a people or stakeholders name, verbatim, never the user), level?: interests|rights|power (an escalation's step: ask, formal channels, go public; never lower than the message it follows), replied?: date (they answered), reply?: M (what they said)}] ≤10, status?: on_schedule|at_risk|blocked|done, blocker?: M}]} (at least 1 line; the focus line, else the first, needs at least one task with if); a next action's status = pending|done|dropped, or proposed (a move you suggest that the user hasn't agreed to yet; they keep or toss it)`,
  systemsNotes: `systemsNotes: null | {schwerpunkt: M, rationale?: M, confidence: high|moderate|low, topFindings: [{label: M, detail?, items?}] ≤5, lastReviewed: date}`,
  riskNotes: `riskNotes: [{item: M, detail?: M, source: threat|premortem|backfire, accepted: boolean, dependsOn?: S (a people or stakeholders name, verbatim)}]`,
  criteriaStatus: `criteriaStatus: [{text ≤120, kind, lineOfOperation?, status: met|on_track|at_risk|stalled|regressing, detail?}]`,
  stakeholders: `stakeholders: [{name: S, power: high|med|low, stanceCurrent: S, stanceTarget: S, via: M, detail?}] — everyone else with a say; a name already in people is refused`,
  exposure: `exposure: [{item: M, status: open|accepted, mustHandleBefore?: S, acceptedDate?: date, why?: M}]`,
  capacity: `capacity: null | {availableHrsPerWeek: number ≥0 | null, runway: S, watch?: M, detail?, lastReviewed: date}`,
  forecasts: `forecasts: [{statement: M, probability: int 0-100, resolvesBy: date, resolvesVia: S, resolved: boolean, outcome?: yes|no, verdict?: M, detail?}]`,
  experiments: `experiments: [{assumption: M, test: M, passIf: M, by: date, done: boolean, result?: M, changedAsResult?: M, detail?}]`,
  decisions: `decisions: [{date, status?: open|decided (default decided), question?: M, choice?: M, because?: M, reverseIf?: M, reviewBy?: date}]; open needs question, decided needs choice and reverseIf`,
  intel: `intel: [{question: M, why?: M, by?: date, via: S (how to find out), status: open|answered, answer?: M}] ≤8 — open questions whose answer would change the plan`,
  courses: `courses: [{name: S, idea: M, wins?: M (why it could win), risks?: M, counter?: M (their likely reaction, and our answer), chosen?: true}] ≤3; at most one chosen`,
  prep: `prep: [{with: S (a people or stakeholders name, verbatim), on?: date, ask: M, batna: M, walkAway: M, concessions: [S] ≤5, done: boolean, outcome?: M}] ≤5 — one entry per conversation to prepare`,
};

/** The shapes every turn needs: the caps, the log entry and memory, which
 * nearly every skill writes. */
export const SECTION_SHAPES = `${SHAPE_RULES}
The shapes of the keys a skill writes come with it when it loads.
log entry (append_log): {date?, assessment?: on_track|at_risk|stalled|regressing, focus: ≤160 | null, focusLine?: ≤120 (strategy only: verbatim text of the one criterion, next action or step the focus lands on; the page highlights it), notes: [M] ≤3 — what happened or was decided in this exchange, never a restatement of the situation; source?: S}
memory entry (remember / forget, any skill or none): {kind: fact|preference|constraint|rejected, text: M, date (set for you)} ≤20 entries; pass replaces: index to correct one in place`;

/** The page is in one language; the user may write in another. */
export function languageRule(l = locale()): string {
  const name = LOCALES[l];
  return `The page is in ${name}. Reply, and write everything that goes on the goal, in the language the user writes to you in; until they have written, use ${name}. Tool names, key names and fixed values (statuses, kinds, levels, sources) stay in English: the page puts those in the user's language itself. The page's words in "What the user sees" below are in ${name}, as the user reads them. The rules for goal text (word caps, plain words, one phrase per fork) hold in every language.`;
}

export const PREAMBLE = `You are Gambit, a strategic advisor running inside a local-first web app. The user's goal lives in an on-device store and is shown live on a dashboard beside this chat.

# Surface
- The active goal is supplied below in "Current goal state" — nothing needs resolving. To start another goal, the user uses the New goal button or the goal switcher.
- You change the goal only through tools: write_section(key, value) replaces a key wholesale with the skill's owned value; set_status flips a single next action; append_log adds one log entry; remember and forget edit memory. There is no other write path.
- Chat history is short: only the newest exchanges reach you. The goal state, memory included, is what you know for certain. When the user tells you something you will need later and no goal key holds it, call remember in the same turn. A move they turn down goes in as rejected, and you never propose it again unless they reopen it. A correction replaces the entry it corrects.
- The user can also edit the page directly: reword a line, add a move, tick or drop one. The state block lists those edits since your last turn. They are the user's own word, so never revert or reword them.
- Every write validates automatically and returns structured errors with field paths. If a call returns ok: false, fix exactly those fields and call again before ending the turn.
- Every turn ends with exactly one reply(say, bottomLine, kind, options) call, after any writes. It is the only part of the turn the user sees by default, and stays under 80 words in all; see the guided-session rules below.
- Shared docs referenced by skills (for example skills/_shared/HUMANIZE.md) are read with read_skill_file("_shared", "HUMANIZE.md").
- Research: you have no live web access unless a web_search tool is present. Without it, say plainly that a claim is unverified instead of proceeding as if it had been checked.

# Language
${languageRule()}

# Skills
The skill index below lists every skill. When one applies, call load_skill(name) and follow it as a multi-turn guided session. It stays the active skill until you load another or call finish_skill. Do not load a skill for a passing remark that needs no skill. Hand off between skills silently.
- Only the active skill writes, and only the keys it declares; the state block below names them. To write another key, load the skill that writes it. A user reporting a next action done, blocked or dropped goes to \`plan\`.
- A skill that writes shows the user its read as a confirm reply and writes after they answer, so never in the turn it was loaded. Status flips and log entries are the exception.
- A skill that needs a defined goal won't load on a stub; \`intake\` defines it.
- \`elicit\` runs inside the active skill: it pressure-tests that skill's work, then finish_skill hands back to it.
- When the user brings several updates at once, load \`sitrep\`: it routes each to its skill with route_updates, and once they confirm, the state block lists the routed updates to load and write in that turn.
- When a skill's work is done and nothing follows, call finish_skill. To move on, load the next skill.
- Every goal moves through one method, in order: define, understand, direct, develop, plan, stress, then run and loop back to direct. Each skill belongs to one phase, and each phase asks only what the goal calls for. The state block names where the goal sits.
- The state block lists what is due now: dated items first, then the method's next phase. Lead with the most pressing item when the user has no ask of their own.
- A load_skill result with a warning means that skill skips a phase of the method. Say so in one line and offer the skipped phase's skill first; go ahead if the user still wants theirs.
- An item due because its inputs changed ("stakeholders changed since systems last ran") means that section rests on an older picture. Say so before building on it, and offer to rerun its skill.
A refused load or write comes back as an error naming the rule; follow it in the same turn.

# ${'The goal contract, in short'}
Each top-level key replaces its value wholesale; \`log\` is the only append-only array, and \`memory\` changes one entry at a time. Every key reads as current state, with no history in the file. The goal sentence itself is capped at 10 words on every new write — if an existing goal is longer, propose a shorter one, confirm it with the user, then write it (and move whatever it drops into subGoals).

${SECTION_SHAPES}

${pageGlossary()}

${guidedRules}`;

/**
 * The shapes of the keys a skill writes, and of those its section is built
 * from. A skill that writes no section of its own (brief, sitrep, onboard)
 * reads the whole goal, so it gets every shape.
 */
export function skillShapes(store: SkillStore, name: string): string {
  const flow = flowOf(store, name);
  if (!flow) return '';
  const own = [...flow.writes, ...flow.reads].filter((k) => k in KEY_SHAPES);
  const keys = flow.writes.some((k) => k in KEY_SHAPES) ? [...new Set(own)] : Object.keys(KEY_SHAPES);
  return keys.length ? `Shapes of the keys ${name} works with:\n${keys.map((k) => KEY_SHAPES[k]).join('\n')}` : '';
}

/**
 * The skill index for one goal: every core skill, and the skills of each
 * pack the goal is marked with. A pack it isn't marked with is one line,
 * so a pack that fits can still be offered without every pack's skills
 * in every prompt.
 */
export function skillIndexText(store: SkillStore, domains: readonly string[] = []): string {
  const on = new Set(domains);
  const lines = store.index
    .filter((s) => !s.flow.pack || on.has(s.flow.pack))
    .map((s) => `- ${s.name}${s.flow.pack ? ` [${s.flow.pack} pack]` : ''}: ${s.description}`);
  const off = Object.keys(packDescriptions).filter((p) => !on.has(p)).sort().map((p) => {
    const skills = store.index.filter((s) => s.flow.pack === p).map((s) => s.name).join(', ');
    return `- ${p} pack (${skills}): ${packDescriptions[p]} Not on this goal: if it fits, ask the user in one line, then load intake to mark the goal ${p}.`;
  });
  return `# Skill index\n${[...lines, ...(off.length ? ['', 'Domain packs this goal is not marked with:', ...off] : [])].join('\n')}`;
}
