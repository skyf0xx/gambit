import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isStub } from '@gambit/core';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db } from './lib/db';
import { getActiveGoalId, migrateAll, setActiveGoal } from './lib/goals';
import { getProvider, PROVIDERS } from './lib/providers';
import { hasApiKey } from './lib/crypto';
import { initDurability, useUi } from './lib/persist';
import { startFileSync, fileSyncState, reauthorizeFileSync } from './lib/portability';
import { Setup } from './components/Setup';
import { Chat } from './components/Chat';
import { Dashboard, useGoalView } from './components/Dashboard';
import { NewGoalDialog } from './components/NewGoal';
import { useSessionCost } from './components/CostPanel';
import { TextAction } from './components/ui';
import { Filters } from './components/paper/Filters';
import type { TabId } from './components/tabs/tabDefs';

/** A pencilled line, restyled to sit inside the page area rather than
 * spanning the full width like the old header banners (work item 5). Placed
 * just above the page. The export-status banner never appears here — it
 * lives only in the menu/settings leaf (see Settings.tsx's Menu section). */
function Banner({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="hand mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pt-3 text-[16px] md:px-16">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" data-note="Dismiss" className="grid h-11 w-11 flex-none place-items-center text-graphite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

const DESKTOP_HINT_KEY = 'gambit:desktop-hint-dismissed';
const PHONE = '(pointer: coarse) and (max-width: 767px)';

/** On a phone, once: Gambit is laid out for the page and the chat side by
 * side. Closing it is for good, in this browser. */
function useDesktopHint(): [boolean, () => void] {
  const [show, setShow] = useState(() => {
    try { if (localStorage.getItem(DESKTOP_HINT_KEY)) return false; } catch { /* show it; closing still hides it for now */ }
    return typeof matchMedia === 'function' && matchMedia(PHONE).matches;
  });
  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DESKTOP_HINT_KEY, '1'); } catch { /* gone until reload */ }
  };
  return [show, dismiss];
}

/** The app-update, backup-permission and desktop-hint banners only. Install lives on the
 * Goal page (KeepNotebook, shown once there's something to lose) and on the
 * Inside cover; the export-status banner lives in the menu/settings leaf. */
function Banners() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  const [sync, setSync] = useState<'off' | 'active' | 'needs_permission'>('off');
  useEffect(() => { void fileSyncState().then(setSync); }, []);
  const [desktopHint, dismissDesktopHint] = useDesktopHint();
  return (
    <>
      {desktopHint && <Banner onClose={dismissDesktopHint}>Gambit works best on desktop.</Banner>}
      {needRefresh && <Banner>Update ready. <TextAction className="underline underline-offset-[3px]" onClick={() => void updateServiceWorker(true)}>Reload</TextAction></Banner>}
      {sync === 'needs_permission' && <Banner>Backup paused. <TextAction className="underline underline-offset-[3px]" onClick={() => void reauthorizeFileSync()}>Resume</TextAction></Banner>}
    </>
  );
}

function Main() {
  const goals = useLiveQuery(() => db.goals.orderBy('updatedAt').reverse().toArray(), []);
  const activeId = useLiveQuery(async () => (await getActiveGoalId()) ?? null, []);
  const { chatOpen, setChatOpen } = useUi();
  const [creating, setCreating] = useState(false);
  // The Cover and Settings pages are about the notebook, not this goal, so
  // the conversation steps aside on them.
  const [tab, setTab] = useState<TabId>('moves');
  const chatHidden = tab === 'cover' || tab === 'inside-cover';
  const cost = useSessionCost();
  const current = goals?.find((g) => g.id === activeId) ?? goals?.[0];
  const view = useGoalView(current?.id ?? '');
  const stub = view?.status === 'ok' && isStub(view.data);

  useEffect(() => { if (current && current.id !== activeId) void setActiveGoal(current.id); }, [current, activeId]);
  useEffect(() => startFileSync(), []);
  // gambit:menu used to open a Settings Leaf; Inside cover is now a real
  // page in the tab stack instead (Tabs.tsx listens for this event itself
  // and switches to it), so there's nothing left for App.tsx to do here.

  if (!goals) return null;
  return (
    <div className="paper flex h-dvh flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <Banners />
      {current ? (
        <main className={`relative min-h-0 flex-1 md:grid md:overflow-hidden ${chatHidden ? 'md:grid-cols-1' : 'md:grid-cols-[1fr_440px]'}`}>
          {/* The page: a centred column at reading width, with room to
             either side so the desk shows through — no shared border with
             the conversation leaf (brand/identity.md §05). Bottom padding
             on mobile reserves space for the collapsed composer slip
             fixed over it, so it never covers the page's last content. */}
          <section className={`h-full min-h-0 overflow-y-auto md:px-10 md:pb-0 ${chatHidden ? '' : 'pb-24'}`}>
            <Dashboard
              goalId={current.id}
              settings={{
                goalId: current.id,
                goals,
                activeId: current.id,
                cost,
                onSwitchGoal: (id) => void setActiveGoal(id),
                onNewGoal: () => setCreating(true),
              }}
              onTabChange={setTab}
            />
          </section>
          {/* Hidden, not unmounted, so a turn in flight keeps streaming. */}
          <section className={`hidden h-full min-h-0 ${chatHidden ? '' : 'md:block'}`}>
            <Chat goalId={current.id} stub={!!stub} variant="desktop" open onCollapse={() => {}} onExpand={() => {}} />
          </section>
          {/* Mobile: the conversation is a floating leaf, collapsed to its
             composer slip by default and expanded full-screen on open. */}
          <section className={chatHidden ? 'hidden' : 'md:hidden'}>
            <Chat goalId={current.id} stub={!!stub} variant="mobile" open={chatOpen} onCollapse={() => setChatOpen(false)} onExpand={() => setChatOpen(true)} />
          </section>
        </main>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <TextAction className="underline underline-offset-[3px]" onClick={() => setCreating(true)}>Start a goal</TextAction>
        </div>
      )}
      {creating && <NewGoalDialog onClose={() => { setCreating(false); setChatOpen(true); }} />}
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { void (async () => { await migrateAll(); await initDurability(); setReady(true); })(); }, []);
  const setup = useLiveQuery(async () => {
    const p = await getProvider();
    const needed = !p || !(p.kind in PROVIDERS) || !(await hasApiKey(p.kind));
    return { needed, hasGoals: (await db.goals.count()) > 0 };
  }, []);
  // Marks this browser as a returning user, so the landing page at / sends
  // it straight here (public/returning.js).
  useEffect(() => {
    if (setup && !setup.needed) try { localStorage.setItem('gambit:returning', '1'); } catch { /* the landing page shows instead */ }
  }, [setup]);
  if (!ready || setup === undefined) return null;
  return (
    <>
      <Filters />
      {setup.needed ? <Setup hasGoals={setup.hasGoals} /> : <Main />}
    </>
  );
}
