import { db, getSetting, type UsageRecord } from './db';

// Rough public list prices in USD per million tokens. Estimates only; the
// user can override them in Settings.
const TABLE: [RegExp, { in: number; out: number }][] = [
  [/opus/i, { in: 15, out: 75 }],
  [/sonnet/i, { in: 3, out: 15 }],
  [/haiku/i, { in: 1, out: 5 }],
  [/gpt-4\.1-mini/i, { in: 0.4, out: 1.6 }],
  [/gpt-4\.1/i, { in: 2, out: 8 }],
];

export interface Pricing { in: number; out: number }
export const getPricingOverride = () => getSetting<Pricing>('pricing');

export function priceFor(model: string, override?: Pricing): Pricing | null {
  if (override) return override;
  return TABLE.find(([re]) => re.test(model))?.[1] ?? null;
}

export function costOf(u: Pick<UsageRecord, 'input' | 'cached' | 'output' | 'model'>, p: Pricing | null): number | null {
  if (!p) return null;
  return (u.input * p.in + u.cached * p.in * 0.1 + u.output * p.out) / 1e6;
}

export interface SessionCost {
  turns: number;
  input: number;
  cached: number;
  output: number;
  dollars: number | null;
  skillLoads: number;
  /** Share of prompt characters by component. */
  shares: { system: number; skill: number; state: number; history: number };
  recent: { ts: number; dollars: number | null; tokens: number }[];
}

export async function sessionCost(since: number): Promise<SessionCost> {
  const rows = await db.usage.where('ts').aboveOrEqual(since).toArray();
  const override = await getPricingOverride();
  const parts = { system: 0, skill: 0, state: 0, history: 0 };
  let dollars: number | null = 0;
  const s: SessionCost = { turns: rows.length, input: 0, cached: 0, output: 0, dollars: 0, skillLoads: 0, shares: parts, recent: [] };
  for (const r of rows) {
    s.input += r.input; s.cached += r.cached; s.output += r.output; s.skillLoads += r.skillLoads;
    for (const k of Object.keys(parts) as (keyof typeof parts)[]) parts[k] += r.parts[k];
    const c = costOf(r, priceFor(r.model, override));
    dollars = dollars === null || c === null ? null : dollars + c;
    s.recent.push({ ts: r.ts, dollars: c, tokens: r.input + r.cached + r.output });
  }
  const total = Object.values(parts).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(parts) as (keyof typeof parts)[]) parts[k] = parts[k] / total;
  s.dollars = dollars;
  s.recent = s.recent.slice(-5);
  return s;
}

export const fmtUsd = (n: number | null) => (n === null ? 'n/a' : n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`);
