import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { rendererForSection, isEditableLine, taskState, milestoneReached, afterThen, NEXT_ACTIONS_MAX } from '@gambit/core';
import { setLineStatus, addMove, markTaskReplied, settleFork } from '../lib/edits';
import { useSession } from '../lib/session';
import { useLineMark, useMarksContext } from './marks/context';
import { FreshTag } from './paper/FreshTag';
import { EditableText, InlineInput } from './paper/EditableText';
import { useGoto } from './gotoContext';
import { undoTurn } from '../lib/agent';
import type { Goal } from '../lib/types';
import { nextMove, isSelf } from '../lib/slips';
import { TextAction, PencilWord } from './ui';
import { PencilUnderline } from './paper/PencilUnderline';
import { PencilRule } from './paper/PencilRule';
import { pencilDate, byDate, withProseDates, daysUntil, today } from '../lib/dates';
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
  plan: "What's the first move?",
  people: "Who's involved?",
  stakeholders: 'Who else has a say?',
  systemsNotes: "Where's the leverage?",
  riskNotes: 'What could go wrong?',
  decisions: 'Any choice to make?',
  exposure: 'What do you risk personally?',
  capacity: 'How much time and money?',
  forecasts: 'What do you expect?',
  experiments: 'What needs testing?',
  criteriaStatus: "How's it going?",
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
 * optional "→ Name" pencilled after it, and the change note beneath. */
function Line({ goalId, path, alias, className = '', edit, children }: { goalId: string; path: string; alias?: string; className?: string; edit?: { value: string; quiet?: boolean }; children: ReactNode }) {
  const mark = useLineMark(path);
  return (
    <div>
      <span data-line={path} data-alias={alias} className={`${mark.pencil ? 'pencil' : ''} ${className}`}>
        {edit ? <EditableText goalId={goalId} path={path} value={edit.value} quiet={edit.quiet}>{children}</EditableText> : children}
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
 * which ticks on click too. Nothing here strikes through; the tick is the
 * "done" signal (brand/identity.md §05). A done move in the plan also goes
 * grey beside its tick, so the moves still to make stand out above it. */
function Toggle({ goalId, path, status, editable, onTick, title, children }: { goalId: string; path: string; status: string; editable: boolean; onTick?: (path: string) => void; title?: string; children: ReactNode }) {
  const next = status === 'done' ? 'pending' : 'done';
  const toggle = () => { if (next === 'done') onTick?.(path); void setLineStatus(goalId, path, next); };
  // The whole row ticks, not only the box. The box button stays the
  // keyboard and screen-reader control; this is the pointer shortcut, so it
  // stands aside for anything with its own click (the box itself, "undo",
  // a nested sub-item's row) and for a drag that selected text.
  const onRowClick = (e: MouseEvent<HTMLLIElement>) => {
    if ((e.target as Element).closest('button, a, li, textarea, input, [data-editing]') !== e.currentTarget) return;
    if (window.getSelection()?.toString()) return;
    toggle();
  };
  return (
    <li title={title} className={`flex items-start text-[17px] leading-[27px] ${editable ? 'cursor-pointer' : ''}`} onClick={editable ? onRowClick : undefined}>
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

/** One success criterion: an open ring — it isn't the user's to tick — which
 * becomes an ink tick once `eval` scores it met. The text and its note hang
 * beside the marker rather than wrapping under it. */
function Criterion({ goalId, path, c, editable }: { goalId: string; path: string; c: Any; editable: boolean }) {
  const mark = useLineMark(path);
  // `progress` is the criterion's `eval` score, joined on by GoalTab.tsx.
  const slipping = alarm(c.progress);
  return (
    <li className="flex items-start gap-2.5">
      <Marker path={path} open={c.progress !== 'met' && mark.kind !== 'tick'} />
      <div className="min-w-0 flex-1">
        <Line goalId={goalId} path={path} edit={editable && isEditableLine(path) ? { value: c.text } : undefined}>
          <span>{c.text}</span>
          {slipping && <PencilWord className="ml-2">{slipping}</PencilWord>}
        </Line>
        <Detail>{c.detail}</Detail>
        {slipping && <Detail>{c.progressDetail}</Detail>}
      </div>
    </li>
  );
}

/** The leading marker on anything that settles on its own rather than by
 * the user's hand — a success criterion, progress line, decision, experiment
 * or forecast: an open pencil ring while still open, an ink tick once
 * settled — or an ink cross when `crossed` (a forecast that didn't happen).
 * Never a box, so nothing looks tickable that isn't. The tick or cross is a
 * bare box slot the marks layer draws on `path`. */
function Marker({ path, open, crossed }: { path: string; open: boolean; crossed?: boolean }) {
  return open ? (
    <span className="flex h-[27px] w-[18px] shrink-0 items-center justify-center" aria-hidden="true">
      <span className="h-[9px] w-[9px] rounded-full border-[1.5px] border-graphite" />
    </span>
  ) : (
    <span className="box mt-[4.5px] shrink-0" data-box={path} data-bare="" data-checked="" data-crossed={crossed ? '' : undefined} aria-hidden="true" />
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
const early = (d?: string) => { const n = d ? daysUntil(d) : null; return n !== null && n > 0; };
/** How many days before its check date a fork's settle buttons show. */
const FORK_CHECK_DAYS = 7;
const isLate = (d?: string) => { const n = d ? daysUntil(d) : null; return n !== null && n < 0; };

/** A Bets section split in two under pencilled status labels — the
 * open items ("not tested yet"), soonest due first, then the settled ones,
 * newest first. The label is the item's status, so the items themselves
 * carry no status mark. A group with nothing in it isn't shown. Each item
 * keeps its stored index for its path. */
function StatusGroups<T>({ k, list, isOpen, due, labels, pinned, render }: {
  k: string;
  list: T[];
  isOpen: (x: T) => boolean;
  due: (x: T) => string | undefined;
  labels: [open: string, settled: string];
  /** A settled item that still asks something of the user (a decision due
   * for review): it stays out of the fold. */
  pinned?: (x: T) => boolean;
  render: (x: T, i: number) => ReactNode;
}) {
  // Settled items fold into one "n decided" line, opened on tap — or by a
  // goto landing on one of them.
  const [picked, setShowSettled] = useState(false);
  const goto = useGoto();
  const rows = list.map((x, i) => ({ x, i }));
  const key = (r: { x: T }) => due(r.x) ?? '9999';
  const open = rows.filter((r) => isOpen(r.x)).sort((a, b) => key(a).localeCompare(key(b)));
  const settled = rows.filter((r) => !isOpen(r.x)).reverse();
  const loud = settled.filter((r) => pinned?.(r.x));
  const quiet = settled.filter((r) => !pinned?.(r.x));
  const showSettled = picked || quiet.some(({ i }) => goto?.path === `${k}.${i}` || goto?.path.startsWith(`${k}.${i}.`));
  const list_ = (rs: typeof rows) => <ul className="space-y-5 text-[17px] leading-[27px]">{rs.map(({ x, i }) => render(x, i))}</ul>;
  return (
    <div className="space-y-5">
      {open.length > 0 && (
        <div className="space-y-2">
          <h3><PencilWord className="text-[21px] text-graphite">{labels[0]}</PencilWord></h3>
          {list_(open)}
        </div>
      )}
      {settled.length > 0 && (
        <div className="space-y-2">
          {quiet.length > 0 ? (
            <h3>
              {/* The fold's tap area is taller than its line; pull it back so
               * the gap above it matches the page's rhythm. */}
              <TextAction className="-my-2.5" aria-expanded={showSettled} onClick={() => setShowSettled((v) => !v)}>
                <PencilWord className="text-[21px] text-graphite">{showSettled ? labels[1] : `${quiet.length} ${labels[1]}`}</PencilWord>
              </TextAction>
            </h3>
          ) : (
            <h3><PencilWord className="text-[21px] text-graphite">{labels[1]}</PencilWord></h3>
          )}
          {(loud.length > 0 || showSettled) && list_(showSettled ? settled : loud)}
        </div>
      )}
    </div>
  );
}

/** A checkpoint's diamond: open while the milestone is still to come,
 * filled once it has become true. */
function Diamond({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className="h-[11px] w-[11px]" aria-hidden="true">
      <path d="M6 0.9 L11.1 6 L6 11.1 L0.9 6 Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/** A milestone: something that becomes true, not something to do, so it
 * has no box. It is a checkpoint ruled across the page after the tasks
 * that reach it, the way a notebook rules off a section: a short stroke,
 * the diamond in the marker column, its name where a task's text starts,
 * then the stroke runs on to the right edge, all on one line. Every
 * milestone is drawn the same, quieter than the tasks: a faint dotted
 * pencil line and a grey name. The diamond is open until its tasks are
 * done, then filled, with the day it was reached; unticking a task opens
 * it again. */
function MilestoneRule({ goalId, path, step, editable, stage, reachedOn }: {
  goalId: string; path: string; step: Any; editable: boolean;
  stage: 'passed' | 'current' | 'ahead'; reachedOn?: string;
}) {
  // Every milestone sits one step quieter than the tasks, in the same
  // faint dotted pencil; only the diamond, filled once reached, tells them
  // apart.
  const tone = 'faint';
  const ink = 'text-graphite';
  // Each stroke sits in a box one text line tall, so it meets the middle
  // of the name's first line however the name wraps.
  const stroke = (side: string, className: string) => (
    <span className={`flex h-[22px] items-center ${className}`}><span className="w-full"><PencilRule seed={`${path}:${side}`} tone={tone} /></span></span>
  );
  return (
    <li data-milestone={stage} className={`my-3 flex items-start text-[15px] leading-[22px] ${ink}`} title={step.detail}>
      {/* The diamond keeps the marker column's centre, where ✉ and the
       * boxes sit; the stroke runs in from the left edge to meet it. */}
      <span className="flex w-11 shrink-0 items-start">
        {stroke('l', 'w-[14px] shrink-0')}
        <span className="ml-[3px] flex h-[22px] items-center"><Diamond filled={stage === 'passed'} /></span>
      </span>
      <div className="min-w-0 shrink pr-2">
        <Line goalId={goalId} path={path} className="font-medium" edit={editable && isEditableLine(path) ? { value: step.label, quiet: true } : undefined}><span>{step.label}</span></Line>
        {stage === 'passed' && reachedOn && <span className="text-[14px] text-graphite">reached {pencilDate(reachedOn)}</span>}
        <span className="sr-only">{stage === 'passed' ? ' (milestone, reached)' : stage === 'current' ? ' (milestone, next)' : ' (milestone, further on)'}</span>
      </div>
      {stroke('r', 'min-w-[24px] flex-1')}
    </li>
  );
}

/** "+ add a move": a pencilled link under a line's moves that opens the
 * same inline field a reword uses, and adds the move as the user's own. */
function AddMove({ goalId, li }: { goalId: string; li: number }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <TextAction className="-my-2 ml-11" onClick={() => setOpen(true)}>
        <PencilWord className="text-[18px] text-graphite">+ add a move</PencilWord>
      </TextAction>
    );
  }
  return (
    <div data-editing="" className="ml-11 text-[17px] leading-[27px]">
      <InlineInput
        label="New move"
        onSave={(draft) => addMove(goalId, li, draft)}
        onDone={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
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

/** Each escalation level in the page's words. */
const LEVEL_WORD: Record<string, string> = { interests: 'ask', rights: 'formal', power: 'public' };

/** The escalations that follow a message, in climbing order: the one that
 * escalates it, then the one that escalates that, and so on. */
function chainAfter(msg: Any, tasks: Any[]): Any[] {
  const out: Any[] = [];
  let cur = msg;
  for (let n = 0; cur?.id && n < tasks.length; n++) {
    const next = tasks.find((t) => t.status === 'pending' && t.if && 'noReply' in t.if && t.if.noReply === cur.id);
    if (!next) break;
    out.push(next);
    cur = next;
  }
  return out;
}

/** "if no reply: Formal complaint to TfNSW, then State MP, then Local paper
 * (public)": the rest of a message's climb on one line. The arrow on the
 * page means "then", so "to" names who a message goes to. */
function ChainLine({ chain }: { chain: Any[] }) {
  if (!chain.length) return null;
  const step = (t: Any, i: number) => `${i ? `then ${t.to}` : `${t.action} to ${t.to}`}${t.level === 'power' ? ' (public)' : ''}`;
  return (
    <div className="text-[14px] leading-5 text-graphite">
      <span className="text-ink">if no reply: </span>
      {chain.map((t, i) => <span key={i}>{i ? ', ' : ''}{step(t, i)}</span>)}
    </div>
  );
}

/** A row whose marker sits in the same 44px column as the tick boxes, so
 * every row's text starts at one edge: ✉ a message waiting for a reply,
 * ↳ a fork, • a move waiting on another. */
function MarkedRow({ mark, children }: { mark: string; children: ReactNode }) {
  return (
    <li className="flex items-start text-[15px] leading-[22px]">
      <span className="w-11 shrink-0 text-center text-graphite" aria-hidden="true">{mark}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

/** A pencilled label over a part of the line, e.g. "if things change". */
function GroupLabel({ children }: { children: ReactNode }) {
  return <h4><PencilWord className="text-[19px] text-graphite">{children}</PencilWord></h4>;
}

const PLAN_LINE_PATH = /^plan\.linesOfOperation\.(\d+)(?:\.|$)/;

/** Which line of operation a dotted LinePath sits in, or null when it isn't
 * a plan path. */
export function planLineIndex(path: string | null | undefined): number | null {
  const m = path ? PLAN_LINE_PATH.exec(path) : null;
  return m ? Number(m[1]) : null;
}

/** A line of operation's next actions still in play (pending or done —
 * not proposed, not dropped), and how many of them are done. Milestones
 * aren't counted: they are passed, not done. */
export function lineProgress(l: Any): { done: number; total: number } {
  const live = l.nextActions.filter((x: Any) => x.status === 'pending' || x.status === 'done');
  return { done: live.filter((x: Any) => x.status === 'done').length, total: live.length };
}

/** Which line's sheet sits on top when nothing has picked one: the line
 * the focus mark lands on, else the plan's focus line, else the first with
 * anything still pending, else the first. */
export function defaultOpenLine(lines: Any[], focusLine: number | null): number {
  if (focusLine != null && focusLine < lines.length) return focusLine;
  const flagged = lines.findIndex((l) => l.focus);
  if (flagged >= 0) return flagged;
  const pending = lines.findIndex((l) => { const p = lineProgress(l); return p.done < p.total; });
  return pending >= 0 ? pending : 0;
}

/** A status worth pencilling: only one that asks something of the user.
 * "on schedule", "on track", "done" and "met" go unsaid — silence means
 * fine, and a tick already says done. */
const ALARM = new Set(['at_risk', 'blocked', 'stalled', 'regressing']);
const alarm = (status?: string) => (status && ALARM.has(status) ? status.replace('_', ' ') : undefined);

/** How far along a tucked line is, as marks rather than words: a small ink
 * tick per thing done and an open ring per thing left — the same marker the
 * rest of the page uses. Past a dozen the marks stop being glanceable, so
 * it falls back to the count. */
function ProgressMarks({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const words = `${done} of ${total} done`;
  if (total > 12) return <PencilWord className="text-[17px]">{words}</PencilWord>;
  return (
    <span className="flex items-center gap-[3px]" title={words}>
      {Array.from({ length: total }, (_, i) => i < done ? (
        <svg key={i} viewBox="0 0 10 10" className="h-[10px] w-[10px] text-ink" aria-hidden="true">
          <path d="M1.2 5.6 L3.9 8.4 L8.9 1.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span key={i} className="h-[7px] w-[7px] rounded-[50%] border-[1.25px] border-graphite" aria-hidden="true" />
      ))}
      <span className="sr-only">{words}</span>
    </span>
  );
}

/** The plan, one line of operation at a time. The lines sit in a strip of
 * pencilled names across the top, in plan order, scrolling sideways when
 * they don't fit; the selected one is underlined in pencil, and one that's at
 * risk or blocked carries a pencilled "!" so trouble elsewhere still shows.
 * Under the strip: the selected line's status and progress, then its
 * moves — always in the same place, so switching lines never moves the
 * page. */
function PlanStack({ lines, goalId, editable }: { lines: Any[]; goalId: string; editable: boolean }) {
  const { dropped, turn } = useSession();
  const marks = useMarksContext();
  const goto = useGoto();
  const gotoLine = planLineIndex(goto?.path);
  // The line the user picked, or null when nothing has been picked yet and
  // the default applies.
  const [picked, setPicked] = useState<number | null>(gotoLine);
  // Forks whose settle buttons the user opened before their check week.
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(() => new Set());

  // A goto into a closed line opens it — adjusted during render, not in an
  // effect, so its rows are already in the DOM when Tabs.tsx looks for the
  // target line to scroll to.
  const [seenGoto, setSeenGoto] = useState(goto?.seq ?? 0);
  if (goto && goto.seq !== seenGoto) {
    setSeenGoto(goto.seq);
    if (gotoLine != null) setPicked(gotoLine);
  }


  // The strip fades out at the right edge while there's more to scroll to.
  const stripRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const measure = () => {
    const el = stripRef.current;
    if (el) setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };
  useEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined' || !stripRef.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(stripRef.current);
    return () => ro.disconnect();
  }, [lines.length]);

  const plan = { linesOfOperation: lines } as NonNullable<Goal['plan']>;
  const top = nextMove({ plan } as Goal)?.path;
  // The line the focus highlight lands on, else the top move's line.
  let focusLine: number | null = null;
  marks?.derived.byPath.forEach((mark, path) => {
    if (focusLine == null && mark.kind === 'highlight') focusLine = planLineIndex(path);
  });
  focusLine ??= planLineIndex(top);
  const open = picked != null && picked < lines.length ? picked : defaultOpenLine(lines, focusLine);
  // Keep the selected pill in view — on a tap, a goto, or the default.
  useEffect(() => {
    const strip = stripRef.current;
    const pill = strip?.querySelector<HTMLElement>(`[data-plan-sheet="${open}"]`);
    if (!strip || !pill) return;
    const p = pill.getBoundingClientRect();
    const st = strip.getBoundingClientRect();
    let to: number | null = null;
    if (p.right > st.right) to = strip.scrollLeft + p.right - st.right + 24;
    else if (p.left < st.left) to = strip.scrollLeft + p.left - st.left - 16;
    if (to == null) return;
    // Near either end, go all the way, so no sliver is left to scroll.
    const max = strip.scrollWidth - strip.clientWidth;
    strip.scrollTo({ left: to > max - 40 ? max : to < 40 ? 0 : to, behavior: 'smooth' });
  }, [open]);
  const changedLine = turn?.goalId === goalId ? planLineIndex(turn.lines[0]?.path) : null;
  // The top move is on the index card above and in its place in the list
  // too, so the milestone it works toward isn't left with nothing above it.
  // Its detail shows on the card only.
  const byId = new Map(lines.flatMap((l: Any) => l.nextActions).filter((a: Any) => a.id).map((a: Any) => [a.id, a]));
  // People and stakeholders, so a move after "then" keeps a name's capital.
  const goal = marks?.goal ?? ({ people: [], stakeholders: [] } as unknown as Goal);

  const body = (li: number) => {
    const l = lines[li];
    const base = `plan.linesOfOperation.${li}`;
    const day = today();
    const visible = visibleActions(l.nextActions, goalId, `${base}.nextActions`, dropped);
    const tasks = l.nextActions.filter((a: Any) => a.status !== 'dropped');
    const stateOf = (a: Any) => taskState(a, plan, day);
    // A message that went out and hasn't been answered is still in play: it
    // waits for a reply, marked ✉, rather than ticked done.
    const awaiting = (a: Any) => a.status === 'done' && a.to && !a.replied;
    // A fork set aside as not needed stays in its place for this session,
    // struck through, with its undo.
    const isFork = (a: Any) => (stateOf(a) === 'waiting' || a.status === 'dropped') && a.if && 'event' in a.if;
    // An escalation still waiting shows only in its message's "if no reply"
    // line, so it gets no row of its own.
    const isChained = (a: Any) => stateOf(a) === 'waiting' && a.if && 'noReply' in a.if;
    // The line in stretches, one per milestone, each ending on its rule,
    // plus a last stretch after the last rule. A task sits in the stretch
    // of the first milestone that lists it in `after`; a task no milestone
    // lists sits in the stretch the line is heading through.
    const steps = l.criticalPath.map((st: Any, i: number) => ({ st, path: `${base}.criticalPath.${i}`, reached: milestoneReached(st, plan) }));
    const current = steps.findIndex((m: Any) => !m.reached);
    // The day a milestone became true: the last day a task toward it was done.
    const reachedOn = (st: Any) => (st.after ?? []).map((id: string) => byId.get(id)?.doneOn).filter(Boolean).sort().pop();
    const heading = current >= 0 ? current : steps.length;
    const stretchOf = (a: Any) => {
      const k = a.id ? steps.findIndex(({ st }: Any) => st.after?.includes(a.id)) : -1;
      return k >= 0 ? k : heading;
    };
    // A task a milestone lists stays in that milestone's stretch whatever
    // kind it is, so no milestone loses the moves that reach it: a fork
    // there is an "if … then …" row, and a waiting escalation whose message
    // sits elsewhere is one too. A waiting escalation beside its message
    // shows only in the message's "if no reply" line, and a fork no
    // milestone lists goes under "if things change".
    const linked = (a: Any) => Boolean(a.id && steps.some(({ st }: Any) => st.after?.includes(a.id)));
    const messageOf = (a: Any) => tasks.find((t: Any) => t.id === a.if.noReply);
    const besideMessage = (a: Any) => { const msg = messageOf(a); return Boolean(msg) && stretchOf(msg) === stretchOf(a); };
    const inStretch = (a: Any) => (isFork(a) ? linked(a) : isChained(a) ? !besideMessage(a) : true);
    const rowsIn = (k: number) => visible.filter(({ a }) => inStretch(a) && stretchOf(a) === k);
    const forks = visible.filter(({ a }) => isFork(a) && !linked(a));
    const detailFor = rowsIn(heading).find(({ a, path }) => path !== top && stateOf(a) === 'live' && a.status === 'pending')?.path ?? null;
    const unlocks = (a: Any) => (a.id ? tasks.filter((t: Any) => t.after?.includes(a.id) && t.status === 'pending').map((t: Any) => t.action) : []);
    // What a blocked task waits on. The one drawn directly above it is
    // "↑", so the page doesn't print the same move twice in a row.
    const waitsOn = (after: string[], prev?: string) => {
      const names = after.map((id) => (id === prev ? '↑' : name(id)));
      return names.length === 1 && names[0] === '↑' ? '↑ then ' : `${names.join(', ')} → `;
    };
    const name = (id: string) => byId.get(id)?.action ?? l.criticalPath.find((st: Any) => st.id === id)?.label ?? id;

    const folded = (a: Any, path: string) => (daysUntil(a.if.by ?? '') ?? 0) > FORK_CHECK_DAYS && !unfolded.has(path);
    const conditional = ({ a, path }: { a: Any; path: string }) => {
      const fork = 'event' in a.if;
      const msg = fork ? undefined : messageOf(a);
      return (
        <MarkedRow key={path} mark="↳">
          <Line goalId={goalId} path={path}>
            <span className="text-graphite">if </span>
            {fork
              ? <span>{a.if.event}</span>
              : <span>{msg?.to ?? 'they'} {msg?.to ? "doesn't" : "don't"} reply in {a.if.days} days</span>}
            {fork && a.if.by && <span className="text-[14px] text-graphite"> · check {byDate(a.if.by)}</span>}
            <br />
            <span className="text-graphite">then </span><span>{afterThen(goal, a.action)}</span>
            {a.to && <span className="text-[14px] text-graphite"> · to {a.to}</span>}
          </Line>
          {editable && fork && (a.status === 'dropped' ? (
            <div className="flex gap-x-4 text-[14px] text-graphite">
              <span>not needed</span>
              <TextAction className="-my-2 underline" onClick={() => void settleFork(goalId, path, null)}>undo</TextAction>
            </div>
          ) : folded(a, path) ? (
            // Weeks before its check date the fork is a reminder, not a
            // question; the buttons wait a tap away for news that comes early.
            <TextAction className="-my-2 text-[14px] text-graphite underline" onClick={() => setUnfolded((u) => new Set(u).add(path))}>know already?</TextAction>
          ) : (
            // Named by what each does to the move, not by the event, so a
            // negative event ("no offer by mid-December") never makes a
            // double negative. Before the check date, "not needed" is the
            // quieter one: an absence can't be known until then.
            <div className="flex gap-x-4 text-[14px]">
              <TextAction className="-my-2 underline" onClick={() => void settleFork(goalId, path, true)}>do this now</TextAction>
              <TextAction className={`-my-2 underline ${early(a.if.by) ? 'text-graphite' : ''}`} onClick={() => void settleFork(goalId, path, false)}>not needed</TextAction>
            </div>
          ))}
        </MarkedRow>
      );
    };

    // `prev` is the id of the task or milestone drawn directly above.
    const row = ({ a, path }: { a: Any; path: string }, prev?: string) => {
      if (isFork(a) || isChained(a)) return conditional({ a, path });
      if (awaiting(a)) {
        const chain = chainAfter(a, tasks);
        const wait = chain[0]?.if?.days;
        const waited = a.doneOn ? Math.max(0, -(daysUntil(a.doneOn) ?? 0)) : 0;
        return (
          <MarkedRow key={path} mark="✉">
            {/* Not a Line: the marks layer would tick it as done, and it
             * isn't finished until they answer. */}
            <div>
              <span>{a.action}</span>
              <span className="text-[14px] text-graphite"> · to {a.to}{a.doneOn ? ` · sent ${pencilDate(a.doneOn)}` : ''} · waiting for a reply, day {waited}{wait ? ` of ${wait}` : ''}</span>
            </div>
            <ChainLine chain={chain} />
            {editable && (
              <TextAction className="-my-2 text-[14px] underline" onClick={() => void markTaskReplied(goalId, path)}>they replied</TextAction>
            )}
          </MarkedRow>
        );
      }
      if (stateOf(a) === 'blocked') {
        return (
          <MarkedRow key={path} mark="•">
            <Line goalId={goalId} path={path}>
              <span className="text-[14px] text-graphite">{waitsOn(a.after ?? [], prev)}</span>
              <span>{a.action}</span>
            </Line>
          </MarkedRow>
        );
      }
      const meta = [!isSelf(a.who) && a.who, a.to && `to ${a.to}`, a.when && byDate(a.when)].filter(Boolean).join(' · ');
      const opens = unlocks(a);
      return (
        <Toggle key={path} goalId={goalId} path={path} status={a.status} editable={editable} title={path === detailFor ? undefined : a.detail}>
          <Line goalId={goalId} path={path} className={a.status === 'done' ? 'text-graphite' : ''}>
            {/* Only the action is editable; who/when stays outside it. */}
            {editable && isEditableLine(path)
              ? <EditableText goalId={goalId} path={path} value={a.action}><span>{a.action}</span></EditableText>
              : <span>{a.action}</span>}
            {meta && <span className="ml-2 text-[14px] text-graphite">{meta}</span>}
          </Line>
          {a.status !== 'done' && <ChainLine chain={chainAfter(a, tasks)} />}
          {opens.length > 0 && <div className="text-[14px] leading-5 text-graphite">→ {opens.join(', ')}</div>}
          {a.replied && <div className="text-[14px] leading-5 text-graphite">replied {pencilDate(a.replied)}{a.reply ? `: “${a.reply}”` : ''}</div>}
          {a.if?.happened && a.status !== 'done' && (
            <div className="text-[14px] leading-5 text-graphite">
              because {a.if.event}
              {editable && <> · <TextAction className="-my-2 underline" onClick={() => void settleFork(goalId, path, null)}>undo</TextAction></>}
            </div>
          )}
          {path === detailFor && <Detail>{a.detail}</Detail>}
        </Toggle>
      );
    };

    return (
      <>
        {l.blocker && <p className="text-[14px] text-graphite">Blocked: {l.blocker}</p>}
        <ol className="space-y-1.5">
          {Array.from({ length: steps.length + 1 }, (_, k) => {
            const m = steps[k];
            const rows = rowsIn(k);
            // What sits directly above a row: the row before it, or for the
            // first, the milestone ruled off above its stretch.
            const above = (i: number) => (i > 0 ? rows[i - 1].a.id : steps[k - 1]?.st.id);
            const drawn = rows.map((r, i) => row(r, above(i)));
            if (!m) return drawn;
            const stage = m.reached ? 'passed' : k === current ? 'current' : 'ahead';
            // Done tasks stay where they were, ticked and grey, so a passed
            // milestone keeps the moves that reached it above its line.
            return [
              ...drawn,
              <MilestoneRule key={m.path} goalId={goalId} path={m.path} step={m.st} editable={editable} stage={stage} reachedOn={m.reached ? reachedOn(m.st) : undefined} />,
            ];
          })}
        </ol>
        {editable && l.nextActions.length < NEXT_ACTIONS_MAX && <AddMove goalId={goalId} li={li} />}
        {forks.length > 0 && (
          <div className="space-y-1">
            <GroupLabel>if things change</GroupLabel>
            <ul className="space-y-2">
              {forks.map(conditional)}
            </ul>
          </div>
        )}
      </>
    );
  };

  if (lines.length === 0) return null;
  if (lines.length === 1) {
    const flag = alarm(lines[0].status);
    return (
      <div className="anim-rise space-y-3">
        <div className="min-w-0">
          <h3 className="text-[20px] font-semibold leading-[26px] text-ink">{lines[0].label}</h3>
          {flag && <PencilWord className="mt-0.5 block text-[18px] leading-[24px]">{flag}</PencilWord>}
        </div>
        {body(0)}
      </div>
    );
  }

  const flag = alarm(lines[open].status);
  return (
    <div className="space-y-2">
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Lines of the plan"
        onScroll={measure}
        className="-mx-3 flex overflow-x-auto py-1"
        style={{
          scrollbarWidth: 'none',
          maskImage: more ? 'linear-gradient(to right, black calc(100% - 40px), transparent)' : undefined,
          WebkitMaskImage: more ? 'linear-gradient(to right, black calc(100% - 40px), transparent)' : undefined,
        }}
      >
        {lines.map((line, li) => {
          const selected = li === open;
          const trouble = alarm(line.status);
          const changed = changedLine === li && !selected;
          return (
            <button
              key={li}
              type="button"
              role="tab"
              aria-selected={selected}
              data-plan-sheet={li}
              onClick={() => setPicked(li)}
              className="anim-press relative flex min-h-[44px] shrink-0 items-center whitespace-nowrap px-3"
            >
              <span className={`hand relative text-[21px] leading-7 ${selected ? 'text-ink' : 'text-graphite'}`}>
                {line.label}
                {selected && <PencilUnderline seed={`plan-pill:${li}`} />}
              </span>
              {trouble && <span className="hand ml-0.5 text-[21px] leading-7 text-ink" aria-hidden="true">!</span>}
              {trouble && <span className="sr-only">{` (${trouble})`}</span>}
              {changed && <span aria-hidden="true" className="pencil ml-1 h-1.5 w-1.5 rounded-[50%] bg-graphite" />}
              {changed && <span className="sr-only"> (changed)</span>}
            </button>
          );
        })}
        {/* Room past the last pill for its loop, since a scroller's own end
         * padding isn't reliably scrollable. */}
        <span aria-hidden="true" className="w-4 shrink-0" />
      </div>
      <div key={open} role="tabpanel" aria-label={lines[open].label} className="anim-rise space-y-2">
        <div className="flex min-h-[24px] items-center gap-2.5">
          {flag && <PencilWord className="text-[18px]">{flag}</PencilWord>}
          <ProgressMarks {...lineProgress(lines[open])} />
        </div>
        {body(open)}
      </div>
    </div>
  );
}

const POWER_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };
const powerWord = (p: string) => `${p === 'med' ? 'medium' : p} power`;

/** Where someone stands now and where they need to be, as one line. */
function Stance({ s }: { s: Any }) {
  return <>{s.stanceCurrent} <span aria-hidden="true">→</span><span className="sr-only">to</span> {s.stanceTarget}</>;
}

/** One row on the People page: the name with one pencilled tag, then a
 * single line of what matters now. The reasoning behind it (how to reach
 * them, why, their power when it isn't the tag) stays folded until the row
 * is tapped, so the page scans as a list of names, not a wall of notes. */
function PersonRow({ goalId, path, alias, name, tag, main, more }: { goalId: string; path: string; alias?: string; name: string; tag: string; main: ReactNode; more: ReactNode[] }) {
  const [open, setOpen] = useState(false);
  const extra = more.filter(Boolean);
  // The whole row opens, not only the word; it stands aside for anything
  // with its own click and for a drag that selected text.
  const onRowClick = (e: MouseEvent<HTMLLIElement>) => {
    if ((e.target as Element).closest('button, a, textarea, [data-editing]')) return;
    if (window.getSelection()?.toString()) return;
    setOpen((v) => !v);
  };
  return (
    <li className={extra.length > 0 ? 'cursor-pointer' : ''} onClick={extra.length > 0 ? onRowClick : undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <Line goalId={goalId} path={path} alias={alias}>
          <span className="font-medium text-ink">{name}</span>
        </Line>
        <PencilWord className="shrink-0 text-graphite">{tag}</PencilWord>
      </div>
      <div className="text-[15px] leading-6 text-ink">
        {main}
        {extra.length > 0 && (
          <TextAction circle={false} className="-my-2.5 ml-1.5 align-baseline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <PencilWord className="text-[18px] text-graphite">{open ? 'less' : 'more'}</PencilWord>
          </TextAction>
        )}
      </div>
      {open && <div className="anim-rise">{extra.map((m, i) => <Detail key={i}>{m}</Detail>)}</div>}
    </li>
  );
}

/** The People page as one list: everyone in `people`, with a matching
 * `stakeholders` entry (same name) folded into their row rather than shown
 * a second time, then whoever else has a say, strongest first. */
export function PeopleBody({ goalId, people: storedPeople, stakeholders: storedStakeholders }: { goalId: string; people: Any[]; stakeholders: Any[] }) {
  const people = useMemo(() => withProseDates(storedPeople) as Any[], [storedPeople]);
  const stakeholders = useMemo(() => withProseDates(storedStakeholders) as Any[], [storedStakeholders]);
  const norm = (n: string) => n.trim().toLowerCase();
  const byName = new Map(stakeholders.map((s, j) => [norm(s.name), j]));
  const claimed = new Set<number>();
  const rows = people.map((p, i) => {
    const j = byName.get(norm(p.name));
    if (j !== undefined) claimed.add(j);
    const s = j !== undefined ? stakeholders[j] : undefined;
    return (
      <PersonRow
        key={`p${i}`}
        goalId={goalId}
        path={`people.${i}`}
        alias={j !== undefined ? `stakeholders.${j}` : undefined}
        name={p.name}
        tag={p.status}
        main={<EditableText goalId={goalId} path={`people.${i}.doing`} value={p.doing}>{p.doing}</EditableText>}
        more={[
          s && <><Stance s={s} /> · {powerWord(s.power)}</>,
          s && `via ${s.via}`,
          p.detail,
          s?.detail,
        ]}
      />
    );
  });
  const others = stakeholders
    .map((s, j) => ({ s, j }))
    .filter(({ j }) => !claimed.has(j))
    .sort((a, b) => (POWER_RANK[a.s.power] ?? 3) - (POWER_RANK[b.s.power] ?? 3));
  const otherRows = others.map(({ s, j }) => (
    <PersonRow
      key={`s${j}`}
      goalId={goalId}
      path={`stakeholders.${j}`}
      name={s.name}
      tag={powerWord(s.power)}
      main={<Stance s={s} />}
      more={[`via ${s.via}`, s.detail]}
    />
  ));
  return (
    <div className="space-y-5 text-[17px] leading-[27px]">
      {rows.length > 0 && <ul className="space-y-3">{rows}</ul>}
      {otherRows.length > 0 && (
        <div className="space-y-1.5">
          {rows.length > 0 && <h3 className="text-[14px] leading-5 text-graphite">Also has a say</h3>}
          <ul className="space-y-3">{otherRows}</ul>
        </div>
      )}
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

  if (k === 'intel') {
    // Open questions are tasks: what to find out, how, and by when. Answered
    // ones tick and show the answer.
    return (
      <StatusGroups
        k="intel"
        list={data as Any[]}
        isOpen={(q) => q.status === 'open'}
        due={(q) => q.by}
        labels={['still to find out', 'found out']}
        pinned={() => true}
        render={(q, i) => {
          const open = q.status === 'open';
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Marker path={`intel.${i}`} open={open} />
              <div className="min-w-0 flex-1">
                <Line goalId={goalId} path={`intel.${i}`} className={`font-medium ${open ? 'pencil' : ''}`}>
                  <span>{q.question}</span>
                </Line>
                {open ? <Facts rows={[['Why it matters', q.why], ['Find out by', q.via]]} /> : <Facts rows={[['Answer', q.answer], ['Why it matters', q.why]]} />}
                {open && (
                  <ItemFooter
                    when={q.by ? (isLate(q.by) ? `was due ${pencilDate(q.by)}` : byDate(q.by)) : undefined}
                    late={isLate(q.by)}
                    action={{ label: 'Tell me what you found', starter: `What I found out about "${q.question}": ` }}
                  />
                )}
              </div>
            </li>
          );
        }}
      />
    );
  }

  if (k === 'courses') {
    return (
      <ul className="space-y-5 text-[17px] leading-[27px]">
        {(data as Any[]).map((c, i) => (
          <li key={i}>
            <Line goalId={goalId} path={`courses.${i}`}>
              <span className="font-medium text-ink">{c.name}</span>
              {c.chosen && <PencilWord className="ml-2">chosen</PencilWord>}
            </Line>
            <div>{c.idea}</div>
            <Facts rows={[['Could win because', c.wins], ['Could sink it', c.risks], ['Their reaction', c.counter]]} />
          </li>
        ))}
      </ul>
    );
  }

  if (k === 'prep') {
    return (
      <StatusGroups
        k="prep"
        list={data as Any[]}
        isOpen={(p) => !p.done}
        due={(p) => p.on}
        labels={['coming up', 'held']}
        pinned={() => true}
        render={(p, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Marker path={`prep.${i}`} open={!p.done} />
            <div className="min-w-0 flex-1">
              <Line goalId={goalId} path={`prep.${i}`}>
                <span className="font-medium text-ink">{p.with}</span>
              </Line>
              <Facts
                rows={[
                  ['Ask for', p.ask],
                  ['Walk away at', p.walkAway],
                  ['If it fails', p.batna],
                  ['Can give', p.concessions?.length ? p.concessions.join(', ') : undefined],
                  ['How it went', p.done ? p.outcome : undefined],
                ]}
              />
              {!p.done && <ItemFooter when={p.on ? (isLate(p.on) ? `was ${pencilDate(p.on)}` : byDate(p.on)) : undefined} late={isLate(p.on)} action={{ label: 'Tell me how it went', starter: `How the talk with ${p.with} went: ` }} />}
            </div>
          </li>
        )}
      />
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
            <Line goalId={goalId} path={`riskNotes.${i}`} className={r.accepted ? 'text-graphite' : ''} edit={editable ? { value: r.item } : undefined}>
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
        k="decisions"
        list={data as Any[]}
        isOpen={(d) => d.status === 'open'}
        due={(d) => d.reviewBy}
        labels={['still to decide', 'decided']}
        pinned={(d) => isDue(d.reviewBy)}
        render={(d, i) => {
          const open = d.status === 'open';
          const reviewDue = !open && isDue(d.reviewBy);
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Marker path={`decisions.${i}`} open={open} />
              <div className="min-w-0 flex-1">
                {/* An open question can be reframed here; a decided choice changes only through `decide`. */}
                <Line goalId={goalId} path={`decisions.${i}`} edit={editable && open ? { value: d.question } : undefined}>
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
    // The "up to you / up to someone else" split only says something when
    // there's more than one side to it.
    const split = CRITERION_GROUPS.filter(({ kind }) => criteria.some(({ c }: Any) => c.kind === kind)).length > 1;
    return (
      <div className="space-y-4 text-[17px] leading-[27px]">
        {CRITERION_GROUPS.map(({ kind, label }) => {
          const group = criteria.filter(({ c }: Any) => c.kind === kind);
          if (group.length === 0) return null;
          return (
            <div key={kind} className="space-y-1.5">
              {split && <h3 className="text-[14px] leading-5 text-graphite">{label}</h3>}
              <ul className="space-y-3">
                {group.map(({ c, path }: Any) => <Criterion key={path} goalId={goalId} path={path} c={c} editable={editable} />)}
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
          <li key={i} className="flex items-start gap-2.5">
            <Marker path={`criteriaStatus.${i}`} open={c.status !== 'met'} />
            <div className="min-w-0 flex-1">
              <Line goalId={goalId} path={`criteriaStatus.${i}`}>
                <span>{c.text}</span>
                {alarm(c.status) && <PencilWord className="ml-2">{alarm(c.status)}</PencilWord>}
              </Line>
              <Detail>{c.detail}</Detail>
            </div>
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
        k="experiments"
        list={data as Any[]}
        isOpen={(e) => !e.done}
        due={(e) => e.by}
        labels={['not tested yet', 'tested']}
        render={(e, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Marker path={`experiments.${i}`} open={!e.done} />
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
        k="forecasts"
        list={data as Any[]}
        isOpen={(f) => !f.resolved}
        due={(f) => f.resolvesBy}
        labels={['waiting to find out', 'found out']}
        render={(f, i) => {
          const due = !f.resolved && isDue(f.resolvesBy);
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Marker path={`forecasts.${i}`} open={!f.resolved} crossed={f.outcome === 'no'} />
              <div className="min-w-0 flex-1">
                <Line goalId={goalId} path={`forecasts.${i}`} className={`font-medium ${f.resolved ? '' : 'pencil'}`}>
                  <span>{f.statement}</span>
                </Line>
                {f.resolved && (
                  <Facts rows={[['You said', `${f.probability}% likely`], ['Outcome', f.outcome === 'yes' ? 'It happened' : f.outcome === 'no' ? 'It didn’t happen' : undefined], ['Your call was', f.verdict]]} />
                )}
                {!f.resolved && (
                  // How likely, when and how it'll be known: one pencilled line.
                  <ItemFooter
                    when={[`${f.probability}% likely`, isLate(f.resolvesBy) ? `was due ${pencilDate(f.resolvesBy)}` : `know ${byDate(f.resolvesBy)}${f.resolvesVia ? ` via ${f.resolvesVia}` : ''}`].join(' · ')}
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
