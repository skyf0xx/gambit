import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, setSetting } from '../lib/db';
import { fmtUsd, getPricingOverride, sessionCost } from '../lib/cost';
import { Btn, Field, inputCls } from './ui';

const SESSION_START = Date.now() - 6 * 3600_000;
export const sessionStart = () => SESSION_START;

export function useSessionCost() {
  return useLiveQuery(() => sessionCost(SESSION_START), []);
}

export function CostPanel() {
  const c = useSessionCost();
  const override = useLiveQuery(() => getPricingOverride(), []);
  const [inP, setIn] = useState('');
  const [outP, setOut] = useState('');
  if (!c) return null;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-slate-500">Estimated from token counts and public list prices for the last six hours. Your provider's invoice is the authority.</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-slate-900 p-3"><div className="text-xs text-slate-500">Spend</div><div className="text-lg">{fmtUsd(c.dollars)}</div></div>
        <div className="rounded-md bg-slate-900 p-3"><div className="text-xs text-slate-500">Turns · skill loads</div><div className="text-lg">{c.turns} · {c.skillLoads}</div></div>
      </div>
      <div className="text-xs text-slate-400">Tokens: {c.input.toLocaleString()} in, {c.cached.toLocaleString()} cached, {c.output.toLocaleString()} out</div>
      <div>
        <div className="mb-1 text-xs text-slate-500">What each prompt is made of</div>
        {(['history', 'skill', 'system', 'state'] as const).map((k) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-28 text-slate-400">{{ history: 'Transcript', skill: 'Active skill', system: 'Instructions + index', state: 'Goal state' }[k]}</span>
            <div className="h-2 flex-1 rounded bg-slate-800"><div className={`h-2 rounded ${k === 'history' ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: pct(c.shares[k]) }} /></div>
            <span className="w-9 text-right text-slate-500">{pct(c.shares[k])}</span>
          </div>
        ))}
        {c.shares.history > 0.5 && <p className="mt-1 text-xs text-amber-300">The transcript is over half of every request. Clearing the chat is the cheapest fix; the goal itself is kept.</p>}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-400">Price override (USD per million tokens){override ? ` — ${override.in}/${override.out}` : ''}</summary>
        <div className="mt-2 flex items-end gap-2">
          <Field label="Input"><input className={inputCls} inputMode="decimal" value={inP} onChange={(e) => setIn(e.target.value)} /></Field>
          <Field label="Output"><input className={inputCls} inputMode="decimal" value={outP} onChange={(e) => setOut(e.target.value)} /></Field>
          <Btn onClick={() => void setSetting('pricing', inP && outP ? { in: Number(inP), out: Number(outP) } : undefined)}>Save</Btn>
        </div>
      </details>
      <Btn onClick={() => confirm('Delete usage history?') && void db.usage.clear()}>Reset usage</Btn>
    </div>
  );
}
