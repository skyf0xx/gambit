import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db } from './lib/db';
import { getActiveGoalId, migrateAll, setActiveGoal } from './lib/goals';
import { getProvider } from './lib/providers';
import { hasApiKey } from './lib/crypto';
import { initDurability, isIos, isStandalone, useUi } from './lib/persist';
import { startFileSync, fileSyncState, reauthorizeFileSync } from './lib/portability';
import { Setup } from './components/Setup';
import { Chat } from './components/Chat';
import { Dashboard, useGoalView } from './components/Dashboard';
import { NewGoalDialog } from './components/NewGoal';
import { useSessionCost } from './components/CostPanel';
import { TextAction } from './components/ui';
import { Filters } from './components/paper/Filters';

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

/** The app-update and install banners only — the export-status banner is
 * never shown here; it lives in the menu/settings leaf (work item 5). */
function Banners() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  const { installEvent, installDismissed, dismissInstall } = useUi();
  const [sync, setSync] = useState<'off' | 'active' | 'needs_permission'>('off');
  useEffect(() => { void fileSyncState().then(setSync); }, [installEvent]);
  return (
    <>
      {needRefresh && <Banner>New app version ready. <TextAction className="underline underline-offset-[3px]" onClick={() => void updateServiceWorker(true)}>Reload</TextAction></Banner>}
      {!installDismissed && !isStandalone() && (installEvent || isIos()) && (
        <Banner onClose={dismissInstall}>
          Install Gambit to keep your data safe: browsers can erase data for sites that aren't installed.
          {installEvent ? <TextAction className="underline underline-offset-[3px]" onClick={() => void installEvent.prompt()}>Install</TextAction> : <span>Tap Share, then Add to Home Screen.</span>}
        </Banner>
      )}
      {sync === 'needs_permission' && <Banner>Backup file needs permission again. <TextAction className="underline underline-offset-[3px]" onClick={() => void reauthorizeFileSync()}>Re-authorize</TextAction></Banner>}
    </>
  );
}

function Main() {
  const goals = useLiveQuery(() => db.goals.orderBy('updatedAt').reverse().toArray(), []);
  const activeId = useLiveQuery(async () => (await getActiveGoalId()) ?? null, []);
  const { chatOpen, setChatOpen } = useUi();
  const [creating, setCreating] = useState(false);
  const cost = useSessionCost();
  const current = goals?.find((g) => g.id === activeId) ?? goals?.[0];
  const view = useGoalView(current?.id ?? '');
  const stub = view?.status === 'ok' && view.data.successCriteria.length === 1 && view.data.successCriteria[0].text === 'define success criteria';

  useEffect(() => { if (current && current.id !== activeId) void setActiveGoal(current.id); }, [current, activeId]);
  useEffect(() => startFileSync(), []);
  // The index card's "Not yet" / "Something changed" should bring the
  // conversation to the front on mobile too, not just fill the composer.
  useEffect(() => {
    const onCompose = () => setChatOpen(true);
    window.addEventListener('gambit:compose', onCompose);
    return () => window.removeEventListener('gambit:compose', onCompose);
  }, [setChatOpen]);
  // gambit:menu used to open a Settings Leaf; Inside cover is now a real
  // page in the tab stack instead (Tabs.tsx listens for this event itself
  // and switches to it), so there's nothing left for App.tsx to do here.

  if (!goals) return null;
  return (
    <div className="paper flex h-dvh flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <Banners />
      {current ? (
        <main className="relative min-h-0 flex-1 md:grid md:grid-cols-[1fr_440px] md:overflow-hidden">
          {/* The page: a centred column at reading width, with room to
             either side so the desk shows through — no shared border with
             the conversation leaf (brand/identity.md §05). Bottom padding
             on mobile reserves space for the collapsed composer slip
             fixed over it, so it never covers the page's last content. */}
          <section className="h-full min-h-0 overflow-y-auto pb-24 md:px-10 md:pb-0">
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
            />
          </section>
          <section className="hidden h-full min-h-0 md:block">
            <Chat goalId={current.id} stub={!!stub} variant="desktop" open onCollapse={() => {}} onExpand={() => {}} />
          </section>
          {/* Mobile: the conversation is a floating leaf, collapsed to its
             composer slip by default and expanded full-screen on open. */}
          <section className="md:hidden">
            <Chat goalId={current.id} stub={!!stub} variant="mobile" open={chatOpen} onCollapse={() => setChatOpen(false)} onExpand={() => setChatOpen(true)} />
          </section>
        </main>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="max-w-sm text-[15px] text-graphite">Start with a goal. Give it a working title; you'll sharpen it in conversation while the dashboard fills in.</p>
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
  const needsSetup = useLiveQuery(async () => { const p = await getProvider(); return !p || !(await hasApiKey(p.kind)); }, []);
  if (!ready || needsSetup === undefined) return null;
  return (
    <>
      <Filters />
      {needsSetup ? <Setup /> : <Main />}
    </>
  );
}
