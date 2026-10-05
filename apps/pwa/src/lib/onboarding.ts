import { getSetting, setSetting } from './db';
import { createGoal, PENDING_SEND } from './goals';
import { useUi } from './persist';

// First run, goal first (brand/ux-onboarding.md §3): the person writes what
// they're after, gets a key, and their words go in as the first message.
// The draft and the step are stored so a trip to AI Studio and back — which
// on a phone can reload the app — lands exactly where they left off.

export interface Onboarding {
  draft: string;
  step: 'goal' | 'key';
}

const KEY = 'onboarding';

export const getOnboarding = async (): Promise<Onboarding> => (await getSetting<Onboarding>(KEY)) ?? { draft: '', step: 'goal' };
export const saveOnboarding = (o: Onboarding) => setSetting(KEY, o);

/** A working title from their own words: the first sentence, at most ten words. */
export function titleFrom(draft: string): string {
  const first = draft.trim().split(/(?<=[.!?])\s|\n/)[0] ?? '';
  const words = first.split(/\s+/).filter(Boolean).slice(0, 10).join(' ');
  return words.replace(/[\s.,;:!?—–-]+$/, '') || 'My goal';
}

/** Create the goal from the draft and queue the draft as its first message. */
export async function startFromDraft(): Promise<void> {
  const { draft } = await getOnboarding();
  const text = draft.trim();
  if (!text) return;
  await createGoal(titleFrom(text), text);
  await setSetting(KEY, null);
  useUi.getState().setChatOpen(true);
}

const claimed = new Set<string>();

/** The queued first message for this goal, handed to exactly one caller. */
export async function takePendingSend(goalId: string): Promise<string | null> {
  if (claimed.has(goalId)) return null;
  const p = await getSetting<{ goalId: string; text: string } | null>(PENDING_SEND);
  if (!p || p.goalId !== goalId || claimed.has(goalId)) return null;
  claimed.add(goalId);
  await setSetting(PENDING_SEND, null);
  return p.text;
}
