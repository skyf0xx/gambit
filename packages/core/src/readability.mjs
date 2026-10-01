// Plain-language rule for goal writes: prose fields must read at or below
// a Flesch-Kincaid grade of READING_GRADE_MAX. Checked on the write path
// only (writeSection / appendLog), never on read, so a goal saved before
// the rule still loads and picks it up on its owner's next write.
//
// Flesch-Kincaid is noise on a few words — one long word in a 4-word label
// scores grade 20+ — so only strings of READING_MIN_WORDS or more are
// scored. Names and acronyms (a capital letter past a sentence's first
// word) are left out of the count: "Mediterranean Shipping" is a name the
// writer can't simplify, not a hard word.

import { z } from 'zod';
import { syllable } from 'syllable';
import { fleschKincaid } from 'flesch-kincaid';

export const READING_GRADE_MAX = 7;
export const READING_MIN_WORDS = 12;

const segment = (text, granularity) => [...new Intl.Segmenter('en', { granularity }).segment(text)];

/** Flesch-Kincaid grade, or null when there are too few scorable words. */
export function readingGrade(text) {
  let sentences = 0;
  let words = 0;
  let syllables = 0;
  for (const { segment: s } of segment(text, 'sentence')) {
    const tokens = segment(s, 'word').filter((t) => t.isWordLike).map((t) => t.segment);
    if (tokens.length === 0) continue;
    sentences++;
    tokens.forEach((w, i) => {
      if (i > 0 && /[A-Z]/.test(w)) return;
      words++;
      syllables += syllable(w);
    });
  }
  if (words < READING_MIN_WORDS) return null;
  return fleschKincaid({ sentence: sentences, word: words, syllable: syllables });
}

function walk(value, path, ctx) {
  if (typeof value === 'string') {
    const grade = readingGrade(value);
    if (grade !== null && grade > READING_GRADE_MAX) {
      ctx.addIssue({
        code: 'custom',
        path,
        message: `reads at grade ${grade.toFixed(1)}; keep it at grade ${READING_GRADE_MAX} or below: shorter sentences, plainer words`,
      });
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, [...path, i], ctx));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, [...path, k], ctx);
  }
}

/** Write-only Zod rule: every long-enough string in the value reads plainly. */
export const plainLanguage = z.unknown().superRefine((value, ctx) => walk(value, [], ctx));
