import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { GROUP_LABELS, GROUP_ORDER, groupForSection, writeSection } from '@gambit/core';
import { db } from '../lib/db';
import { applyOp, readRecord, snapshot } from '../lib/goals';
import type { Goal } from '../lib/types';
import { Btn, Pill, inputCls } from './ui';
import { SectionBody, formatDate, hintFor, titleForKey } from './Sections';

const SECTION_KEYS = ['plan', 'criteriaStatus', 'people', 'stakeholders', 'systemsNotes', 'riskNotes', 'decisions', 'exposure', 'capacity', 'forecasts', 'experiments'] as const;
const isEmpty = (v: unknown) => v == null || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.keys(v as object).length === 0);
const weeksUntil = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], 12);
  const n = new Date();
  return Math.round((t - Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 12)) / 6048e5);
};
const segColor = (s: string) => ({ met: 'bg-emerald-500', on_track: 'bg-emerald-500', at_risk: 'bg-amber-500', stalled: 'bg-orange-600', regressing: 'bg-red-500' }[s] ?? 'bg-slate-700');

function EditJson({ goalId, k, value, onDone }: { goalId: string; k: string; value: unknown; onDone: () => void }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [errs, setErrs] = useState<string[]>([]);
  async function save() {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch (e) { return setErrs([`Invalid JSON: ${(e as Error).message}`]); }
    await snapshot(goalId, 'edit');
    const r = await applyOp(goalId, (g) => writeSection(g, k, parsed) as never);
    if (r.ok) onDone(); else setErrs(r.errors.map((e) => `${e.path}: ${e.message}`));
  }
  return (
    <div className="space-y-2">
      <textarea className={`${inputCls} h-64 font-mono text-xs`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      {errs.map((e, i) => <p key={i} className="text-xs text-red-300">{e}</p>)}
      <div className="flex gap-2"><Btn kind="primary" onClick={() => void save()}>Save</Btn><Btn onClick={onDone}>Cancel</Btn></div>
    </div>
  );
}

function Card({ goalId, k, data, open }: { goalId: string; k: (typeof SECTION_KEYS)[number]; data: unknown; open: boolean }) {
  const [editing, setEditing] = useState(false);
  const hint = hintFor(k, data);
  return (
    <details open={open} className="group rounded-lg border border-slate-800 bg-slate-900/40">
      <summary className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="font-medium">{titleForKey(k)}</span>
        <span className="truncate text-xs text-slate-500">{hint}</span>
      </summary>
      <div className="border-t border-slate-800 px-4 py-3">
        {editing ? <EditJson goalId={goalId} k={k} value={data} onDone={() => setEditing(false)} /> : <SectionBody k={k} data={data} goalId={goalId} editable />}
        {!editing && <button className="mt-3 hidden text-xs text-slate-500 hover:text-slate-300 md:block" onClick={() => setEditing(true)}>Edit</button>}
      </div>
    </details>
  );
}

function Bridge({ g, goalId }: { g: Goal; goalId: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(g.goal);
  const weeks = g.deadline ? weeksUntil(g.deadline) : null;
  const status = new Map(g.criteriaStatus.map((c) => [c.text, c.status]));
  const focus = [...g.log].reverse().find((e) => e.focus)?.focus;
  const next = g.plan?.linesOfOperation.flatMap((l) => l.nextActions).find((a) => a.status === 'pending');
  const met = g.criteriaStatus.filter((c) => c.status === 'met' || c.status === 'on_track').length;
  const stub = g.successCriteria.length === 1 && g.successCriteria[0].text === 'define success criteria';
  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <input autoFocus className={inputCls} value={val} maxLength={200} onChange={(e) => setVal(e.target.value)}
            onBlur={() => { setEditing(false); if (val.trim() && val !== g.goal) void applyOp(goalId, (x) => writeSection(x, 'goal', val.trim()) as never); }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        ) : (
          <h2 className="text-lg font-semibold leading-snug md:cursor-text" onDoubleClick={() => { setVal(g.goal); setEditing(true); }}>{g.goal}</h2>
        )}
        {g.deadline && <div className="shrink-0 text-right text-xs text-slate-400"><div>{formatDate(g.deadline)}</div>{weeks !== null && <div className={weeks < 0 ? 'text-red-300' : ''}>{weeks < 0 ? `${-weeks} wk past` : `${weeks} wk left`}</div>}</div>}
      </div>
      {stub ? <p className="text-sm text-slate-500">Not yet defined. Describe the goal in the chat to fill this in.</p> : (
        <>
          <div>
            <div className="flex gap-1">{g.successCriteria.map((c, i) => <div key={i} title={c.text} className={`h-2 flex-1 rounded-full ${segColor(status.get(c.text) ?? '')}`} />)}</div>
            <div className="mt-1 text-xs text-slate-500">{met}/{g.successCriteria.length} criteria on track</div>
          </div>
          <ul className="space-y-1 text-sm">{g.successCriteria.map((c, i) => <li key={i} className="flex gap-2"><Pill tone={c.kind === 'control' ? 'sky' : 'slate'}>{c.kind}</Pill><span>{c.text}</span></li>)}</ul>
        </>
      )}
      {focus && <div className="text-sm"><span className="text-xs uppercase tracking-wide text-slate-500">Focus </span>{focus}</div>}
      {g.posture && <div className="text-sm"><span className="text-xs uppercase tracking-wide text-slate-500">Posture </span>L{g.posture.current.level} {g.posture.current.label}</div>}
      {next && <div className="text-sm"><span className="text-xs uppercase tracking-wide text-slate-500">Next </span>{next.action} <span className="text-xs text-slate-500">{next.who} · {next.when}</span></div>}
    </div>
  );
}

export function useGoalView(goalId: string) {
  return useLiveQuery(async () => {
    const rec = await db.goals.get(goalId);
    return rec ? await readRecord(rec) : null;
  }, [goalId]);
}

export function Dashboard({ goalId }: { goalId: string }) {
  const read = useGoalView(goalId);
  const [mobileGroup, setMobileGroup] = useState('plan');
  if (!read) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (read.status === 'needs_app_update') return <div className="m-4 rounded-md bg-amber-500/10 p-4 text-sm text-amber-200">This goal was saved by a newer version of Gambit (schema v{read.version}). Update the app to open it. It has not been changed.</div>;
  if (read.status === 'invalid') return <div className="m-4 rounded-md bg-red-500/10 p-4 text-sm text-red-200">This goal doesn't match the current schema: {read.error}. Restore it from a backup or fix the JSON.</div>;
  const g = read.data;
  const sections = SECTION_KEYS.filter((k) => !isEmpty(g[k])).map((k) => ({ k, data: g[k] }));
  const groups = GROUP_ORDER.map((key) => ({ key, label: (GROUP_LABELS as Record<string, string>)[key], items: sections.filter((s) => groupForSection(s.k) === key) })).filter((x) => x.items.length);
  const shown = groups.some((x) => x.key === mobileGroup) ? mobileGroup : groups[0]?.key;
  return (
    <div className="space-y-4 p-4">
      <Bridge g={g} goalId={goalId} />
      {groups.length > 0 && (
        <div className="flex gap-1 overflow-x-auto md:hidden">
          {groups.map((x) => <button key={x.key} onClick={() => setMobileGroup(x.key)} className={`shrink-0 rounded-full px-3 py-1 text-xs ${x.key === shown ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{x.label}</button>)}
        </div>
      )}
      {groups.map((x) => (
        <section key={x.key} className={x.key === shown ? 'space-y-2' : 'hidden space-y-2 md:block'}>
          <h3 className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:block">{x.label}</h3>
          {x.items.map((s) => <Card key={s.k} goalId={goalId} k={s.k} data={s.data} open={x.key === 'plan'} />)}
        </section>
      ))}
      {groups.length === 0 && <p className="text-sm text-slate-500">Sections appear here as the conversation builds them.</p>}
      {g.log.length > 0 && (
        <details className="rounded-lg border border-slate-800 bg-slate-900/40">
          <summary className="px-4 py-3 text-sm font-medium">Log <span className="text-xs text-slate-500">{g.log.length} entries</span></summary>
          <ul className="space-y-2 border-t border-slate-800 px-4 py-3 text-sm">
            {[...g.log].reverse().slice(0, 30).map((e, i) => <li key={i}><span className="text-xs text-slate-500">{formatDate(e.date)}{e.source ? ` · ${e.source}` : ''}</span><ul className="list-disc pl-5 text-slate-300">{e.notes.map((n, j) => <li key={j}>{n}</li>)}</ul></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
