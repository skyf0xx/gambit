import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db, getSetting } from './lib/db';
import { getActiveGoalId, migrateAll, setActiveGoal } from './lib/goals';
import { getProvider } from './lib/providers';
import { hasApiKey } from './lib/crypto';
import { initDurability, isIos, isStandalone, useUi } from './lib/persist';
import { startFileSync, fileSyncState, reauthorizeFileSync } from './lib/portability';
import { Setup } from './components/Setup';
import { Chat } from './components/Chat';
import { Dashboard, useGoalView } from './components/Dashboard';
import { Settings } from './components/Settings';
import { NewGoalDialog } from './components/NewGoal';
import { fmtUsd } from './lib/cost';
import { useSessionCost } from './components/CostPanel';
import { TextAction } from './components/ui';
import { Filters } from './components/paper/Filters';

function Banner({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="hand flex items-center justify-between gap-3 border-b border-rule px-4 py-2 text-[16px]">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="grid h-11 w-11 flex-none place-items-center text-graphite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

function Banners() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  const { installEvent, installDismissed, dismissInstall, openSettings } = useUi();
  const [d, setD] = useState({ persisted: true, sync: 'off' as string, hasGoals: false, last: 0 });
  useEffect(() => {
    void (async () => {
      setD({
        persisted: (await navigator.storage?.persisted?.()) ?? true,
        sync: await fileSyncState(),
        hasGoals: (await db.goals.count()) > 0,
        last: (await getSetting<number>('lastExportAt')) ?? 0,
      });
    })();
  }, [installEvent]);
  const stale = d.hasGoals && d.sync !== 'active' && Date.now() - d.last > 14 * 864e5;
  return (
    <>
      {needRefresh && <Banner>New app version ready. <TextAction className="underline underline-offset-[3px]" onClick={() => void updateServiceWorker(true)}>Reload</TextAction></Banner>}
      {!installDismissed && !isStandalone() && (installEvent || isIos()) && (
        <Banner onClose={dismissInstall}>
          Install Gambit to keep your data safe: browsers can erase data for sites that aren't installed.
          {installEvent ? <TextAction className="underline underline-offset-[3px]" onClick={() => void installEvent.prompt()}>Install</TextAction> : <span>Tap Share, then Add to Home Screen.</span>}
        </Banner>
      )}
      {d.sync === 'needs_permission' && <Banner>Backup file needs permission again. <TextAction className="underline underline-offset-[3px]" onClick={() => void reauthorizeFileSync()}>Re-authorize</TextAction></Banner>}
      {stale && <Banner>Your goals haven't been exported in a while. <TextAction className="underline underline-offset-[3px]" onClick={() => openSettings(true)}>Export</TextAction></Banner>}
    </>
  );
}

function Main() {
  const goals = useLiveQuery(() => db.goals.orderBy('updatedAt').reverse().toArray(), []);
  const activeId = useLiveQuery(async () => (await getActiveGoalId()) ?? null, []);
  const { chatOpen, setChatOpen, settingsOpen, openSettings } = useUi();
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

  if (!goals) return null;
  return (
    <div className="paper flex h-dvh flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex items-center gap-3 border-b border-rule px-4 py-2.5">
        <span className="font-serif text-[17px] font-medium text-ink">Gambit</span>
        {goals.length > 0 && (
          <select
            className="min-w-0 max-w-[45vw] flex-1 truncate border-0 border-b border-card-rule bg-transparent px-0 py-1.5 text-[15px] text-ink focus:border-ink focus:outline-none md:max-w-xs"
            value={current?.id}
            onChange={(e) => void setActiveGoal(e.target.value)}
            aria-label="Active goal"
          >
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        )}
        <TextAction className="underline underline-offset-[3px]" onClick={() => setCreating(true)}>New goal</TextAction>
        <div className="flex-1" />
        {cost && cost.turns > 0 && (
          <TextAction className="text-[14px] text-graphite" onClick={() => openSettings(true)} title="Estimated session spend">
            {fmtUsd(cost.dollars)}
          </TextAction>
        )}
        <button
          onClick={() => openSettings(true)}
          aria-label="Settings"
          className="grid h-11 w-11 flex-none place-items-center text-graphite hover:text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>
      <Banners />
      {current ? (
        <main className="relative min-h-0 flex-1 md:grid md:grid-cols-[1fr_440px] md:overflow-hidden">
          {/* The page: a centred column at reading width, with room to
             either side so the desk shows through — no shared border with
             the conversation leaf (brand/identity.md §05). */}
          <section className="h-full min-h-0 overflow-y-auto md:px-10">
            <Dashboard goalId={current.id} />
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
      {settingsOpen && <Settings goalId={current?.id} />}
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
