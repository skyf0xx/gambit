// Goal text is written in the language the user writes in, which may not be
// the page's: English or French today. The write rules read the text itself
// rather than a setting, so a goal begun in one language and carried on in
// another is checked line by line in its own words.
//
// Most rules hold their English and French wording side by side and apply
// both, since a French phrase like "quand même" never turns up in English
// text. Only the numbers differ by language — the reading-ease formula and
// the word caps — and those go by textLang.

/** Short words that mark a language, for telling English from French. */
const MARKERS = {
  en: new Set('the a an and or of to in on at by for with is are was be it this that not no if then from has have will would'.split(' ')),
  fr: new Set('le la les un une des du de et ou au aux à dans sur par pour avec est sont était être ce cette ces ne pas si alors que qui il elle ils nous vous ont sera'.split(' ')),
};

const tokens = (s) => s.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

/**
 * "fr" when a line reads as French, else "en". Counts each language's
 * short words, with accents worth half a word once it has a French one,
 * and needs a clear lead: a French name in an English line ("Open a
 * café") stays English. A line with no clue is English, the rules'
 * original wording.
 * @param {string} s
 * @returns {'en' | 'fr'}
 */
export function textLang(s) {
  let en = 0;
  let fr = 0;
  for (const w of tokens(String(s ?? ''))) {
    if (MARKERS.en.has(w)) en++;
    if (MARKERS.fr.has(w)) fr++;
  }
  if (fr && (/[àâçéèêëîïôûùüÿœæ]/i.test(s) || /\b[ldjnscm]['’]\p{L}/iu.test(s))) fr += 0.5;
  // Half a word's lead isn't enough: "the Café de Paris" stays English.
  return fr > en + 0.5 ? 'fr' : 'en';
}

/** Word caps per language: French runs about a fifth longer than English. */
export const GOAL_MAX_WORDS_BY_LANG = { en: 10, fr: 12 };
export const BRANCH_MAX_WORDS_BY_LANG = { en: 8, fr: 10 };

export const goalMaxWords = (text) => GOAL_MAX_WORDS_BY_LANG[textLang(text)];
export const branchMaxWords = (text) => BRANCH_MAX_WORDS_BY_LANG[textLang(text)];

/** Common French words left out when comparing two lines' content. */
export const FR_STOPWORDS = 'le la les un une des du de et ou mais au aux en dans sur sous par pour avec sans chez entre vers est sont était étaient être été avoir ont avait ce cet cette ces ça cela ne pas plus si alors que qui quoi dont où il elle ils elles on nous vous leur leurs lui son sa ses mon ma mes ton ta tes notre nos votre vos très aussi encore déjà toujours puis donc comme quand tout tous toute toutes'.split(' ');

/** "l'équipe" → "équipe": a French elision is part of the next word. */
export const unElide = (w) => w.replace(/^(?:[ldjnmtsc]|qu|jusqu|lorsqu|puisqu)['’]/i, '');
