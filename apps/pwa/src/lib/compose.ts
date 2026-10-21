// Page → chat hand-off: a line on the page that can only be changed through
// the conversation (an experiment's result, an open decision) offers a
// starter the user finishes and sends. Chat.tsx listens for this event and
// puts the text in its composer; it never sends on its own.

import { locale, t } from './i18n';

export const COMPOSE_EVENT = 'gambit:compose';

export function composeInChat(text: string) {
  window.dispatchEvent(new CustomEvent(COMPOSE_EVENT, { detail: { text } }));
}

/** A page line lower-cased to sit mid-sentence, unless it opens an acronym ("NDA"). */
const midSentence = (s: string) => (/^[A-Z][A-Z]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** The starter for defining a new goal: "Help me start a bakery". */
export function defineStarter(goal: string): string {
  const g = goal.trim();
  if (!g) return t('due.defineStarterEmpty');
  return t('due.defineStarter', { goal: midSentence(g) });
}

/** "Check your own risk" → "Help me check my own risk": a suggestion speaks
 * to the user, its starter speaks as the user. */
export function dueStarter(todo: string): string {
  const s = t('due.starter', { todo: midSentence(todo) });
  return locale() === 'en' ? s.replace(/\byour\b/g, 'my') : s;
}
