import { describe, it, expect } from 'vitest';
import { stubGoal } from '@gambit/core';
import { goalToIcs, goalDates, foldLine, escapeText, calendarFileName } from '../src/lib/calendar';
import type { Goal } from '../src/lib/types';

const goal = (): Goal => ({
  ...(stubGoal('Open the bakery, with, commas; and more') as Goal),
  deadline: '2026-12-01',
  plan: {
    linesOfOperation: [{
      label: 'A',
      criticalPath: [],
      nextActions: [
        { action: 'Sign lease', who: 'me', when: '2026-10-09', status: 'pending' },
        { action: 'Proposed one', who: 'me', when: '2026-10-10', status: 'proposed' },
        { action: 'Done one', who: 'me', when: '2026-10-11', status: 'done' },
        { action: 'No date', who: 'me', status: 'pending' },
      ],
    }],
  },
  forecasts: [
    { statement: 'Landlord says yes', probability: 70, resolvesBy: '2026-10-20', resolvesVia: 'email', resolved: false },
    { statement: 'Old call', probability: 50, resolvesBy: '2026-09-01', resolvesVia: 'x', resolved: true, outcome: 'yes' },
  ],
  experiments: [
    { assumption: 'People want rye', test: 't', passIf: 'p', by: '2026-10-25', done: false },
    { assumption: 'Finished', test: 't', passIf: 'p', by: '2026-10-26', done: true },
  ],
  decisions: [
    { date: '2026-09-01', status: 'decided', choice: 'Rent', because: 'b', reverseIf: 'r', reviewBy: '2026-11-01' },
    { date: '2026-09-01', status: 'open', question: 'Hire?', reviewBy: '2026-11-02' },
  ],
  intel: [
    { question: 'Is the oven rated?', via: 'ask the seller', by: '2026-10-12', status: 'open' },
    { question: 'Answered', via: 'v', by: '2026-10-13', status: 'answered', answer: 'yes' },
  ],
  prep: [
    { with: 'Priya', on: '2026-10-15', ask: 'a', batna: 'b', walkAway: 'w', concessions: [], done: false },
    { with: 'Done', on: '2026-10-16', ask: 'a', batna: 'b', walkAway: 'w', concessions: [], done: true },
  ],
} as Goal);

describe('goalDates', () => {
  it('lists only open, dated items, soonest first', () => {
    const d = goalDates(goal());
    expect(d.map((x) => x.path)).toEqual([
      'plan.linesOfOperation.0.nextActions.0',
      'intel.0',
      'prep.0',
      'forecasts.0',
      'experiments.0',
      'decisions.0',
      'deadline',
    ]);
    expect(d.some((x) => /Proposed|Done|Old call|Finished|Answered|Hire/.test(x.summary))).toBe(false);
  });
  it('is empty for a goal with no dates', () => {
    expect(goalDates(stubGoal('x') as Goal)).toEqual([]);
  });
});

describe('goalToIcs', () => {
  const ics = goalToIcs(goal(), 'bakery-ab12', new Date('2026-10-03T08:09:10Z'));
  const lines = ics.split('\r\n');

  it('is a CRLF-terminated VCALENDAR with one VEVENT per date', () => {
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines[lines.length - 2]).toBe('END:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(7);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(7);
  });
  it('writes all-day dates, with the end the next day', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20261201');
    expect(ics).toContain('DTEND;VALUE=DATE:20261202');
    expect(ics).toContain('DTSTAMP:20261003T080910Z');
  });
  it('uses stable UIDs from the goal id and path', () => {
    expect(ics).toContain('UID:bakery-ab12-plan.linesOfOperation.0.nextActions.0@gambit');
    expect(goalToIcs(goal(), 'bakery-ab12', new Date('2030-01-01'))).toContain('UID:bakery-ab12-deadline@gambit');
  });
  it('escapes text', () => {
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('SUMMARY:Deadline: Open the bakery\\, with\\, commas\\; and more');
  });
  it('folds no line past 75 octets', () => {
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});

describe('helpers', () => {
  it('folds on character boundaries', () => {
    const parts = foldLine(`SUMMARY:${'é'.repeat(80)}`);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(`SUMMARY:${'é'.repeat(80)}`);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
  });
  it('escapes backslash, semicolon, comma and newline', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
  it('names the file from the goal sentence', () => {
    expect(calendarFileName({ goal: 'Open the bakery!' } as Goal)).toBe('open-the-bakery.ics');
  });
});
