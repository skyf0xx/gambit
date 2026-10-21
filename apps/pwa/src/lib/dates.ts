// Dates in voice (brand/voice.md §05 "numbers as numerals", never ISO, never
// jargon abbreviations like "wk"). Two jobs: a deadline read as time-left
// ("6 weeks left", "3 days left", "due today", "2 days late"), and any other
// pencilled date read short: "tomorrow", "in 3 days", "Fri 3 Oct" (en-GB
// order: day before month).

import { intlLocale, locale, t } from './i18n';

const DAY_MS = 86_400_000;

/** Today's local date as YYYY-MM-DD: the date the user's own day is on. */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function parseIsoDateUTC(d: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
}

/** Whole days between today (UTC midday) and the given ISO date. Positive:
 * in the future. Negative: in the past. */
export function daysUntil(d: string, now = new Date()): number | null {
  const t = parseIsoDateUTC(d);
  if (!t) return null;
  const n = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  return Math.round((t.getTime() - n) / DAY_MS);
}

/** "6 weeks left", "3 days left", "due today", "2 days late". Falls back to
 * the pencilled long-date form for anything not a plain ISO date. */
export function timeLeft(d: string, now = new Date()): string {
  const days = daysUntil(d, now);
  if (days === null) return pencilDate(d);
  if (days === 0) return t('dates.dueToday');
  if (days < 0) return t('dates.late', { count: -days });
  if (days < 14) return t('dates.daysLeft', { count: days });
  return t('dates.weeksLeft', { count: Math.round(days / 7) });
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// English keeps its own short names ("Sep", never Intl's "Sept"); other
// languages take theirs from Intl.
const english = () => locale() === 'en';
const intlDate = (t: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(), { ...o, timeZone: 'UTC' }).format(t);

/** "Fri 3 Oct" — en-GB order, day then month, no year unless it isn't
 * this year. Other languages use their own order and names. */
export function pencilDate(d: string | null | undefined, now = new Date()): string {
  if (!d) return '';
  const t = parseIsoDateUTC(d);
  if (!t) return d;
  const year = t.getUTCFullYear();
  const thisYear = now.getUTCFullYear();
  if (!english()) return intlDate(t, { weekday: 'short', day: 'numeric', month: 'short', ...(year === thisYear ? {} : { year: 'numeric' }) });
  const weekday = WEEKDAYS[t.getUTCDay()];
  const day = t.getUTCDate();
  const month = MONTHS[t.getUTCMonth()];
  return year === thisYear ? `${weekday} ${day} ${month}` : `${weekday} ${day} ${month} ${year}`;
}

const ISO_IN_TEXT = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

/** A date inside a sentence: "19 Mar", or "19 Mar 2027" when it isn't this
 * year. Shorter than the pencilled form — no weekday — because it sits in
 * running text rather than standing alone. */
export function proseDates(text: string, now = new Date()): string {
  return text.replace(ISO_IN_TEXT, (iso, y, m, d) => {
    if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return iso;
    if (!english()) return intlDate(new Date(Date.UTC(+y, +m - 1, +d, 12)), { day: 'numeric', month: 'short', ...(+y === now.getUTCFullYear() ? {} : { year: 'numeric' }) });
    const short = `${+d} ${MONTHS[+m - 1]}`;
    return +y === now.getUTCFullYear() ? short : `${short} ${y}`;
  });
}

/** Every free-text string in a section's data with its ISO dates rewritten
 * by `proseDates`, for display only. A string that is nothing but an ISO
 * date is left alone: that is a date field, and the renderer formats it
 * itself (`pencilDate`, `byDate`, `timeLeft`). */
export function withProseDates<T>(value: T, now = new Date()): T {
  if (typeof value === 'string') return (parseIsoDateUTC(value) ? value : proseDates(value, now)) as T;
  if (Array.isArray(value)) return value.map((v) => withProseDates(v, now)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withProseDates(v, now)])) as T;
  }
  return value;
}

/** A due-by field (next actions, steps, experiments, forecasts) said as
 * briefly as it reads: "today", "tomorrow", "in 3 days" within the week,
 * else "Fri 3 Oct". A date already past gets the plain date — the caller
 * says it's late. Some of this data is free text written by a skill rather
 * than a strict ISO date (e.g. "next week") — that passes through
 * unchanged. */
export function byDate(d: string | null | undefined, now = new Date()): string {
  if (!d) return '';
  const days = daysUntil(d, now);
  if (days === null) return d;
  if (days === 0) return t('dates.today');
  if (days === 1) return t('dates.tomorrow');
  if (days > 1 && days < 7) return t('dates.inDays', { count: days });
  return pencilDate(d, now);
}
