import type { Goal } from './types';
import { taskState } from '@gambit/core';
import { today } from './dates';

// The goal's dates as an iCalendar file (RFC 5545): one all-day event per
// date that still asks something of the user. Pure: no clock, no storage.
// Each UID is the goal id plus the item's path, so importing the file again
// updates an event instead of doubling it.

export interface CalendarDate {
  /** Where the date lives in the goal, e.g. `plan.linesOfOperation.0.nextActions.2`. */
  path: string;
  /** YYYY-MM-DD */
  date: string;
  summary: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = (d: unknown): d is string => typeof d === 'string' && ISO.test(d);

/** Every date in the goal that is still open, soonest first. */
export function goalDates(goal: Goal): CalendarDate[] {
  const out: CalendarDate[] = [];
  const add = (path: string, date: unknown, summary: string) => {
    if (isoDate(date)) out.push({ path, date, summary });
  };
  add('deadline', goal.deadline, `Deadline: ${goal.goal}`);
  goal.plan?.linesOfOperation?.forEach((l, li) =>
    l.nextActions?.forEach((a, ai) => {
      const path = `plan.linesOfOperation.${li}.nextActions.${ai}`;
      if (a.status !== 'pending') return;
      if (a.if && 'event' in a.if && !a.if.happened) add(path, a.if.by, `Check: ${a.if.event}`);
      else if (taskState(a, goal.plan, today()) !== 'waiting') add(path, a.when, a.action);
    }),
  );
  goal.forecasts?.forEach((f, i) => { if (!f.resolved) add(`forecasts.${i}`, f.resolvesBy, `Check: ${f.statement}`); });
  goal.experiments?.forEach((e, i) => { if (!e.done) add(`experiments.${i}`, e.by, `Test result due: ${e.assumption}`); });
  goal.decisions?.forEach((d, i) => { if (d.status !== 'open') add(`decisions.${i}`, d.reviewBy, `Revisit: ${d.choice ?? d.question ?? 'decision'}`); });
  goal.intel?.forEach((q, i) => { if (q.status === 'open') add(`intel.${i}`, q.by, `Find out: ${q.question}`); });
  goal.prep?.forEach((p, i) => { if (!p.done) add(`prep.${i}`, p.on, `Talk with ${p.with}`); });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** RFC 5545 TEXT escaping. */
export const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const encoder = new TextEncoder();

/** Fold a content line at 75 octets, never inside a UTF-8 character. Each
 * continuation starts with one space, which counts toward its 75. */
export function foldLine(line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let size = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + n > limit) { parts.push(cur); cur = ''; size = 0; }
    cur += ch;
    size += n;
  }
  parts.push(cur);
  return parts.map((p, i) => (i === 0 ? p : ` ${p}`));
}

const compact = (d: string) => d.replace(/-/g, '');
const nextDay = (d: string) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

/** A VCALENDAR of all-day events for the goal's open dates, CRLF-terminated. */
export function goalToIcs(goal: Goal, goalId: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gambit//Goal dates//EN', 'CALSCALE:GREGORIAN'];
  for (const d of goalDates(goal)) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeUid(goalId)}-${d.path}@gambit`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(d.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(d.date))}`,
      `SUMMARY:${escapeText(d.summary)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.flatMap(foldLine).join('\r\n') + '\r\n';
}

const escapeUid = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '-');

/** A file name for the goal: its sentence, lower-cased and dashed. */
export const calendarFileName = (goal: Goal) =>
  `${goal.goal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'goal'}.ics`;

/** Hand the .ics to the browser as a download. */
export function downloadIcs(goal: Goal, goalId: string) {
  const blob = new Blob([goalToIcs(goal, goalId)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = calendarFileName(goal);
  a.click();
  URL.revokeObjectURL(a.href);
}
