import type { ReactNode } from 'react';
import { rendererForSection, setStatus } from '@gambit/core';
import { applyOp } from '../lib/goals';
import { useSession } from '../lib/session';
import { useLineMark } from './marks/context';
import { undoTurn } from '../lib/agent';
import type { Goal } from '../lib/types';
import { TextAction, PencilWord } from './ui';

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

// The tappable question each empty section shows in place of content
// (brand/identity.md §05 "An empty section is one pencilled question you
// can tap").
export const EMPTY_PROMPTS: Record<string, string> = {
  plan: "No plan yet. What's the first move?",
  people: 'Nobody named yet. Who has a say in this?',
  stakeholders: 'Nobody named yet. Who has a say in this?',
  systemsNotes: "Not looked at yet. Where's the leverage point here?",
  riskNotes: "Nothing stress-tested yet. What could go wrong?",
  decisions: 'Nothing decided yet. What choice is open?',
  exposure: "Not looked at yet. What are you personally exposed to?",
  capacity: "Not counted yet. What do you actually have to work with?",
  forecasts: 'No bets on the record yet. What do you expect to happen?',
  experiments: 'Nothing tested yet. What assumption needs checking?',
  criteriaStatus: 'Not scored yet. How is this actually going?',
};

/** The sr-only text equivalent for a mark, appended to a markable line. */
function MarkSr({ path }: { path: string }) {
  const mark = useLineMark(path);
  return mark.sr ? <span className="sr-only">{` (${mark.sr})`}</span> : null;
}

/** The pencilled "new, from your chat · undo" note under a changed line
 * (brand/identity.md §05, the accent used at most once per screen alongside
 * the loop). */
function ChangeNote({ goalId, path }: { goalId: string; path: string }) {
  const mark = useLineMark(path);
  const { turn } = useSession();
  if (mark.note !== 'changed') return null;
  const displayId = turn?.goalId === goalId ? turn.turnId : undefined;
  return (
    <div className="hand text-[16px] text-accent">
      new, from your chat ·{' '}
      <TextAction
        className="text-[16px] underline"
        onClick={() => { if (displayId) void undoTurn(goalId, displayId); }}
      >
        undo
      </TextAction>
    </div>
  );
}

/** A single markable line: text with its data-line hook, sr mark text, an
 * optional "→ Name" pencilled after it, and the change note beneath. */
function Line({ goalId, path, className = '', box, children }: { goalId: string; path: string; className?: string; box?: boolean; children: ReactNode }) {
  const mark = useLineMark(path);
  return (
    <div>
      <span data-line={path} className={`${mark.pencil ? 'pencil' : ''} ${className}`}>
        {box && <span className="box" data-box aria-hidden="true" />}
        {children}
        <MarkSr path={path} />
        {mark.to && <PencilWord className="ml-1">{`→ ${mark.to}`}</PencilWord>}
      </span>
      <ChangeNote goalId={goalId} path={path} />
    </div>
  );
}

function Toggle({ goalId, path, status, editable, children }: { goalId: string; path: string; status: string; editable: boolean; children: ReactNode }) {
  const next = status === 'done' ? 'pending' : 'done';
  const cls = status === 'done' ? 'text-graphite line-through' : '';
  return (
    <li className="flex items-start gap-2 text-[17px] leading-[27px]">
      <TextAction
        disabled={!editable}
        title={editable ? `Mark ${next}` : undefined}
        className={`mt-0.5 shrink-0 ${cls}`}
        onClick={() => void applyOp(goalId, (g) => setStatus(g, path, next) as never)}
      >
        <span className="box" data-box aria-hidden="true" />
      </TextAction>
      <div className={`min-w-0 flex-1 ${cls}`}>{children}</div>
    </li>
  );
}

function Detail({ children }: { children?: ReactNode }) {
  return children ? <div className="mt-0.5 text-[14px] text-graphite">{children}</div> : null;
}

function Steps({ goalId, base, steps, editable }: { goalId: string; base: string; steps: Any[]; editable: boolean }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => (
        <Toggle key={i} goalId={goalId} path={`${base}.${i}`} status={s.status} editable={editable}>
          <Line goalId={goalId} path={`${base}.${i}`}><span>{s.label}</span></Line>
          <Detail>{s.detail}</Detail>
          {s.items?.length > 0 && (
            <ul className="mt-1 space-y-1 pl-1">
              {s.items.map((it: Any, j: number) => (
                <Toggle key={j} goalId={goalId} path={`${base}.${i}.items.${j}`} status={it.status} editable={editable}>
                  <Line goalId={goalId} path={`${base}.${i}.items.${j}`} className="text-[14px]"><span>{it.label}</span></Line>
                </Toggle>
              ))}
            </ul>
          )}
        </Toggle>
      ))}
    </ol>
  );
}

/** Next actions visible in a section: `proposed` lives on a sticky note
 * instead, and `dropped` only stays visible for this session if it's the
 * one the marks layer is erasing (brand/identity.md §05's "Erased" mark). */
function visibleActions(actions: Any[], goalId: string, base: string, dropped: Map<string, Set<string>>) {
  const droppedForGoal = dropped.get(goalId);
  return actions
    .map((a, i) => ({ a, path: `${base}.${i}` }))
    .filter(({ a, path }) => {
      if (a.status === 'proposed') return false;
      if (a.status === 'dropped') return droppedForGoal?.has(path) ?? false;
      return true;
    });
}

export function SectionBody({ k, data, goalId, editable }: { k: keyof Goal; data: Any; goalId: string; editable: boolean }) {
  const type = rendererForSection(k);
  const { dropped } = useSession();

  if (k === 'plan') {
    return (
      <div className="space-y-5">
        {data.linesOfOperation.map((l: Any, li: number) => {
          const actions = visibleActions(l.nextActions, goalId, `plan.linesOfOperation.${li}.nextActions`, dropped);
          return (
            <div key={li} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{l.label}</span>
                {l.status && <PencilWord>{l.status.replace('_', ' ')}</PencilWord>}
              </div>
              <Steps goalId={goalId} base={`plan.linesOfOperation.${li}.criticalPath`} steps={l.criticalPath} editable={editable} />
              {l.blocker && <p className="text-[14px] text-accent">Blocked: {l.blocker}</p>}
              {actions.length > 0 && (
                <div>
                  <div className="mb-1 text-[14px] text-graphite">Next actions</div>
                  <ul className="space-y-1.5">
                    {actions.map(({ a, path }) => (
                      <Toggle key={path} goalId={goalId} path={path} status={a.status} editable={editable}>
                        <Line goalId={goalId} path={path}>
                          <span>{a.action}</span>
                          <span className="ml-2 text-[14px] text-graphite">{a.who} · {a.when}</span>
                        </Line>
                        <Detail>{a.detail}</Detail>
                      </Toggle>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (type === 'ordered-list') {
    return (
      <div className="space-y-3">
        <div><div className="font-medium text-ink">{data.schwerpunkt}</div><Detail>{data.rationale}</Detail></div>
        <ol className="list-decimal space-y-2 pl-5 text-[17px] leading-[27px]">
          {data.topFindings.map((f: Any, i: number) => (
            <li key={i}>{f.label}<Detail>{f.detail}</Detail>
              {f.items?.length > 0 && <ul className="mt-1 list-disc pl-4 text-[14px] text-graphite">{f.items.map((it: Any, j: number) => <li key={j}>{it.label}</li>)}</ul>}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (type === 'stakeholder-table') {
    const isPeople = k === 'people';
    return (
      <ul className="space-y-2 text-[17px] leading-[27px]">
        {data.map((p: Any, i: number) => (
          <li key={i}>
            <Line goalId={goalId} path={`${k}.${i}`}>
              <span className="font-medium text-ink">{p.name}</span>
              {isPeople ? (
                <>
                  <span className="mx-2 text-[14px] text-graphite">{p.doing}</span>
                  <PencilWord>{p.status}</PencilWord>
                </>
              ) : (
                <>
                  <span className="mx-2 text-[14px] text-graphite">{p.stanceCurrent} → {p.stanceTarget} · {p.via}</span>
                  <PencilWord>{p.power}</PencilWord>
                </>
              )}
            </Line>
            <Detail>{p.detail}</Detail>
          </li>
        ))}
      </ul>
    );
  }

  if (type === 'risk-list') {
    return (
      <ul className="space-y-2 text-[17px] leading-[27px]">
        {data.map((r: Any, i: number) => (
          <li key={i}>
            <Line goalId={goalId} path={`riskNotes.${i}`} className={r.accepted ? 'text-graphite' : ''}>
              <span>{r.item}</span>
              <PencilWord className="ml-2">{r.accepted ? 'accepted' : 'open'}</PencilWord>
            </Line>
            <Detail>{r.detail}</Detail>
          </li>
        ))}
      </ul>
    );
  }

  if (type === 'decision-callout') {
    const list = [...(data as Any[])].map((d, i) => ({ d, i })).reverse();
    return (
      <div className="space-y-3">
        {list.map(({ d, i }) => (
          <div key={i}>
            <div className="text-[14px] text-graphite">{formatDate(d.date)}</div>
            {d.status === 'open' ? (
              <Line goalId={goalId} path={`decisions.${i}`}><span className="font-medium text-ink">Open: {d.question}</span></Line>
            ) : (
              <>
                <Line goalId={goalId} path={`decisions.${i}`}><span className="font-medium text-ink">{d.choice}</span></Line>
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
    return (
      <ul className="space-y-2 text-[17px] leading-[27px]">
        {data.map((c: Any, i: number) => (
          <li key={i}>
            <Line goalId={goalId} path={`criteriaStatus.${i}`} box>
              <span>{c.text}</span>
              <PencilWord className="ml-2">{c.status.replace('_', ' ')}</PencilWord>
            </Line>
            <Detail>{c.detail}</Detail>
          </li>
        ))}
      </ul>
    );
  }
  if (k === 'capacity') {
    return (
      <div className="space-y-1 text-[17px] leading-[27px]">
        <div className="tabular-nums">{data.availableHrsPerWeek ?? '?'} hrs/week · runway {data.runway}</div>
        {data.watch && <div className="text-accent">Watch: {data.watch}</div>}
        <Detail>{data.detail}</Detail>
        <Detail>Reviewed {formatDate(data.lastReviewed)}</Detail>
      </div>
    );
  }
  if (k === 'experiments') {
    return (
      <ul className="space-y-2 text-[17px] leading-[27px]">
        {data.map((e: Any, i: number) => (
          <li key={i}>
            <Line goalId={goalId} path={`experiments.${i}`} className={e.done ? '' : 'pencil'} box>
              <span>{e.assumption}</span>
            </Line>
            <Detail>Test: {e.test} · pass if {e.passIf} · by {formatDate(e.by)}</Detail>
            {e.result && <Detail>Result: {e.result}</Detail>}
          </li>
        ))}
      </ul>
    );
  }
  if (type === 'checklist' && k === 'forecasts') {
    return (
      <ul className="space-y-2 text-[17px] leading-[27px]">
        {data.map((f: Any, i: number) => (
          <li key={i}>
            <Line goalId={goalId} path={`forecasts.${i}`}>
              <span className="tabular-nums"><PencilWord>{f.probability}%</PencilWord></span>{' '}
              <span>{f.statement}</span>
            </Line>
            <Detail>{f.resolved ? `Resolved ${f.outcome ?? ''}${f.verdict ? ` — ${f.verdict}` : ''}` : `Resolves ${formatDate(f.resolvesBy)} via ${f.resolvesVia}`}</Detail>
          </li>
        ))}
      </ul>
    );
  }
  // plain-card fallback (exposure and anything unmapped)
  if (Array.isArray(data)) {
    return (
      <ul className="space-y-2 text-[17px] leading-[27px]">
        {data.map((e: Any, i: number) => (
          <li key={i}>
            <Line goalId={goalId} path={`${k}.${i}`}>
              <span>{e.item ?? JSON.stringify(e)}</span>
              {e.status && <PencilWord className="ml-2">{e.status}</PencilWord>}
              {e.mustHandleBefore && <span className="ml-2 text-[14px] text-graphite">before {e.mustHandleBefore}</span>}
            </Line>
            <Detail>{e.why}</Detail>
          </li>
        ))}
      </ul>
    );
  }
  return <pre className="overflow-x-auto text-[14px] text-graphite">{JSON.stringify(data, null, 2)}</pre>;
}
