import guidedMd from '../../../../skills/_shared/GUIDED.md?raw';
import methodsCsv from '../../vendor/BMAD/methods.csv?raw';
import { pageGlossary } from './glossary';

const packGlob = import.meta.glob('../../../../skills/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const nativeGlob = import.meta.glob('../../skills/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const rel = (k: string) => k.slice(k.lastIndexOf('/skills/') + 1);

export const bundledFiles: Record<string, string> = Object.fromEntries(Object.entries(packGlob).map(([k, v]) => [rel(k), v]));
/** PWA-native skills ship with the app. */
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
  index: { name: string; description: string }[];
  version: string;
}

let cache: SkillStore | null = null;

export function buildStore(packFiles: Record<string, string>, version: string): SkillStore {
  const files = { ...packFiles, ...nativeFiles };
  const index = Object.keys(files)
    .filter((p) => /^skills\/[^/_][^/]*\/SKILL\.md$/.test(p))
    .map((p) => {
      const { meta } = parseFrontmatter(files[p]);
      return { name: p.split('/')[1], description: meta.description ?? '' };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { files, index, version };
}

export async function getSkillStore(): Promise<SkillStore> {
  if (cache) return cache;
  cache = buildStore(bundledFiles, __APP_VERSION__);
  return cache;
}

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
export const methodsLicense = () => import('../../vendor/BMAD/ATTRIBUTION.md?raw').then((m) => m.default);

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

export const SECTION_SHAPES = `Section shapes. Caps are hard: S = 40 chars, M = 120, D = 280 for optional detail. Date fields are YYYY-MM-DD; inside a sentence, write a date the way it is said ("19 Mar 2027"), never YYYY-MM-DD.
goal: string, 10 words max — one plain idea, no dash-joined clauses. A write over 10 words is rejected; put parts or conditions in subGoals instead.
subGoals?: [string] ≤5 entries, each ≤12 words / 100 chars — the parts or conditions of the aim itself (e.g. "without burning out"), not success criteria. Optional; omit if the goal has no distinct parts.
successCriteria: [{text ≤120, kind: control|influence, lineOfOperation?: S, detail?: D}] (at least 1) — what "done" looks like, measurable. Distinct from subGoals: a criterion is checked off; a sub-goal is a condition on the aim.
deadline: date | null
people: [{name: S, status: confirmed|tentative|lead, doing: M, detail?}] — anyone the user deals with directly; writing someone here takes them off stakeholders
posture: null | {current: {level: int ≥1, label: S}, levels: [{level, label: S, meaning?: M}], triggers: [M] ≤10, lastReviewed: date}
plan: {linesOfOperation: [{label: S, focus?: true (the one line holding the Schwerpunkt; at most one), criticalPath: [{label: S, detail?, items?: [{label: S, status}] ≤10, status}] ≤6, nextActions: [{action: M, who: S, when: S, status, detail?: D (required when proposed: why this, why now)}] ≤5, status?: on_schedule|at_risk|blocked|done, blocker?: M}]} (at least 1 line); status = pending|done|dropped, and a next action may also be proposed (a move you suggest that the user hasn't agreed to yet; they keep or toss it)
systemsNotes: null | {schwerpunkt: M, rationale?: M, confidence: high|moderate|low, topFindings: [{label: M, detail?, items?}] ≤5, lastReviewed: date}
riskNotes: [{item: M, detail?: M, source: threat|premortem, accepted: boolean, dependsOn?: S (a people or stakeholders name, verbatim)}]
criteriaStatus: [{text ≤120, kind, lineOfOperation?, status: met|on_track|at_risk|stalled|regressing, detail?}]
stakeholders: [{name: S, power: high|med|low, stanceCurrent: S, stanceTarget: S, via: M, detail?}] — everyone else with a say; a name already in people is refused
exposure: [{item: M, status: open|accepted, mustHandleBefore?: S, acceptedDate?: date, why?: M}]
capacity: null | {availableHrsPerWeek: number ≥0 | null, runway: S, watch?: M, detail?, lastReviewed: date}
forecasts: [{statement: M, probability: int 0-100, resolvesBy: date, resolvesVia: S, resolved: boolean, outcome?: yes|no, verdict?: M, detail?}]
experiments: [{assumption: M, test: M, passIf: M, by: date, done: boolean, result?: M, changedAsResult?: M, detail?}]
decisions: [{date, status?: open|decided (default decided), question?: M, choice?: M, because?: M, reverseIf?: M, reviewBy?: date}]; open needs question, decided needs choice and reverseIf
log entry (append_log): {date?, assessment?: on_track|at_risk|stalled|regressing, focus: ≤160 | null, focusLine?: ≤120 (verbatim text of the one criterion, next action or step the focus lands on), notes: [M] ≤200, source?: S}`;

export const PREAMBLE = `You are Gambit, a strategic advisor running inside a local-first web app. The user's goal lives in an on-device store and is shown live on a dashboard beside this chat.

# Surface
- The active goal is supplied below in "Current goal state" — nothing needs resolving. To start another goal, the user uses the New goal button or the goal switcher.
- You change the goal only through tools: write_section(key, value) replaces a key wholesale with the skill's owned value; set_status flips a single step, sub-item, or next-action; append_log adds one log entry. There is no other write path.
- Every write validates automatically and returns structured errors with field paths. If a call returns ok: false, fix exactly those fields and call again before ending the turn.
- Every turn ends with exactly one reply(say, bottomLine, kind, options) call, after any writes. It is the only part of the turn the user sees by default, and stays under 80 words in all; see the guided-session rules below.
- New-goal intake: when the goal is still a stub (its only success criterion is the placeholder "define success criteria"), load the \`intake\` skill. For an elicitation checkpoint, load the \`elicit\` skill.
- Shared docs referenced by skills (for example skills/_shared/HUMANIZE.md) are read with read_skill_file("_shared", "HUMANIZE.md").
- Research: you have no live web access unless a web_search tool is present. Without it, say plainly that a claim is unverified instead of proceeding as if it had been checked.

# Skills
The skill index below lists every skill. When one applies, call load_skill(name) and follow it as a multi-turn guided session; the loaded skill stays active until you load another. Do not load a skill for a passing remark that needs no skill. When you hand off between skills, do it silently.

# ${'The goal contract, in short'}
Each top-level key has exactly one owning skill, which replaces its value wholesale; \`log\` is the only append-only array. Every key reads as current state, with no history in the file. The goal sentence itself is capped at 10 words on every new write — if an existing goal is longer, propose a shorter one, confirm it with the user, then write it (and move whatever it drops into subGoals).

${SECTION_SHAPES}

${pageGlossary()}

${guidedRules}`;

export function skillIndexText(store: SkillStore): string {
  return `# Skill index\n${store.index.map((s) => `- ${s.name}: ${s.description}`).join('\n')}`;
}
