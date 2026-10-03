import { describe, it, expect } from 'vitest';
import { coalesce, pendingEditsText, type PageEdit } from '../src/lib/edits';

const P = 'plan.linesOfOperation.0.nextActions.1';

describe('coalesce', () => {
  it('keeps the first before and the latest after for one line', () => {
    let q: PageEdit[] = [];
    q = coalesce(q, { path: P, kind: 'text', before: 'a', after: 'b' });
    q = coalesce(q, { path: P, kind: 'text', before: 'b', after: 'c' });
    expect(q).toEqual([{ path: P, kind: 'text', before: 'a', after: 'c' }]);
  });

  it('drops an edit put back by hand', () => {
    let q: PageEdit[] = [];
    q = coalesce(q, { path: P, kind: 'text', before: 'a', after: 'b' });
    q = coalesce(q, { path: P, kind: 'text', before: 'b', after: 'a' });
    expect(q).toEqual([]);
  });

  it('folds a reworded new move into its "added" entry', () => {
    let q: PageEdit[] = [];
    q = coalesce(q, { path: P, kind: 'added', after: 'book van' });
    q = coalesce(q, { path: P, kind: 'text', before: 'book van', after: 'book the van' });
    expect(q).toEqual([{ path: P, kind: 'added', after: 'book the van' }]);
  });

  it('keeps a status flip apart from a text edit on the same line', () => {
    let q: PageEdit[] = [];
    q = coalesce(q, { path: P, kind: 'text', before: 'a', after: 'b' });
    q = coalesce(q, { path: P, kind: 'status', label: 'b', before: 'pending', after: 'done' });
    expect(q).toHaveLength(2);
    q = coalesce(q, { path: P, kind: 'status', label: 'b', before: 'done', after: 'pending' });
    expect(q).toHaveLength(1);
  });
});

describe('pendingEditsText', () => {
  it('is empty with nothing queued', () => {
    expect(pendingEditsText([])).toBe('');
    expect(pendingEditsText(undefined)).toBe('');
  });

  it('names each edit for the model', () => {
    const text = pendingEditsText([
      { path: P, kind: 'text', before: 'a', after: 'b' },
      { path: P, kind: 'status', label: 'b', before: 'pending', after: 'done' },
      { path: 'plan.linesOfOperation.0.nextActions.2', kind: 'added', after: 'book the van' },
    ]);
    expect(text).toMatch(/user edited the page directly/);
    expect(text).toContain(`reworded ${P}: "a" → "b"`);
    expect(text).toContain(`marked ${P} ("b") done (was pending)`);
    expect(text).toContain('added plan.linesOfOperation.0.nextActions.2: "book the van"');
  });
});
