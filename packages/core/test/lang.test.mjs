import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stubGoal, writeSection, sameLine, textLang, goalMaxWords, readingIssue, readingEaseFr, syllableFr, syllableRomance, READING_EASE_MIN_FR, isSelfName } from '../src/index.mjs';

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

test('textLang tells Italian, Spanish and Portuguese apart', () => {
  assert.equal(textLang('Scrivere al comune per fissare una data con il sindaco'), 'it');
  assert.equal(textLang('Escribir al ayuntamiento para fijar una fecha con el alcalde'), 'es');
  assert.equal(textLang('Escrever para a prefeitura para marcar uma data com o prefeito'), 'pt');
});

test('Italian, Spanish and Portuguese goals get 12 words', () => {
  for (const goal of [
    'Aprire un secondo negozio vicino al cantiere prima della fine del mese',
    'Abrir una segunda tienda cerca de la obra antes del verano',
    'Abrir uma segunda loja perto da obra antes do fim do mês',
  ]) assert.equal(writeSection(stubGoal('g'), 'goal', goal).ok, true, goal);
});

test('each language scores its own reading ease: plain passes, dense fails', () => {
  const cases = {
    it: ['Se il comune non risponde, scriviamo al prefetto con una copia al giornale locale.', "L'implementazione operativa necessita di un coordinamento interistituzionale preliminare approfondito e formalizzato dalle amministrazioni competenti."],
    es: ['Si el ayuntamiento no responde, escribimos al alcalde con una copia al periódico local.', 'La implementación operativa requiere una coordinación interinstitucional preliminar exhaustiva y debidamente formalizada por las administraciones competentes.'],
    pt: ['Se a prefeitura não responder, escrevemos ao prefeito com uma cópia para o jornal local.', 'A implementação operacional requer uma coordenação interinstitucional preliminar exaustiva e devidamente formalizada pelas administrações competentes.'],
  };
  for (const [lang, [plain, dense]] of Object.entries(cases)) {
    assert.equal(readingIssue(plain), null, plain);
    assert.match(readingIssue(dense), new RegExp(`, ${lang}\\)`), dense);
  }
  assert.equal(syllableRomance('día'), 2);
  assert.equal(syllableRomance('coordinação'), 5);
});

test('a fork that carries on anyway, or restates its condition, is refused in every language', () => {
  for (const action of ['scrivere comunque al comune', 'escribir de todos modos al alcalde', 'escrever mesmo assim ao prefeito']) {
    assert.ok(errorsFor(fork(action, 'nessuna risposta')).some((m) => /forks nothing/.test(m)), action);
  }
  for (const action of ['chiamare il prefetto altrimenti', 'llamar al alcalde para entonces', 'ligar ao prefeito até lá']) {
    assert.ok(errorsFor(fork(action, 'il comune rifiuta')).some((m) => /restates the condition/.test(m)), action);
  }
  for (const lead of ['se il comune rifiuta', 'si el alcalde dice que no']) {
    assert.ok(errorsFor(fork('chiamare il prefetto', lead)).some((m) => /leading/.test(m)), lead);
  }
});

test('two forks waiting on something not happening ask one question, in Italian too', () => {
  const plan = fork('chiamare il prefetto', 'nessuna offerta entro dicembre');
  plan.linesOfOperation[0].nextActions.push({ action: 'cercare un altro locale', who: 'io', if: { event: 'il sindaco non ha fissato la data' } });
  assert.ok(errorsFor(plan).some((m) => /asks the same question/.test(m)));
});

test('a message never goes to the user, in any language', () => {
  for (const n of ['io', "l'utente", 'yo', 'usted', 'eu', 'você']) assert.equal(isSelfName(n), true, n);
});
