import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stubGoal, writeSection, sameLine, textLang, goalMaxWords, readingIssue, readingEaseFr, syllableFr, READING_EASE_MIN_FR, isSelfName } from '../src/index.mjs';

const fork = (action, event) => ({
  linesOfOperation: [{
    label: 'Mairie', focus: true, criticalPath: [],
    nextActions: [{ action: 'écrire à la mairie', who: 'moi' }, { action, who: 'moi', if: { event } }],
  }],
});
const errorsFor = (plan) => {
  const r = writeSection(stubGoal('g'), 'plan', plan);
  return r.ok ? [] : r.errors.map((e) => e.message);
};

test('textLang tells French from English by its short words', () => {
  assert.equal(textLang('Appeler la mairie pour fixer une date avec le maire'), 'fr');
  assert.equal(textLang("Écrire à l'équipe"), 'fr');
  assert.equal(textLang('Call the council to set a date with the mayor'), 'en');
  assert.equal(textLang('Ship v2'), 'en');
});

test('a French goal gets 12 words, an English one 10', () => {
  assert.equal(goalMaxWords('Ouvrir une deuxième boutique près du chantier avant la fin'), 12);
  assert.equal(goalMaxWords('Open a second shop near the building site'), 10);
  const fr = 'Ouvrir une deuxième boutique près du chantier avant la fin du mois';
  assert.equal(writeSection(stubGoal('g'), 'goal', fr).ok, true);
  const long = 'Ouvrir une deuxième boutique près du grand chantier de la gare avant la fin du mois';
  assert.match(writeSection(stubGoal('g'), 'goal', long).errors[0].message, /12 words or fewer/);
});

test('French reading ease passes plain French and refuses dense French', () => {
  const plain = 'Si la mairie ne répond pas, on écrit au préfet avec une copie au journal.';
  const dense = 'La mise en œuvre opérationnelle nécessite une coordination interinstitutionnelle préalable approfondie et formalisée.';
  assert.ok(readingEaseFr(plain) >= READING_EASE_MIN_FR);
  assert.equal(readingIssue(plain), null);
  assert.match(readingIssue(dense), /Kandel-Moles/);
  assert.equal(syllableFr('table'), 1);
  assert.equal(syllableFr('éléphant'), 3);
  assert.equal(syllableFr("l'équipe"), 2);
});

test('a French fork that carries on anyway forks nothing', () => {
  assert.ok(errorsFor(fork('relancer quand même la mairie', 'pas de réponse')).some((m) => /forks nothing/.test(m)));
  assert.ok(errorsFor(fork('continuer à relancer', 'pas de réponse')).some((m) => /forks nothing/.test(m)));
});

test('a French fork drops its leading "si" and never restates its condition', () => {
  assert.ok(errorsFor(fork('appeler le préfet', 'si la mairie refuse')).some((m) => /leading "si"/.test(m)));
  assert.ok(errorsFor(fork("appeler le préfet d'ici là", 'la mairie refuse')).some((m) => /restates the condition/.test(m)));
  assert.ok(errorsFor(fork('appeler le préfet', "rien d'ici là")).some((m) => /points at nothing/.test(m)));
  assert.deepEqual(errorsFor(fork('appeler le préfet', 'la mairie refuse le projet')), []);
});

test('two French forks waiting on something not happening ask one question', () => {
  const plan = fork('appeler le préfet', "pas d'offre avant décembre");
  plan.linesOfOperation[0].nextActions.push({ action: 'chercher un autre local', who: 'moi', if: { event: "le maire n'a pas fixé de date" } });
  assert.ok(errorsFor(plan).some((m) => /asks the same question/.test(m)));
});

test('sameLine reads French content words, past elisions and accents', () => {
  assert.equal(sameLine("Plainte envoyée à la mairie, copie à l'équipe du préfet", "Plainte déposée à la mairie, copie à l'équipe du préfet"), true);
  assert.equal(sameLine('Plainte envoyée à la mairie', 'Boutique ouverte près du chantier'), false);
});

test('a French message never goes to the user', () => {
  assert.equal(isSelfName('moi'), true);
  assert.equal(isSelfName("l'utilisateur"), true);
  assert.equal(isSelfName('Marie'), false);
});

test('an English line with a French-looking word stays English', () => {
  assert.equal(textLang('Open a café'), 'en');
  assert.equal(textLang('Win the Café de Paris contract'), 'en');
  assert.equal(textLang('Reply to Zoë, plus Rémi'), 'en');
});
