import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, setSetting } from '../lib/db';
import { fmtUsd, getPricingOverride, sessionCost } from '../lib/cost';
import { TextAction, Field, inputCls } from './ui';
import { t, intlLocale } from '../lib/i18n';

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
      <p className="text-[14px] text-graphite">{t('app.cost.estimated')}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[14px] text-graphite">{t('app.cost.spend')}</div>
          <div className="text-[20px] text-ink">{fmtUsd(c.dollars)}</div>
        </div>
        <div>
          <div className="text-[14px] text-graphite">{t('app.cost.turnsSkills')}</div>
          <div className="text-[20px] text-ink">{c.turns} · {c.skillLoads}</div>
        </div>
      </div>
      <div className="text-[14px] text-graphite">{t('app.cost.tokens', { input: c.input.toLocaleString(intlLocale()), cached: c.cached.toLocaleString(intlLocale()), output: c.output.toLocaleString(intlLocale()) })}</div>
      <div>
        <div className="mb-1 text-[14px] text-graphite">{t('app.cost.eachPrompt')}</div>
        {(['history', 'skill', 'system', 'state'] as const).map((k) => (
          <div key={k} className="flex items-center gap-2 border-b border-card-rule py-1.5 text-[14px]">
            <span className="w-28 text-graphite">{t(`app.cost.part.${k}`)}</span>
            <div className="h-1 flex-1 bg-rule"><div className="h-1 bg-ink" style={{ width: pct(c.shares[k]) }} /></div>
            <span className="w-9 text-right text-graphite">{pct(c.shares[k])}</span>
          </div>
        ))}
        {c.shares.history > 0.5 && <p className="mt-1 text-[14px] text-graphite">{t('app.cost.clearing')}</p>}
      </div>
      <details className="text-[14px]">
        <summary className="cursor-pointer text-graphite">{t('app.cost.override')}{override ? ` — ${override.in}/${override.out}` : ''}</summary>
        <div className="mt-2 flex items-end gap-3">
          <Field label={t('app.cost.input')}><input className={inputCls} inputMode="decimal" value={inP} onChange={(e) => setIn(e.target.value)} /></Field>
          <Field label={t('app.cost.output')}><input className={inputCls} inputMode="decimal" value={outP} onChange={(e) => setOut(e.target.value)} /></Field>
          <TextAction className="underline underline-offset-[3px]" onClick={() => void setSetting('pricing', inP && outP ? { in: Number(inP), out: Number(outP) } : undefined)}>{t('app.cost.save')}</TextAction>
        </div>
      </details>
      <TextAction className="underline underline-offset-[3px]" onClick={() => confirm(t('app.cost.confirmReset')) && void db.usage.clear()}>{t('app.cost.reset')}</TextAction>
    </div>
  );
}
