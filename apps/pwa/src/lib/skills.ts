import { db, getSetting } from './db';
import agentsMd from '../../../../AGENTS.md?raw';
import methodsCsv from '../../../../vendor-skills/BMAD/core-skills/bmad-advanced-elicitation/assets/methods.csv?raw';

const packGlob = import.meta.glob('../../../../skills/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const nativeGlob = import.meta.glob('../../skills/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const rel = (k: string) => k.slice(k.lastIndexOf('/skills/') + 1);

export const bundledFiles: Record<string, string> = Object.fromEntries(Object.entries(packGlob).map(([k, v]) => [rel(k), v]));
/** PWA-native skills ship with the app, not the skill pack. */
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
export const invalidateSkills = () => { cache = null; };

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
  const id = await getSetting<string>('activePack');
  const pack = id ? await db.skillPacks.get(id) : undefined;
  cache = pack ? buildStore(pack.files, pack.version) : buildStore(bundledFiles, __PACK_VERSION__);
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
export const methodsLicense = () => import('../../../../vendor-skills/BMAD/ATTRIBUTION.md?raw').then((m) => m.default);

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

const guided = (() => {
  const a = agentsMd.indexOf('## Guided, not just capable');
  const b = agentsMd.indexOf('## Working on this repo');
  const section = a >= 0 ? agentsMd.slice(a, b > a ? b : undefined) : '';
  // The CLI-only validation paragraph is rebound below, not repeated.
  return section.replace(/\*\*Validate every write\.\*\*[\s\S]*?(?=\n\*\*Write GOAL\.json fields)/, '').trim();
})();
export const guidedRules = guided;

export const SECTION_SHAPES = `Section shapes. Caps are hard: S = 40 chars, M = 120, D = 280 for optional detail. Dates are YYYY-MM-DD.
goal: string ≤200
successCriteria: [{text ≤120, kind: control|influence, lineOfOperation?: S, detail?: D}] (at least 1)
deadline: date | null
people: [{name: S, status: confirmed|tentative|lead, doing: M, detail?}]
posture: null | {current: {level: int ≥1, label: S}, levels: [{level, label: S, meaning?: M}], triggers: [M] ≤10, lastReviewed: date}
plan: {linesOfOperation: [{label: S, criticalPath: [{label: S, detail?, items?: [{label: S, status}] ≤10, status}] ≤6, nextActions: [{action: M, who: S, when: S, status, detail?}] ≤5, status?: on_schedule|at_risk|blocked|done, blocker?: M}]} (at least 1 line); status = pending|done|dropped
systemsNotes: null | {schwerpunkt: M, rationale?: M, confidence: high|moderate|low, topFindings: [{label: M, detail?, items?}] ≤5, lastReviewed: date}
riskNotes: [{item: M, detail?: M, source: threat|premortem, accepted: boolean}]
criteriaStatus: [{text ≤120, kind, lineOfOperation?, status: on_track|at_risk|stalled|regressing, detail?}]
stakeholders: [{name: S, power: high|med|low, stanceCurrent: S, stanceTarget: S, via: M, detail?}]
exposure: [{item: M, status: open|accepted, mustHandleBefore?: S, acceptedDate?: date, why?: M}]
capacity: null | {availableHrsPerWeek: number ≥0 | null, runway: S, watch?: M, detail?, lastReviewed: date}
forecasts: [{statement: M, probability: int 0-100, resolvesBy: date, resolvesVia: S, resolved: boolean, outcome?: yes|no, verdict?: M, detail?}]
experiments: [{assumption: M, test: M, passIf: M, by: date, done: boolean, result?: M, changedAsResult?: M, detail?}]
decisions: [{date, choice: M, because?: M, reverseIf: M, reviewBy?: date}]
log entry (append_log): {date?, assessment?: on_track|at_risk|stalled|regressing, focus: ≤160 | null, notes: [M] ≤200, source?: S}`;

export const PREAMBLE = `You are Gambit, a strategic advisor running inside a local-first web app. The user's goal lives in an on-device store and is shown live on a dashboard beside this chat. You change it only through tools; every write is validated and appears on the dashboard as it lands.

# Surface bindings
Gambit skills were written for a command-line agent that has a shell and a file editor. Here there is neither. Apply skill text with these bindings:
- Never run, quote or mention \`gambit\` commands. \`gambit path\`, \`gambit list\` and \`gambit switch\` are unnecessary: the active goal is supplied below in "Current goal state". Anything in a skill about resolving GOAL.json is already done. To start another goal, the user uses the New goal button or the goal switcher.
- "Edit GOAL.json" means: call write_section(key, value) with the complete new value for the key the skill owns. It replaces that key wholesale. Use set_status for a single step, sub-item or next-action flip, and append_log for the log. There is no other write path.
- "Run gambit check" is built in: every write tool validates and returns structured errors with field paths. If a call returns ok: false, fix exactly those fields and call again before ending the turn.
- "Open the visualizer" is dropped: the dashboard is always visible.
- Skip the GitHub star prompt and any update notice.
- New-goal intake: when the goal is still a stub (its only success criterion is the placeholder "define success criteria"), load the \`intake\` skill instead of running any vendored BMAD skill or the \`uv\` gate. For an elicitation checkpoint, load the \`elicit\` skill.
- Shared docs referenced by skills (for example skills/_shared/HUMANIZE.md) are read with read_skill_file("_shared", "HUMANIZE.md").
- Research: you have no live web access unless a web_search tool is present. Without it, say plainly that a claim is unverified instead of proceeding as if it had been checked.

# Skills
The skill index below lists every skill. When one applies, call load_skill(name) and follow it as a multi-turn guided session; the loaded skill stays active until you load another. Do not load a skill for a passing remark that needs no skill. When you hand off between skills, do it silently.

# ${'The GOAL.json contract, in short'}
Each top-level key has exactly one owning skill, which replaces its value wholesale; \`log\` is the only append-only array. Every key reads as current state, with no history in the file.

${SECTION_SHAPES}

${guided}`;

export function skillIndexText(store: SkillStore): string {
  return `# Skill index\n${store.index.map((s) => `- ${s.name}: ${s.description}`).join('\n')}`;
}
