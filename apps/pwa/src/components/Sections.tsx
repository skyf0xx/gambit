import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { rendererForSection, setStatus } from '@gambit/core';
import { applyOp } from '../lib/goals';
import { useSession } from '../lib/session';
import { useLineMark, useMarksContext } from './marks/context';
import { FreshTag } from './paper/FreshTag';
import { useGoto } from './gotoContext';
import { undoTurn } from '../lib/agent';
import type { Goal } from '../lib/types';
import { TextAction, PencilWord } from './ui';
import { pencilDate, byDate, withProseDates, daysUntil } from '../lib/dates';
import { composeInChat } from '../lib/compose';

/** Pencilled long-date form ("Friday 3 Oct"), never ISO — used for the log
 * and anywhere a bare date (not a "by …" due date) is shown. */
export const formatDate = (s?: string | null) => pencilDate(s);

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
  stakeholders: 'Nobody else named yet. Whose decision does this hang on?',
  systemsNotes: "Not looked at yet. Where's the leverage point here?",
  riskNotes: "Nothing stress-tested yet. What could go wrong?",
  decisions: 'Nothing decided yet. What choice is open?',
  exposure: "Not looked at yet. What are you personally exposed to?",
  capacity: "Not counted yet. What do you actually have to work with?",
  forecasts: 'No predictions yet. What do you expect to happen?',
  experiments: 'Nothing tested yet. What assumption needs checking?',
  criteriaStatus: 'Not scored yet. How is this actually going?',
};

// What tapping an empty section's question puts in the chat composer: the
// start of the message that fills the section, for the user to finish.
export const EMPTY_STARTERS: Record<string, string> = {
  plan: "Let's plan the first moves.",
  people: 'The people involved are ',
  stakeholders: 'Help me map who else has a say in this.',
  systemsNotes: 'Where is the leverage point in this?',
  riskNotes: 'Red-team this plan: what could go wrong?',
  decisions: "There's a choice I need to make: ",
  exposure: 'What am I personally exposed to here?',
  capacity: 'Here is what I actually have to work with: ',
  forecasts: 'A prediction I want to make: ',
  experiments: "An assumption I'm not sure about: ",
  criteriaStatus: 'How is this actually going against done?',
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
 * optional "→ Name" pencilled after it, and the change note beneath. `box`
 * gives a line that isn't inside a Toggle its own read-only checkbox,
 * ticked when `checked`. */
function Line({ goalId, path, className = '', box, checked, children }: { goalId: string; path: string; className?: string; box?: boolean; checked?: boolean; children: ReactNode }) {
  const mark = useLineMark(path);
  return (
    <div>
      <span data-line={path} className={`${mark.pencil ? 'pencil' : ''} ${className}`}>
        {box && <span className="box mr-2 align-[-3px]" data-box={path} data-checked={checked ? '' : undefined} aria-hidden="true" />}
        {children}
        <FreshTag path={path} />
        <MarkSr path={path} />
        {mark.kind === 'arrow-text' && mark.toName && <PencilWord className="ml-1">{`→ ${mark.toName}`}</PencilWord>}
      </span>
      <ChangeNote goalId={goalId} path={path} />
    </div>
  );
}

/** A tickable row: the 44x44 tick-toggle tap area, wrapping the small box
 * the marks layer draws — always, ticked or not — plus the row's own text,
 * which ticks on click too. Done items stay in normal ink — nothing here strikes
 * through; the pencil tick is the only "done" signal (brand/identity.md §05). */
function Toggle({ goalId, path, status, editable, children }: { goalId: string; path: string; status: string; editable: boolean; children: ReactNode }) {
  const next = status === 'done' ? 'pending' : 'done';
  const toggle = () => void applyOp(goalId, (g) => setStatus(g, path, next) as never);
  // The whole row ticks, not only the box. The box button stays the
  // keyboard and screen-reader control; this is the pointer shortcut, so it
  // stands aside for anything with its own click (the box itself, "undo",
  // a nested sub-item's row) and for a drag that selected text.
  const onRowClick = (e: MouseEvent<HTMLLIElement>) => {
    if ((e.target as Element).closest('button, a, li') !== e.currentTarget) return;
    if (window.getSelection()?.toString()) return;
    toggle();
  };
  return (
    <li className={`flex items-start text-[17px] leading-[27px] ${editable ? 'cursor-pointer' : ''}`} onClick={editable ? onRowClick : undefined}>
      <TextAction
        disabled={!editable}
        title={editable ? `Mark ${next}` : undefined}
        className="w-11 shrink-0 justify-center"
        onClick={toggle}
      >
        {/* The 44px tap area centres the box 8.5px below the centre of the
         * 27px first text line beside it; lift it back onto that line. */}
        <span className="box -top-[8.5px]" data-box={path} data-checked={status === 'done' ? '' : undefined} aria-hidden="true" />
      </TextAction>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function Detail({ children }: { children?: ReactNode }) {
  return children ? <div className="mt-0.5 text-[14px] leading-5 text-graphite">{children}</div> : null;
}

/** A success criterion's `kind`, in plain words: the two groups "What done
 * looks like" is split into. `control` is something the user can cause
 * directly; `influence` hangs on someone else's decision. */
const CRITERION_GROUPS = [
  { kind: 'control', label: 'Up to you' },
  { kind: 'influence', label: 'Up to someone else' },
];

/** One success criterion: a plain bullet — it isn't the user's to tick, so
 * it gets no box — which becomes an ink tick once `eval` scores it met.
 * The text and its note hang beside the bullet rather than wrapping under
 * it. */
function Criterion({ goalId, path, c }: { goalId: string; path: string; c: Any }) {
  const mark = useLineMark(path);
  return (
    <li className="flex items-start gap-2.5">
      {mark.kind === 'tick' ? (
        <span className="box mt-[4.5px] shrink-0" data-box={path} data-bare="" data-checked="" aria-hidden="true" />
      ) : (
        <span className="flex h-[27px] w-[18px] shrink-0 items-center justify-center" aria-hidden="true">
          <span className="h-[5px] w-[5px] rounded-full bg-ink" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Line goalId={goalId} path={path}><span>{c.text}</span></Line>
        <Detail>{c.detail}</Detail>
      </div>
    </li>
  );
}

/** The leading marker on a decision, experiment or forecast. None of them
 * are the user's to tick — they settle through the chat — so they get a
 * bullet, never a box: an open pencil ring while still open, filled in
 * with ink once settled. */
function Marker({ open }: { open: boolean }) {
  return (
    <span className="flex h-[27px] w-[18px] shrink-0 items-center justify-center" aria-hidden="true">
      {open ? <span className="h-[9px] w-[9px] rounded-full border-[1.5px] border-graphite" /> : <span className="h-[7px] w-[7px] rounded-full bg-ink" />}
    </span>
  );
}

/** A labelled fact under an item's headline ("Test", "Passes if"), laid out
 * as a two-column list so the labels line up and the values start with
 * their own words rather than being run into a sentence. */
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, v]) => v);
  if (shown.length === 0) return null;
  return (
    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {shown.map(([label, v]) => (
        <div key={label} className="contents">
          <dt className="text-[14px] leading-[22px] text-graphite">{label}</dt>
          <dd className="text-[15px] leading-[22px] text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** An item's closing line: its date pencilled, and — when the next step is
 * the user's — the one action that hands it to the chat. */
function ItemFooter({ when, late, action }: { when?: string; late?: boolean; action?: { label: string; starter: string } }) {
  if (!when && !action) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4">
      {when && <PencilWord className={`text-[19px] ${late ? 'text-ink' : 'text-graphite'}`}>{when}</PencilWord>}
      {action && (
        <TextAction className="text-[15px] underline" onClick={() => composeInChat(action.starter)}>
          {action.label}
        </TextAction>
      )}
    </div>
  );
}

const isDue = (d?: string) => { const n = d ? daysUntil(d) : null; return n !== null && n <= 0; };
const isLate = (d?: string) => { const n = d ? daysUntil(d) : null; return n !== null && n < 0; };

/** A Bets section split in two under pencilled status labels — the
 * open items ("not tested yet"), soonest due first, then the settled ones,
 * newest first. The label is the item's status, so the items themselves
 * carry no status mark. A group with nothing in it isn't shown. Each item
 * keeps its stored index for its path. */
function StatusGroups<T>({ list, isOpen, due, labels, render }: {
  list: T[];
  isOpen: (x: T) => boolean;
  due: (x: T) => string | undefined;
  labels: [open: string, settled: string];
  render: (x: T, i: number) => ReactNode;
}) {
  const rows = list.map((x, i) => ({ x, i }));
  const key = (r: { x: T }) => due(r.x) ?? '9999';
  const groups: [string, typeof rows][] = [
    [labels[0], rows.filter((r) => isOpen(r.x)).sort((a, b) => key(a).localeCompare(key(b)))],
    [labels[1], rows.filter((r) => !isOpen(r.x)).reverse()],
  ];
  return (
    <div className="space-y-6">
      {groups.map(([label, rs]) => rs.length > 0 && (
        <div key={label} className="space-y-2">
          <h3><PencilWord className="text-[21px] text-graphite">{label}</PencilWord></h3>
          <ul className="space-y-5 text-[17px] leading-[27px]">{rs.map(({ x, i }) => render(x, i))}</ul>
        </div>
      ))}
    </div>
  );
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

const PLAN_LINE_PATH = /^plan\.linesOfOperation\.(\d+)(?:\.|$)/;

/** Which line of operation a dotted LinePath sits in, or null when it isn't
 * a plan path. */
export function planLineIndex(path: string | null | undefined): number | null {
  const m = path ? PLAN_LINE_PATH.exec(path) : null;
  return m ? Number(m[1]) : null;
}

/** A line of operation's steps and next actions still in play (pending or
 * done — not proposed, not dropped), and how many of them are done. */
export function lineProgress(l: Any): { done: number; total: number } {
  const live = [...l.criticalPath, ...l.nextActions].filter((x: Any) => x.status === 'pending' || x.status === 'done');
  return { done: live.filter((x: Any) => x.status === 'done').length, total: live.length };
}

/** Which line's sheet sits on top when nothing has picked one: the line
 * holding the focus, else the first with anything still pending, else the
 * first. */
export function defaultOpenLine(lines: Any[], focusLine: number | null): number {
  if (focusLine != null && focusLine < lines.length) return focusLine;
  const pending = lines.findIndex((l) => { const p = lineProgress(l); return p.done < p.total; });
  return pending >= 0 ? pending : 0;
}

/** A line's pencilled one-line summary: its status and how far along it is. */
function lineSummary(line: Any): string {
  const { done, total } = lineProgress(line);
  return [line.status?.replace('_', ' '), total > 0 && `${done} of ${total} done`].filter(Boolean).join(' · ');
}

/** The plan as a pile of loose sheets, one per line of operation. The open
 * line is the sheet in front: its name heads the sheet and its steps sit on
 * the same surface. Every other line is tucked behind it, showing only a
 * one-line edge (name, status, how far along) above the sheet in plan
 * order, so the whole plan can still be read in one place; tapping an edge
 * pulls that line's sheet to the front — so the page stays about one line
 * long however many lines the plan has. */
function PlanStack({ lines, goalId, editable }: { lines: Any[]; goalId: string; editable: boolean }) {
  const { dropped, turn } = useSession();
  const marks = useMarksContext();
  const goto = useGoto();
  const gotoLine = planLineIndex(goto?.path);
  const [picked, setPicked] = useState<number | null>(gotoLine);
  // The edge that was tapped leaves the pile when its sheet comes forward,
  // so keyboard focus follows it to the sheet's heading.
  const headRef = useRef<HTMLDivElement>(null);
  const followFocus = useRef(false);
  useEffect(() => {
    if (!followFocus.current) return;
    followFocus.current = false;
    headRef.current?.focus({ preventScroll: true });
  }, [picked]);

  // A goto into a tucked line brings that line's sheet to the front —
  // adjusted during render, not in an effect, so the sheet is already in
  // the DOM when Tabs.tsx looks for the target line to scroll to.
  const [seenGoto, setSeenGoto] = useState(goto?.seq ?? 0);
  if (goto && goto.seq !== seenGoto) {
    setSeenGoto(goto.seq);
    if (gotoLine != null) setPicked(gotoLine);
  }

  let focusLine: number | null = null;
  for (const kind of ['highlight', 'star']) {
    if (focusLine != null) break;
    marks?.derived.byPath.forEach((mark, path) => {
      if (focusLine == null && mark.kind === kind) focusLine = planLineIndex(path);
    });
  }
  const open = picked != null && picked < lines.length ? picked : defaultOpenLine(lines, focusLine);

  const changedLine = turn?.goalId === goalId ? planLineIndex(turn.lines[0]?.path) : null;
  const l = lines[open];
  if (!l) return null;
  const actions = visibleActions(l.nextActions, goalId, `plan.linesOfOperation.${open}.nextActions`, dropped);
  const body = (
    <>
      <Steps goalId={goalId} base={`plan.linesOfOperation.${open}.criticalPath`} steps={l.criticalPath} editable={editable} />
      {l.blocker && <p className="text-[14px] text-graphite">Blocked: {l.blocker}</p>}
      {actions.length > 0 && (
        <ol className="space-y-1.5">
          {actions.map(({ a, path }) => (
            <Toggle key={path} goalId={goalId} path={path} status={a.status} editable={editable}>
              <Line goalId={goalId} path={path}>
                <span>{a.action}</span>
                <span className="ml-2 text-[14px] text-graphite">
                  {a.who}
                  {a.when ? ` · ${byDate(a.when)}` : ''}
                </span>
              </Line>
              <Detail>{a.detail}</Detail>
            </Toggle>
          ))}
        </ol>
      )}
    </>
  );

  if (lines.length < 2) {
    return (
      <div key={open} className="anim-rise space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-ink">{l.label}</span>
          {l.status && <PencilWord>{l.status.replace('_', ' ')}</PencilWord>}
        </div>
        {body}
      </div>
    );
  }

  const tucked = lines.map((line, li) => ({ line, li })).filter(({ li }) => li !== open);
  const openSummary = lineSummary(l);

  return (
    // The pile is a little wider than the text column, so the front sheet's
    // edges clear its own text and the column itself stays where it was.
    <div className="-mx-2 mb-2 md:-mx-4">
      <ul aria-label="Other lines of the plan">
        {tucked.map(({ line, li }, i) => {
          const summary = lineSummary(line);
          const changed = changedLine === li;
          // How many sheets back this one sits: 1 is right behind the front
          // sheet. Each step back is a little narrower, so the pile recedes.
          const depth = Math.min(tucked.length - i, 4);
          return (
            // Each edge sits a little under the one below it and a hair off
            // square, so the set reads as loose sheets, not a list.
            <li key={li} className="anim-rise relative" style={{ marginTop: i ? -6 : 0, marginInline: depth * 6 }}>
              <button
                type="button"
                data-plan-sheet={li}
                onClick={() => { followFocus.current = true; setPicked(li); }}
                className={`slip anim-press flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[2px] px-4 pt-1.5 pb-2.5 text-left ${
                  li % 2 ? 'motion-safe:transform-[rotate(0.35deg)_translateX(3px)]' : 'motion-safe:transform-[rotate(-0.3deg)_translateX(-2px)]'
                }`}
                style={{ filter: 'brightness(.975) drop-shadow(0 1px 1px var(--lift)) drop-shadow(0 3px 6px var(--lift-far))' }}
              >
                <span className="min-w-0 truncate font-medium text-ink">{line.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {summary && <PencilWord className="text-[19px]">{summary}</PencilWord>}
                  {changed && <span aria-hidden="true" className="pencil h-1.5 w-1.5 rounded-[50%] bg-graphite" />}
                  {changed && <span className="sr-only"> (changed)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {/* The front sheet: the page's own colour, squared up, lying over the
       * edges behind it. Only its heading is opaque — the steps sit on the
       * page itself inside the sheet's shadow, because the marks layer
       * draws its checkboxes and pencil marks beneath the page's content
       * and a solid surface here would cover them. */}
      <section
        key={open}
        className="anim-card-in relative -mt-2 rounded-[2px] pb-3"
        style={{ boxShadow: '0 -1px 3px var(--lift-far), 0 2px 2px var(--lift), 0 10px 18px var(--lift-far)' }}
      >
        <div
          ref={headRef}
          tabIndex={-1}
          data-plan-sheet={open}
          aria-current="true"
          className="flex min-h-[44px] items-center justify-between gap-3 rounded-t-[2px] px-2 py-2 outline-none md:px-4"
          style={{ background: 'var(--grain), var(--bg)' }}
        >
          <span className="min-w-0 font-semibold text-ink">{l.label}</span>
          {openSummary && <PencilWord className="shrink-0 text-[19px]">{openSummary}</PencilWord>}
        </div>
        <div className="space-y-2 px-2 md:px-4">{body}</div>
      </section>
    </div>
  );
}

export function SectionBody({ k, data: stored, goalId, editable }: { k: keyof Goal; data: Any; goalId: string; editable: boolean }) {
  // The record keeps dates as YYYY-MM-DD, and the advisor sometimes writes
  // one into a sentence too; the page never shows that form.
  const data = useMemo(() => withProseDates(stored), [stored]);
  const type = rendererForSection(k);

  if (k === 'plan') {
    return <PlanStack key={goalId} lines={data.linesOfOperation} goalId={goalId} editable={editable} />;
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
    // Each person reads in three steps down: the name, with their status
    // (or how much say they have) pencilled at the line's end; what they
    // do, or where they stand and where they need to be; then the notes.
    return (
      <ul className="space-y-3 text-[17px] leading-[27px]">
        {data.map((p: Any, i: number) => (
          <li key={i}>
            <div className="flex items-baseline justify-between gap-3">
              <Line goalId={goalId} path={`${k}.${i}`}>
                <span className="font-medium text-ink">{p.name}</span>
              </Line>
              <PencilWord className="shrink-0">{isPeople ? p.status : `${p.power === 'med' ? 'medium' : p.power} power`}</PencilWord>
            </div>
            {isPeople ? (
              <div>{p.doing}</div>
            ) : (
              <>
                <div>
                  {p.stanceCurrent} <span aria-hidden="true">→</span><span className="sr-only">to</span> {p.stanceTarget}
                </div>
                <Detail>via {p.via}</Detail>
              </>
            )}
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
    // Open questions lead (they're waiting on the user), then what's been
    // decided. The date a choice was made is the least useful thing about
    // it, so it trails in pencil rather than heading it.
    return (
      <StatusGroups
        list={data as Any[]}
        isOpen={(d) => d.status === 'open'}
        due={(d) => d.reviewBy}
        labels={['still to decide', 'decided']}
        render={(d, i) => {
          const open = d.status === 'open';
          const reviewDue = !open && isDue(d.reviewBy);
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Marker open={open} />
              <div className="min-w-0 flex-1">
                <Line goalId={goalId} path={`decisions.${i}`}>
                  <span className="font-medium text-ink">{open ? d.question : d.choice}</span>
                </Line>
                {!open && <Facts rows={[['Why', d.because], ['Reverse if', d.reverseIf]]} />}
                <ItemFooter
                  when={
                    open ? (d.reviewBy ? `settle ${byDate(d.reviewBy)}` : undefined)
                    : [`decided ${formatDate(d.date)}`, d.reviewBy && `review ${byDate(d.reviewBy)}`].filter(Boolean).join(' · ')
                  }
                  late={isLate(d.reviewBy)}
                  action={
                    open ? { label: 'Work it through', starter: `Help me decide: ${d.question}` }
                    : reviewDue ? { label: 'Revisit it', starter: `Time to revisit this decision: ${d.choice}. ` }
                    : undefined
                  }
                />
              </div>
            </li>
          );
        }}
      />
    );
  }

  if (k === 'successCriteria') {
    const criteria = data.map((c: Any, i: number) => ({ c, path: `successCriteria.${i}` }));
    return (
      <div className="space-y-4 text-[17px] leading-[27px]">
        {CRITERION_GROUPS.map(({ kind, label }) => {
          const group = criteria.filter(({ c }: Any) => c.kind === kind);
          if (group.length === 0) return null;
          return (
            <div key={kind} className="space-y-1.5">
              <h3 className="text-[14px] leading-5 text-graphite">{label}</h3>
              <ul className="space-y-3">
                {group.map(({ c, path }: Any) => <Criterion key={path} goalId={goalId} path={path} c={c} />)}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }
  if (k === 'criteriaStatus') {
    return (
      <ul className="space-y-2 text-[17px] leading-[27px]">
        {data.map((c: Any, i: number) => (
          <li key={i}>
            <Line goalId={goalId} path={`criteriaStatus.${i}`} box checked={c.status === 'met'}>
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
    // One stacked list, each line under its own small label. The hours are
    // the only figure, so they alone are set large; runway and the thing to
    // watch are sentences and read at body size. The note trails in small
    // type. The review date is pencilled beside the section's heading
    // (SectionRenderer.tsx), not here.
    return (
      <div className="space-y-5 text-[17px] leading-[27px]">
        <dl className="space-y-4">
          <div>
            <dt className="text-[14px] leading-5 text-graphite">Hours a week</dt>
            <dd className="text-[30px] font-medium leading-[38px] tabular-nums text-ink">
              {data.availableHrsPerWeek ?? <PencilWord>not counted yet</PencilWord>}
            </dd>
          </div>
          <div>
            <dt className="text-[14px] leading-5 text-graphite">Runway</dt>
            <dd>{data.runway}</dd>
          </div>
          {data.watch && (
            <div>
              <dt className="text-[14px] leading-5 text-graphite">Watch for</dt>
              <dd>{data.watch}</dd>
            </div>
          )}
        </dl>
        {data.detail && <p className="text-[14px] leading-[22px] text-graphite">{data.detail}</p>}
      </div>
    );
  }
  if (k === 'experiments') {
    // An untested assumption is written in pencil, under the "not tested
    // yet" label; the test and its pass line sit under it as labelled facts,
    // and the footer says when it's due and hands the result to the chat.
    return (
      <StatusGroups
        list={data as Any[]}
        isOpen={(e) => !e.done}
        due={(e) => e.by}
        labels={['not tested yet', 'tested']}
        render={(e, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Marker open={!e.done} />
            <div className="min-w-0 flex-1">
              <Line goalId={goalId} path={`experiments.${i}`} className={`font-medium ${e.done ? '' : 'pencil'}`}>
                <span>{e.assumption}</span>
              </Line>
              {e.done ? (
                <Facts rows={[['Test', e.test], ['Result', e.result], ['So now', e.changedAsResult]]} />
              ) : (
                <Facts rows={[['Test', e.test], ['Passes if', e.passIf]]} />
              )}
              {!e.done && (
                <ItemFooter
                  when={isLate(e.by) ? `was due ${pencilDate(e.by)}` : byDate(e.by)}
                  late={isLate(e.by)}
                  action={{ label: 'Tell me how it went', starter: `How the test went for "${e.assumption}": ` }}
                />
              )}
            </div>
          </li>
        )}
      />
    );
  }
  if (type === 'checklist' && k === 'forecasts') {
    return (
      <StatusGroups
        list={data as Any[]}
        isOpen={(f) => !f.resolved}
        due={(f) => f.resolvesBy}
        labels={['waiting to find out', 'found out']}
        render={(f, i) => {
          const due = !f.resolved && isDue(f.resolvesBy);
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Marker open={!f.resolved} />
              <div className="min-w-0 flex-1">
                <Line goalId={goalId} path={`forecasts.${i}`} className={`font-medium ${f.resolved ? '' : 'pencil'}`}>
                  <span>{f.statement}</span>
                </Line>
                <Facts
                  rows={
                    f.resolved
                      ? [['You said', `${f.probability}% likely`], ['Outcome', f.outcome === 'yes' ? 'It happened' : f.outcome === 'no' ? 'It didn’t happen' : undefined], ['Your call was', f.verdict]]
                      : [['How likely', `${f.probability}%`], ['We’ll know from', f.resolvesVia]]
                  }
                />
                {!f.resolved && (
                  <ItemFooter
                    when={isLate(f.resolvesBy) ? `was due ${pencilDate(f.resolvesBy)}` : `know ${byDate(f.resolvesBy)}`}
                    late={isLate(f.resolvesBy)}
                    action={due ? { label: 'Did it happen?', starter: `Checking this prediction: "${f.statement}". It ` } : undefined}
                  />
                )}
              </div>
            </li>
          );
        }}
      />
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
