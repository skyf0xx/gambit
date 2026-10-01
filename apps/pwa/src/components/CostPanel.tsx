import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, setSetting } from '../lib/db';
import { fmtUsd, getPricingOverride, sessionCost } from '../lib/cost';
import { TextAction, Field, inputCls } from './ui';

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
    <div className="space-y-3 text-[17px]">
      <p className="text-[14px] text-graphite">Estimated from list prices. Your provider's bill is final.</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[14px] text-graphite">Spend</div>
          <div className="text-[20px] text-ink">{fmtUsd(c.dollars)}</div>
        </div>
        <div>
          <div className="text-[14px] text-graphite">Turns · skill loads</div>
          <div className="text-[20px] text-ink">{c.turns} · {c.skillLoads}</div>
        </div>
      </div>
      <div className="text-[14px] text-graphite">Tokens: {c.input.toLocaleString()} in, {c.cached.toLocaleString()} cached, {c.output.toLocaleString()} out</div>
      <div>
        <div className="mb-1 text-[14px] text-graphite">What each prompt is made of</div>
        {(['history', 'skill', 'system', 'state'] as const).map((k) => (
          <div key={k} className="flex items-center gap-2 border-b border-card-rule py-1.5 text-[14px]">
            <span className="w-28 text-graphite">{{ history: 'Transcript', skill: 'Active skill', system: 'Instructions + index', state: 'Goal state' }[k]}</span>
            <div className="h-1 flex-1 bg-rule"><div className="h-1 bg-ink" style={{ width: pct(c.shares[k]) }} /></div>
            <span className="w-9 text-right text-graphite">{pct(c.shares[k])}</span>
          </div>
        ))}
        {c.shares.history > 0.5 && <p className="mt-1 text-[14px] text-graphite">The chat is over half of each request. Clearing it cuts cost; your goal is kept.</p>}
      </div>
      <details className="text-[14px]">
        <summary className="cursor-pointer text-graphite">Price override (USD per million tokens){override ? ` — ${override.in}/${override.out}` : ''}</summary>
        <div className="mt-2 flex items-end gap-3">
          <Field label="Input"><input className={inputCls} inputMode="decimal" value={inP} onChange={(e) => setIn(e.target.value)} /></Field>
          <Field label="Output"><input className={inputCls} inputMode="decimal" value={outP} onChange={(e) => setOut(e.target.value)} /></Field>
          <TextAction className="underline underline-offset-[3px]" onClick={() => void setSetting('pricing', inP && outP ? { in: Number(inP), out: Number(outP) } : undefined)}>Save</TextAction>
        </div>
      </details>
      <TextAction className="underline underline-offset-[3px]" onClick={() => confirm('Delete usage history?') && void db.usage.clear()}>Reset usage</TextAction>
    </div>
  );
}
