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
//
// French text (textLang, lang.mjs) is scored by Kandel & Moles' reading
// ease instead, Flesch's formula refitted to French: higher reads easier,
// and READING_EASE_MIN_FR stands where grade 7 does in English.

import { z } from 'zod';
import { syllable } from 'syllable';
import { fleschKincaid } from 'flesch-kincaid';
import { textLang, unElide } from './lang.mjs';

export const READING_GRADE_MAX = 7;
export const READING_MIN_WORDS = 12;
export const READING_EASE_MIN_FR = 60;

const segment = (text, granularity, lang = 'en') => [...new Intl.Segmenter(lang, { granularity }).segment(text)];

/**
 * French syllables: each run of vowels is one, less a silent final "e" or
 * "es" after a consonant ("table", "faites"). Regular enough in French that
 * no dictionary is needed.
 */
export function syllableFr(word) {
  const w = unElide(word.toLowerCase()).replace(/[^\p{L}]/gu, '');
  const groups = w.match(/[aeiouyàâäéèêëîïôöùûüœæ]+/g)?.length ?? 0;
  const silent = groups > 1 && /[^aeiouyàâäéèêëîïôöùûüœæ]es?$/.test(w) ? 1 : 0;
  return Math.max(1, groups - silent);
}

/** Sentences, scorable words and their syllables. Names and acronyms (a
 * capital past a sentence's first word) are left out. */
function counts(text, lang) {
  let sentences = 0;
  let words = 0;
  let syllables = 0;
  for (const { segment: s } of segment(text, 'sentence', lang)) {
    const tokens = segment(s, 'word', lang).filter((t) => t.isWordLike).map((t) => t.segment);
    if (tokens.length === 0) continue;
    sentences++;
    tokens.forEach((w, i) => {
      if (i > 0 && /\p{Lu}/u.test(w)) return;
      words++;
      syllables += lang === 'fr' ? syllableFr(w) : syllable(w);
    });
  }
  return { sentences, words, syllables };
}

/** Flesch-Kincaid grade, or null when there are too few scorable words. */
export function readingGrade(text) {
  const { sentences, words, syllables } = counts(text, 'en');
  if (words < READING_MIN_WORDS) return null;
  return fleschKincaid({ sentence: sentences, word: words, syllable: syllables });
}

/** Kandel & Moles reading ease for French, or null when there are too few
 * scorable words. 100 is very easy; below 50 is hard. */
export function readingEaseFr(text) {
  const { sentences, words, syllables } = counts(text, 'fr');
  if (words < READING_MIN_WORDS) return null;
  return 207 - 1.015 * (words / sentences) - 73.6 * (syllables / words);
}

/** Why a string reads too hard for the page, or null when it reads plainly. */
export function readingIssue(text) {
  if (textLang(text) === 'fr') {
    const ease = readingEaseFr(text);
    return ease !== null && ease < READING_EASE_MIN_FR
      ? `reads at ease ${ease.toFixed(0)} (Kandel-Moles, French); keep it at ${READING_EASE_MIN_FR} or above: shorter sentences, plainer words`
      : null;
  }
  const grade = readingGrade(text);
  return grade !== null && grade > READING_GRADE_MAX
    ? `reads at grade ${grade.toFixed(1)}; keep it at grade ${READING_GRADE_MAX} or below: shorter sentences, plainer words`
    : null;
}

function walk(value, path, ctx) {
  if (typeof value === 'string') {
    const message = readingIssue(value);
    if (message) ctx.addIssue({ code: 'custom', path, message });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, [...path, i], ctx));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, [...path, k], ctx);
  }
}

/** Write-only Zod rule: every long-enough string in the value reads plainly. */
export const plainLanguage = z.unknown().superRefine((value, ctx) => walk(value, [], ctx));
