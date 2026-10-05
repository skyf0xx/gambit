// Page → chat hand-off: a line on the page that can only be changed through
// the conversation (an experiment's result, an open decision) offers a
// starter the user finishes and sends. Chat.tsx listens for this event and
// puts the text in its composer; it never sends on its own.

export const COMPOSE_EVENT = 'gambit:compose';

export function composeInChat(text: string) {
  window.dispatchEvent(new CustomEvent(COMPOSE_EVENT, { detail: { text } }));
}

/** The starter for defining a new goal: "Help me start a bakery". The
 * goal's first letter is lower-cased unless it opens an acronym ("NDA"). */
export function defineStarter(goal: string): string {
  const g = goal.trim();
  if (!g) return 'Help me define the goal';
  return `Help me ${/^[A-Z][A-Z]/.test(g) ? g : g.charAt(0).toLowerCase() + g.slice(1)}`;
}
