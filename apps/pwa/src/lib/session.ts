import { useSyncExternalStore } from 'react';
import type { LinePath } from './changes';

// In-memory, per-tab session state for the accent loop and dropped-line
// fade (brand/identity.md §05 pencil marks: "the loop … until the next
// session, a tap on the line, or undo" / "the eraser … lasts only one
// session"). No persistence — it empties on reload, which is what "until
// next session" means for these two marks. Nothing here touches the goal
// or Dexie; it is purely a hint to MarksLayer about what just happened.

export interface TurnLines {
  goalId: string;
  turnId: string;
  lines: { path: LinePath; text: string }[];
  animated: boolean;
}

/** Everything the last turn wrote, for the "new" pencil tags and the
 * divider-tab dots. Outlives the loop (a tap on the loop's line clears only
 * the loop) and clears on the next turn, undo, or reload. `seenTabs` are
 * the tabs opened since the turn landed, whose dots are spent. */
export interface FreshWrites {
  goalId: string;
  /** The line the loop went on — it has its own note, so no tag. */
  lead?: LinePath;
  lines: Set<LinePath>;
  keys: Set<string>;
  seenTabs: Set<string>;
}

interface SessionState {
  turn: TurnLines | null;
  fresh: FreshWrites | null;
  dropped: Map<string, Set<LinePath>>;
}

type Listener = () => void;

function createSessionStore() {
  let state: SessionState = { turn: null, fresh: null, dropped: new Map() };
  const listeners = new Set<Listener>();

  const emit = () => listeners.forEach((l) => l());

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot(): SessionState {
      return state;
    },
    setTurn(goalId: string, turnId: string, lines: { path: LinePath; text: string }[], keys: string[] = []) {
      const fresh = lines.length || keys.length
        ? { goalId, lead: lines[0]?.path, lines: new Set(lines.map((l) => l.path)), keys: new Set(keys), seenTabs: new Set<string>() }
        : null;
      state = { ...state, turn: { goalId, turnId, lines, animated: false }, fresh };
      emit();
    },
    markTabSeen(goalId: string, tab: string) {
      const f = state.fresh;
      if (!f || f.goalId !== goalId || f.seenTabs.has(tab)) return;
      state = { ...state, fresh: { ...f, seenTabs: new Set([...f.seenTabs, tab]) } };
      emit();
    },
    clearFresh() {
      if (!state.fresh) return;
      state = { ...state, fresh: null };
      emit();
    },
    clearLoop() {
      if (!state.turn) return;
      state = { ...state, turn: null };
      emit();
    },
    markDropped(goalId: string, path: LinePath) {
      const next = new Map(state.dropped);
      const set = new Set(next.get(goalId) ?? []);
      set.add(path);
      next.set(goalId, set);
      state = { ...state, dropped: next };
      emit();
    },
    markAnimated() {
      if (!state.turn || state.turn.animated) return;
      state = { ...state, turn: { ...state.turn, animated: true } };
      emit();
    },
  };
}

const store = createSessionStore();

/** Non-hook handle, for use outside React components (e.g. lib/agent.ts). */
export const session = {
  getSnapshot: store.getSnapshot,
  setTurn: store.setTurn,
  clearLoop: store.clearLoop,
  markDropped: store.markDropped,
  markAnimated: store.markAnimated,
  markTabSeen: store.markTabSeen,
  clearFresh: store.clearFresh,
};

/** Undo of a turn clears the open loop — exported here since undoTurn lives
 * in lib/agent.ts (owned by this stage) and calls this directly; kept as a
 * named export too in case a later stage needs to trigger it from outside
 * the undo flow itself. */
export function undoTurnMarks() {
  store.clearLoop();
  store.clearFresh();
}

export function useSession(): SessionState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
