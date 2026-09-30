// Dates in voice (brand/voice.md §05 "numbers as numerals", never ISO, never
// jargon abbreviations like "wk"). Two jobs: a deadline read as time-left
// ("6 weeks left", "3 days left", "due today", "2 days late"), and any other
// pencilled date read as "by Friday 3 Oct" (en-GB order: day before month).

const DAY_MS = 86_400_000;

function parseIsoDateUTC(d: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
}

/** Whole days between today (UTC midday) and the given ISO date. Positive:
 * in the future. Negative: in the past. */
function daysUntil(d: string, now = new Date()): number | null {
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
  if (days === 0) return 'due today';
  if (days < 0) {
    const late = -days;
    return `${late} day${late === 1 ? '' : 's'} late`;
  }
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} left`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? '' : 's'} left`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Friday 3 Oct" — en-GB order, day then month, no year unless it isn't
 * this year. */
export function pencilDate(d: string | null | undefined, now = new Date()): string {
  if (!d) return '';
  const t = parseIsoDateUTC(d);
  if (!t) return d;
  const weekday = WEEKDAYS[t.getUTCDay()];
  const day = t.getUTCDate();
  const month = MONTHS[t.getUTCMonth()];
  const year = t.getUTCFullYear();
  const thisYear = now.getUTCFullYear();
  return year === thisYear ? `${weekday} ${day} ${month}` : `${weekday} ${day} ${month} ${year}`;
}

/** "by Friday 3 Oct" — the mockup's pencilled-date phrasing for a due-by
 * field (next actions, steps, experiments, forecasts). Some of this data is
 * free text written by a skill rather than a strict ISO date (e.g. "next
 * week", or already "by Friday") — those pass through unchanged rather than
 * getting a second "by " prefix. */
export function byDate(d: string | null | undefined, now = new Date()): string {
  if (!d) return '';
  const t = parseIsoDateUTC(d);
  if (!t) return d;
  return `by ${pencilDate(d, now)}`;
}
