// Goal text is written in the language the user writes in, which may not be
// the page's: English, French, Italian, Spanish or Portuguese. The write
// rules read the text itself rather than a setting, so a goal begun in one
// language and carried on in another is checked line by line in its own
// words.
//
// Most rules hold every language's wording side by side and apply all of
// it (WORDING), since a phrase like "quand même" or "de todos modos" never
// turns up in English text. Only the numbers differ by language — the
// reading-ease formula (readability.mjs) and the word caps — and those go
// by textLang.

/** Languages the write rules know, English first. */
export const TEXT_LANGS = ['en', 'fr', 'it', 'es', 'pt'];

/** Short words that mark a language, for telling them apart. */
const MARKERS = {
  en: 'the a an and or of to in on at by for with is are was be it this that not no if then from has have will would',
  fr: 'le la les un une des du de et ou au aux à dans sur par pour avec est sont était être ce cette ces ne pas si alors que qui il elle ils nous vous ont sera',
  it: 'il lo la gli le un una di del della dei delle che e è per con non sono come se al alla nel nella ma più anche ha hanno',
  es: 'el la los las un una de del que y es en por para con no se lo al su sus más pero está son hay ha han muy',
  pt: 'o a os as um uma de do da dos das que e é em no na por para com não se ao mais mas está são há tem foi',
};
const MARKER_SETS = Object.fromEntries(Object.entries(MARKERS).map(([l, w]) => [l, new Set(w.split(' '))]));

/** Letters (and elisions) only one or two of these languages use: half a word's weight. */
const LETTERS = {
  fr: /[œæêâîûëïç]|\b[ldjnscm]['’]\p{L}/iu,
  it: /[ìò]|\b(?:dell|all|dall|nell|sull|un|quest)['’]\p{L}/iu,
  es: /[ñ¿¡]/i,
  pt: /[ãõç]/i,
};

const tokens = (s) => s.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

/**
 * The language a line reads as. Counts each language's short words, with
 * its own letters worth half a word once it has one of its words. A
 * language other than English needs a clear lead over English, so a
 * French name in an English line ("Open a café") stays English, and a
 * line with no clue is English, the rules' original wording.
 * @param {string} s
 * @returns {'en' | 'fr' | 'it' | 'es' | 'pt'}
 */
export function textLang(s) {
  const text = String(s ?? '');
  const score = Object.fromEntries(TEXT_LANGS.map((l) => [l, 0]));
  for (const w of tokens(text)) for (const l of TEXT_LANGS) if (MARKER_SETS[l].has(w)) score[l]++;
  for (const [l, re] of Object.entries(LETTERS)) if (score[l] && re.test(text)) score[l] += 0.5;
  let best = 'en';
  let top = score.en + 0.5;
  for (const l of TEXT_LANGS.slice(1)) if (score[l] > top) { best = l; top = score[l]; }
  return /** @type {'en' | 'fr' | 'it' | 'es' | 'pt'} */ (best);
}

/** Word caps per language: the Romance languages run about a fifth longer than English. */
export const GOAL_MAX_WORDS_BY_LANG = { en: 10, fr: 12, it: 12, es: 12, pt: 12 };
export const BRANCH_MAX_WORDS_BY_LANG = { en: 8, fr: 10, it: 10, es: 10, pt: 10 };

export const goalMaxWords = (text) => GOAL_MAX_WORDS_BY_LANG[textLang(text)];
export const branchMaxWords = (text) => BRANCH_MAX_WORDS_BY_LANG[textLang(text)];

/** Common words left out when comparing two lines' content, past English's own. */
export const STOPWORDS_BY_LANG = {
  fr: 'le la les un une des du de et ou mais au aux en dans sur sous par pour avec sans chez entre vers est sont était étaient être été avoir ont avait ce cet cette ces ça cela ne pas plus si alors que qui quoi dont où il elle ils elles on nous vous leur leurs lui son sa ses mon ma mes ton ta tes notre nos votre vos très aussi encore déjà toujours puis donc comme quand tout tous toute toutes',
  it: 'il lo la gli le un una uno di del dello della dei degli delle da dal dalla in nel nella su sul sulla per con tra fra che chi cui non più anche ancora già sempre poi quindi quando perché sono era erano essere stato hanno avere suo sua suoi sue loro mio mia tuo tua nostro vostro questo questa quello quella tutto tutti molto ma però',
  es: 'el la los las un una unos unas de del al en por para con sin sobre entre hasta desde que quien cual cuando donde como pero más muy también ya aún todavía siempre luego entonces es son era eran ser estar está están fue han hay tiene tienen su sus mi mis tu tus nuestro nuestra este esta estos estas ese esa eso todo todos',
  pt: 'o a os as um uma uns umas de do da dos das em no na nos nas por pelo pela para com sem sobre entre até desde que quem qual quando onde como mas mais muito também já ainda sempre depois então é são era eram ser estar está estão foi tem têm há seu sua seus suas meu minha teu tua nosso nossa este esta isto esse essa isso todo todos',
};

/** "l'équipe" → "équipe", "dell'ufficio" → "ufficio": an elision is part of the next word. */
export const unElide = (w) => w.replace(/^(?:[ldjnmtsc]|qu|jusqu|lorsqu|puisqu|dell|all|dall|nell|sull|un|quest)['’]/i, '');

// A phrase in any of these languages, not part of a longer word. JavaScript's
// \b only knows ASCII letters, so accented words need these lookarounds.
const phrase = (alts) => new RegExp(`(?<!\\p{L})(${alts.join('|')})(?!\\p{L})`, 'iu');

/**
 * The wording the write rules look for, in every language at once.
 *   ifLead:    a fork's event starting with "if", which the page adds
 *   noFork:    a conditional move saying the plan carries on anyway
 *   restated:  a move restating its condition ("by then", "unless")
 *   vagueWhen: an event's "by then", which points at nothing on the page
 *   absence:   an event that is something not happening
 *   self:      a name that means the user
 */
export const WORDING = {
  ifLead: /^(if|si|s['’]ils?|se)(?!\p{L})/iu,
  noFork: phrase([
    'anyway', 'anyhow', 'regardless', 'still', 'carry on', 'keep (going|chasing|pushing|at it)', 'continue', 'as planned', 'no change',
    'quand même', 'de toute (façon|manière)', 'malgré tout', 'toujours', 'continu(er|ons|ez)', 'poursuivre', 'comme prévu', 'sans changement', 'garder le cap',
    'comunque', 'in ogni caso', 'lo stesso', 'continuare', 'come previsto', 'senza cambiamenti', 'andare avanti',
    'de todos modos', 'de todas formas', 'igualmente', 'aun así', 'seguir insistiendo', 'continuar', 'como estaba previsto', 'sin cambios',
    'de qualquer (forma|jeito|maneira)', 'mesmo assim', 'seguir insistindo', 'como previsto', 'sem mudanças',
  ]),
  restated: phrase([
    'by then', 'unless', 'otherwise', 'if (nothing|no|not|none)',
    'd[\'’]ici là', 'sinon', 'à moins que', 'à défaut', 'si (rien|personne|pas|aucune?)',
    'per allora', 'a meno che', 'altrimenti', 'se (niente|nessuno|non)',
    'para entonces', 'a menos que', 'de lo contrario', 'si (no|nada|nadie)',
    'até lá', 'senão', 'caso contrário', 'se (nada|ninguém|não)',
  ]),
  vagueWhen: phrase([
    'by (then|that point|that time|that date|that stage)',
    'd[\'’]ici (là|ce moment-là|cette date|cette étape)',
    'entro (allora|quel momento|quella data)',
    'para (entonces|ese momento|esa fecha)',
    'até (então|esse momento|essa data)',
  ]),
  absence: new RegExp([
    '^(no|nothing|not|none|hasn[\'’]t|haven[\'’]t|isn[\'’]t|aren[\'’]t|didn[\'’]t|doesn[\'’]t)(?!\\p{L})',
    '^(pas\\s+d|aucune?|rien|toujours pas|nessun[oa]?|niente|nulla|ningun[oa]|ningún|nada|nadie|nenhuma?|ninguém)(?!\\p{L})',
    '(?<!\\p{L})(ne\\s+|n[\'’])\\p{L}+\\s+(toujours\\s+|encore\\s+)?(pas|rien|personne|aucune?)(?!\\p{L})',
    '(?<!\\p{L})(non|não)\\s+\\p{L}+',
    '(?<!\\p{L})no\\s+(ha|han|hay|había|tiene|tienen|está|están)(?!\\p{L})',
  ].join('|'), 'iu'),
  self: /^(me|you|i|myself|yourself|self|user|the user|moi|toi|vous|je|moi-même|l['’]utilisateur|utilisateur|io|tu|te|l['’]utente|utente|yo|mí|tú|usted|el usuario|usuario|eu|mim|você|o usuário|usuário)$/i,
};
