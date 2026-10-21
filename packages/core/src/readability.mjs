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
// Text in another language (textLang, lang.mjs) is scored by a reading-ease
// formula fitted to that language instead (EASE): higher reads easier, and
// each one's min stands where grade 7 does in English.

import { z } from 'zod';
import { syllable } from 'syllable';
import { fleschKincaid } from 'flesch-kincaid';
import { textLang, unElide } from './lang.mjs';

export const READING_GRADE_MAX = 7;
export const READING_MIN_WORDS = 12;

const segment = (text, granularity, lang = 'en') => [...new Intl.Segmenter(lang, { granularity }).segment(text)];

const VOWEL = 'aeiouyàâäéèêëîïôöùûüœæáíóúãõìò';
const VOWELS = new RegExp(`[${VOWEL}]+`, 'g');

/**
 * French syllables: each run of vowels is one, less a silent final "e" or
 * "es" after a consonant ("table", "faites"). Regular enough in French that
 * no dictionary is needed.
 */
export function syllableFr(word) {
  const w = unElide(word.toLowerCase()).replace(/[^\p{L}]/gu, '');
  const groups = w.match(VOWELS)?.length ?? 0;
  const silent = groups > 1 && new RegExp(`[^${VOWEL}]es?$`).test(w) ? 1 : 0;
  return Math.max(1, groups - silent);
}

/**
 * Italian, Spanish and Portuguese syllables: each run of vowels is one,
 * split where two strong vowels meet ("le-o", "cre-er") or an accented i or
 * u stands beside another vowel ("dí-a", "sa-ú-de"), which is a hiatus.
 * Portuguese nasal pairs ("ção", "mãe") stay one.
 */
export function syllableRomance(word) {
  const w = unElide(word.toLowerCase()).replace(/[^\p{L}]/gu, '');
  let count = 0;
  for (const run of w.match(VOWELS) ?? []) {
    count++;
    for (let i = 1; i < run.length; i++) {
      const strong = (c) => /[aeoáéóàèòâêô]/.test(c);
      if ((strong(run[i - 1]) && strong(run[i])) || /[íúì]/.test(run[i - 1] + run[i])) count++;
    }
  }
  return Math.max(1, count);
}

/** Sentences, scorable words, their syllables and letters. Names and
 * acronyms (a capital past a sentence's first word) are left out. */
function counts(text, lang) {
  let sentences = 0;
  let words = 0;
  let syllables = 0;
  let letters = 0;
  for (const { segment: s } of segment(text, 'sentence', lang)) {
    const tokens = segment(s, 'word', lang).filter((t) => t.isWordLike).map((t) => t.segment);
    if (tokens.length === 0) continue;
    sentences++;
    tokens.forEach((w, i) => {
      if (i > 0 && /\p{Lu}/u.test(w)) return;
      words++;
      letters += w.replace(/[^\p{L}]/gu, '').length;
      syllables += lang === 'en' ? syllable(w) : lang === 'fr' ? syllableFr(w) : syllableRomance(w);
    });
  }
  return { sentences, words, syllables, letters };
}

/** Flesch-Kincaid grade, or null when there are too few scorable words. */
export function readingGrade(text) {
  const { sentences, words, syllables } = counts(text, 'en');
  if (words < READING_MIN_WORDS) return null;
  return fleschKincaid({ sentence: sentences, word: words, syllable: syllables });
}

/**
 * Reading ease per language: the formula's name, the score a line needs,
 * and the formula from sentence, word, syllable and letter counts.
 *   fr  Kandel & Moles (1958), Flesch refitted to French
 *   it  Gulpease (1988), letters per word rather than syllables
 *   es  Fernández Huerta (1959), Flesch refitted to Spanish
 *   pt  Flesch as adapted by Martins et al. (1996) for Brazilian Portuguese
 */
export const EASE = {
  fr: { name: 'Kandel-Moles', min: 60, score: ({ sentences, words, syllables }) => 207 - 1.015 * (words / sentences) - 73.6 * (syllables / words) },
  it: { name: 'Gulpease', min: 50, score: ({ sentences, words, letters }) => 89 + (300 * sentences - 10 * letters) / words },
  es: { name: 'Fernández-Huerta', min: 55, score: ({ sentences, words, syllables }) => 206.84 - 60 * (syllables / words) - 1.02 * (words / sentences) },
  pt: { name: 'Flesch-Martins', min: 45, score: ({ sentences, words, syllables }) => 248.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words) },
};
export const READING_EASE_MIN_FR = EASE.fr.min;

/** Reading ease in a language EASE knows, or null when there are too few
 * scorable words. Higher reads easier. */
export function readingEase(text, lang) {
  const c = counts(text, lang);
  return c.words < READING_MIN_WORDS ? null : EASE[lang].score(c);
}

export const readingEaseFr = (text) => readingEase(text, 'fr');

/** Why a string reads too hard for the page, or null when it reads plainly. */
export function readingIssue(text) {
  const lang = textLang(text);
  if (lang !== 'en') {
    const ease = readingEase(text, lang);
    const { name, min } = EASE[lang];
    return ease !== null && ease < min
      ? `reads at ease ${ease.toFixed(0)} (${name}, ${lang}); keep it at ${min} or above: shorter sentences, plainer words`
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
