// Parses a GOAL.md body into a fixed header (goal, success criteria,
// deadline — always rendered as the top card) plus an ordered list of the
// remaining `##` sections, each handed to whichever renderer
// registry.mjs maps its heading to.

function splitSections(body) {
  const lines = body.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      current = { heading: match[1], body: [] };
      sections.push(current);
      continue;
    }
    if (line.match(/^#\s+/)) {
      current = null; // the top-level "# Goal" heading, not a section
      continue;
    }
    if (current) current.body.push(line);
  }

  return sections.map((s) => ({ heading: s.heading, body: s.body.join('\n').trim() }));
}

function parseCriteria(criteriaBody) {
  return criteriaBody
    .split('\n')
    .map((l) => l.match(/^-\s*(.+?)\s*—\s*(control|influence)\s*$/i))
    .filter(Boolean)
    .map((m) => ({ text: m[1].trim(), kind: m[2].toLowerCase() }));
}

// Log entries are top-level (column 0) `- ` bullets that can wrap across
// several physical lines, including further indented `- ` sub-bullets —
// continuation lines have either no leading `-` or a leading `-` that's
// indented relative to column 0. Groups the raw lines back into whole
// entries before scanning, so a wrapped entry's Focus: isn't missed and
// a continuation fragment (top-level or nested) is never mistaken for
// the most recent entry.
function parseLogEntries(logBody) {
  const lines = logBody.split('\n');
  const entries = [];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const isTopLevel = /^-\s+/.test(raw);
    if (isTopLevel) entries.push(raw.replace(/^-\s+/, ''));
    else if (entries.length) entries[entries.length - 1] += ` ${raw.trim()}`;
  }
  return entries;
}

// The most recent log entry that names a Schwerpunkt/focus — `strategy`
// writes `Focus: [...]` inline in its log entry (it owns no dedicated
// section), so this is the only way the visual layer can surface current
// focus at all.
function extractFocus(entries) {
  // Requires "Focus:" as its own field — preceded by an em-dash separator
  // or at the very start of the entry — so prose that merely mentions the
  // word ("no Focus: set yet") isn't mistaken for the field.
  for (let i = entries.length - 1; i >= 0; i--) {
    const match = entries[i].match(/(?:^|—)\s*Focus:\s*(.+?)(?:\s*—\s*(?:Instead of|Why)[:.]|$)/i);
    if (match) return match[1].trim();
  }
  return null;
}

export function parseGoalMd(rawBody) {
  const titleMatch = rawBody.match(/^#\s*Goal\s*\n+([^\n]+(?:\n(?!##)[^\n]*)*)/m);
  const title = titleMatch ? titleMatch[1].trim() : '(untitled goal)';

  const sections = splitSections(rawBody);
  const byHeading = new Map(sections.map((s) => [s.heading, s.body]));

  const criteria = byHeading.has('Success criteria')
    ? parseCriteria(byHeading.get('Success criteria'))
    : [];

  const deadlineRaw = byHeading.get('Deadline')?.trim() ?? null;
  const deadline = deadlineRaw && !/^none$/i.test(deadlineRaw) ? deadlineRaw : null;

  const excluded = new Set(['Success criteria', 'Deadline', 'Log']);
  const bodySections = sections.filter((s) => !excluded.has(s.heading) && s.body.length > 0);

  const logEntries = parseLogEntries(byHeading.get('Log') ?? '');
  const lastLogFull = logEntries.length ? logEntries[logEntries.length - 1] : null;
  const lastLogLine = lastLogFull ? shorten(lastLogFull, 120) : null;
  const focus = extractFocus(logEntries);

  return { title, shortTitle: shorten(title), criteria, deadline, sections: bodySections, lastLogLine, lastLogFull, focus };
}

// A goal's `# Goal` body is often a full multi-sentence description — fine
// as the source of truth, too long for a browser tab title or page
// heading. Prefers the first sentence; falls back to a word-boundary cut.
function shorten(title, max = 80) {
  const firstSentence = title.match(/^(.+?[.!?])(\s|$)/)?.[1];
  if (firstSentence && firstSentence.length <= max) return firstSentence;
  const flat = title.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}
