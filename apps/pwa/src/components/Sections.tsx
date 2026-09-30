import type { ReactNode } from 'react';
import { rendererForSection, setStatus } from '@gambit/core';
import { applyOp } from '../lib/goals';
import type { Goal } from '../lib/types';
import { Pill } from './ui';

export const formatDate = (s?: string | null) => {
  const m = s && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s ?? '';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

export const titleForKey = (k: string) => {
  const s = k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

type Any = any; // section payloads are validated by the schema before they reach here

export function hintFor(key: string, d: Any): string {
  const count = (a: Any[], f: (x: Any) => boolean) => a.filter(f).length;
  switch (key) {
    case 'plan': { const l = d.linesOfOperation as Any[]; const off = count(l, (x) => x.status && x.status !== 'on_schedule' && x.status !== 'done'); return `${l.length} line${l.length === 1 ? '' : 's'}${off ? ` · ${off} need attention` : ''}`; }
    case 'criteriaStatus': { const c: Record<string, number> = {}; for (const x of d) c[x.status] = (c[x.status] ?? 0) + 1; return Object.entries(c).map(([s, n]) => `${n} ${s.replace('_', ' ')}`).join(' · '); }
    case 'people': return `${d.length} tracked · ${count(d, (p) => p.status === 'confirmed')} confirmed`;
    case 'stakeholders': return `${d.length} tracked`;
    case 'riskNotes': return `${count(d, (r) => !r.accepted)} open · ${count(d, (r) => r.accepted)} accepted`;
    case 'decisions': return formatDate(d[d.length - 1]?.date);
    case 'forecasts': return `${count(d, (f) => !f.resolved)} open · ${count(d, (f) => f.resolved)} scored`;
    case 'experiments': return `${count(d, (e) => e.done)} done · ${count(d, (e) => !e.done)} running`;
    case 'exposure': return `${count(d, (e) => e.status === 'open')} open · ${count(d, (e) => e.status === 'accepted')} accepted`;
    case 'capacity': return [d.availableHrsPerWeek != null && `${d.availableHrsPerWeek} hrs/wk`, d.runway && `${d.runway} runway`].filter(Boolean).join(' · ');
    case 'systemsNotes': return `${d.confidence} confidence`;
    default: return '';
  }
}

const toneFor = (s: string) => (['met', 'on_track', 'confirmed', 'done', 'on_schedule', 'yes'].includes(s) ? 'green' : ['at_risk', 'tentative', 'med', 'open'].includes(s) ? 'amber' : ['stalled', 'regressing', 'blocked', 'high'].includes(s) ? 'red' : 'slate') as 'green' | 'amber' | 'red' | 'slate';
const St = ({ s }: { s: string }) => <Pill tone={toneFor(s)}>{s.replace('_', ' ')}</Pill>;
const Detail = ({ children }: { children?: ReactNode }) => (children ? <div className="mt-0.5 text-xs text-slate-500">{children}</div> : null);
const icon = (s: string) => (s === 'done' ? '✓' : s === 'dropped' ? '✕' : s === 'proposed' ? '?' : '○');

function Toggle({ goalId, path, status, editable, children }: { goalId: string; path: string; status: string; editable: boolean; children: ReactNode }) {
  const next = status === 'done' || status === 'proposed' ? 'pending' : 'done';
  const cls = status === 'done' ? 'text-slate-500 line-through' : status === 'dropped' ? 'text-slate-600 line-through' : 'text-slate-200';
  return (
    <li className={`flex items-start gap-2 text-sm ${cls}`}>
      <button
        disabled={!editable}
        title={editable ? `Mark ${next}` : undefined}
        className={`mt-0.5 w-4 shrink-0 text-left ${editable ? 'hover:text-sky-300' : 'cursor-default'}`}
        onClick={() => void applyOp(goalId, (g) => setStatus(g, path, next) as never)}
      >{icon(status)}</button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function Steps({ goalId, base, steps, editable }: { goalId: string; base: string; steps: Any[]; editable: boolean }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => (
        <Toggle key={i} goalId={goalId} path={`${base}.${i}`} status={s.status} editable={editable}>
          <span>{s.label}</span>
          <Detail>{s.detail}</Detail>
          {s.items?.length > 0 && (
            <ul className="mt-1 space-y-1 pl-1">
              {s.items.map((it: Any, j: number) => (
                <Toggle key={j} goalId={goalId} path={`${base}.${i}.items.${j}`} status={it.status} editable={editable}><span className="text-xs">{it.label}</span></Toggle>
              ))}
            </ul>
          )}
        </Toggle>
      ))}
    </ol>
  );
}

export function SectionBody({ k, data, goalId, editable }: { k: keyof Goal; data: Any; goalId: string; editable: boolean }) {
  const type = rendererForSection(k);

  if (k === 'plan') {
    return (
      <div className="space-y-5">
        {data.linesOfOperation.map((l: Any, li: number) => (
          <div key={li} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-100">{l.label}</span>
              <St s={l.status ?? 'on_schedule'} />
            </div>
            <Steps goalId={goalId} base={`plan.linesOfOperation.${li}.criticalPath`} steps={l.criticalPath} editable={editable} />
            {l.blocker && <p className="text-xs text-red-300">Blocked: {l.blocker}</p>}
            {l.nextActions.length > 0 && (
              <div className="rounded-md bg-slate-900/70 p-2.5">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Next actions</div>
                <ul className="space-y-1.5">
                  {l.nextActions.map((a: Any, ai: number) => (
                    <Toggle key={ai} goalId={goalId} path={`plan.linesOfOperation.${li}.nextActions.${ai}`} status={a.status} editable={editable}>
                      <span>{a.action}</span>
                      <span className="ml-2 text-xs text-slate-500">{a.who} · {a.when}</span>
                      <Detail>{a.detail}</Detail>
                    </Toggle>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'ordered-list') {
    return (
      <div className="space-y-3">
        <div><div className="font-medium text-slate-100">{data.schwerpunkt}</div><Detail>{data.rationale}</Detail></div>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {data.topFindings.map((f: Any, i: number) => (
            <li key={i}>{f.label}<Detail>{f.detail}</Detail>
              {f.items?.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-slate-400">{f.items.map((it: Any, j: number) => <li key={j}>{it.label}</li>)}</ul>}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (type === 'stakeholder-table') {
    const isPeople = k === 'people';
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>{(isPeople ? ['Name', 'Status', 'Doing'] : ['Name', 'Power', 'Stance', 'Via']).map((h) => <th key={h} className="pb-2 pr-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {data.map((p: Any, i: number) => (
              <tr key={i} className="align-top">
                <td className="py-2 pr-3 font-medium text-slate-100">{p.name}<Detail>{p.detail}</Detail></td>
                {isPeople ? (<><td className="py-2 pr-3"><St s={p.status} /></td><td className="py-2 pr-3">{p.doing}</td></>) : (<><td className="py-2 pr-3"><St s={p.power} /></td><td className="py-2 pr-3">{p.stanceCurrent} → {p.stanceTarget}</td><td className="py-2 pr-3">{p.via}</td></>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === 'risk-list') {
    return (
      <ul className="space-y-2 text-sm">
        {data.map((r: Any, i: number) => (
          <li key={i} className={r.accepted ? 'text-slate-500' : ''}>
            <span className="mr-2"><Pill tone={r.accepted ? 'slate' : 'amber'}>{r.accepted ? 'accepted' : 'open'}</Pill></span>{r.item}
            <span className="ml-2 text-xs text-slate-500">{r.source}</span><Detail>{r.detail}</Detail>
          </li>
        ))}
      </ul>
    );
  }

  if (type === 'decision-callout') {
    const list = [...data].reverse() as Any[];
    return (
      <div className="space-y-3">
        {list.map((d, i) => (
          <div key={i} className={i === 0 ? 'rounded-md border-l-2 border-sky-500 bg-slate-900/70 p-3' : 'pl-3 text-slate-400'}>
            <div className="text-xs text-slate-500">{formatDate(d.date)}</div>
            {d.status === 'open' ? (
              <div className="text-sm font-medium text-slate-100">Open: {d.question}</div>
            ) : (
              <>
                <div className="text-sm font-medium text-slate-100">{d.choice}</div>
                {d.because && <Detail>Because {d.because}</Detail>}
                <Detail>Reverse if {d.reverseIf}{d.reviewBy ? ` · review by ${formatDate(d.reviewBy)}` : ''}</Detail>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (k === 'criteriaStatus') {
    return <ul className="space-y-2 text-sm">{data.map((c: Any, i: number) => <li key={i}><St s={c.status} /> <span className="ml-1">{c.text}</span> <span className="text-xs text-slate-500">{c.kind}</span><Detail>{c.detail}</Detail></li>)}</ul>;
  }
  if (k === 'capacity') {
    return <div className="space-y-1 text-sm"><div>{data.availableHrsPerWeek ?? '?'} hrs/week · runway {data.runway}</div>{data.watch && <div className="text-amber-300">Watch: {data.watch}</div>}<Detail>{data.detail}</Detail><Detail>Reviewed {formatDate(data.lastReviewed)}</Detail></div>;
  }
  if (k === 'experiments') {
    return <ul className="space-y-2 text-sm">{data.map((e: Any, i: number) => <li key={i}><span className="mr-2">{e.done ? '✓' : '○'}</span>{e.assumption}<Detail>Test: {e.test} · pass if {e.passIf} · by {formatDate(e.by)}</Detail>{e.result && <Detail>Result: {e.result}</Detail>}</li>)}</ul>;
  }
  if (k === 'forecasts') {
    return <ul className="space-y-2 text-sm">{data.map((f: Any, i: number) => <li key={i}><Pill tone={f.resolved ? (f.outcome === 'yes' ? 'green' : 'slate') : 'sky'}>{f.probability}%</Pill> <span className="ml-1">{f.statement}</span><Detail>{f.resolved ? `Resolved ${f.outcome ?? ''}${f.verdict ? ` — ${f.verdict}` : ''}` : `Resolves ${formatDate(f.resolvesBy)} via ${f.resolvesVia}`}</Detail></li>)}</ul>;
  }
  // plain-card fallback (exposure and anything unmapped)
  if (Array.isArray(data)) {
    return <ul className="space-y-2 text-sm">{data.map((e: Any, i: number) => <li key={i}>{e.status && <St s={e.status} />} <span className="ml-1">{e.item ?? JSON.stringify(e)}</span>{e.mustHandleBefore && <span className="ml-2 text-xs text-slate-500">before {e.mustHandleBefore}</span>}<Detail>{e.why}</Detail></li>)}</ul>;
  }
  return <pre className="overflow-x-auto text-xs text-slate-400">{JSON.stringify(data, null, 2)}</pre>;
}
