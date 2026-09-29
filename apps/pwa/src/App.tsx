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
import { Btn } from './components/ui';

function Banner({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-300">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {onClose && <button onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Dismiss">✕</button>}
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
      {needRefresh && <Banner>New app version ready. <Btn kind="primary" onClick={() => void updateServiceWorker(true)}>Reload</Btn></Banner>}
      {!installDismissed && !isStandalone() && (installEvent || isIos()) && (
        <Banner onClose={dismissInstall}>
          Install Gambit to keep your data safe: browsers can erase data for sites that aren't installed.
          {installEvent ? <Btn kind="primary" onClick={() => void installEvent.prompt()}>Install</Btn> : <span>Tap Share, then Add to Home Screen.</span>}
        </Banner>
      )}
      {d.sync === 'needs_permission' && <Banner>Backup file needs permission again. <Btn kind="primary" onClick={() => void reauthorizeFileSync()}>Re-authorize</Btn></Banner>}
      {stale && <Banner>Your goals haven't been exported in a while. <Btn onClick={() => openSettings(true)}>Export</Btn></Banner>}
    </>
  );
}

function Main() {
  const goals = useLiveQuery(() => db.goals.orderBy('updatedAt').reverse().toArray(), []);
  const activeId = useLiveQuery(async () => (await getActiveGoalId()) ?? null, []);
  const { tab, setTab, settingsOpen, openSettings } = useUi();
  const [creating, setCreating] = useState(false);
  const cost = useSessionCost();
  const current = goals?.find((g) => g.id === activeId) ?? goals?.[0];
  const view = useGoalView(current?.id ?? '');
  const stub = view?.status === 'ok' && view.data.successCriteria.length === 1 && view.data.successCriteria[0].text === 'define success criteria';

  useEffect(() => { if (current && current.id !== activeId) void setActiveGoal(current.id); }, [current, activeId]);
  useEffect(() => startFileSync(), []);

  if (!goals) return null;
  return (
    <div className="flex h-dvh flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <span className="font-semibold">Gambit</span>
        {goals.length > 0 && (
          <select className="min-w-0 max-w-[45vw] flex-1 truncate rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm md:max-w-xs" value={current?.id} onChange={(e) => void setActiveGoal(e.target.value)} aria-label="Active goal">
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        )}
        <Btn onClick={() => setCreating(true)}>＋ New goal</Btn>
        <div className="flex-1" />
        {cost && cost.turns > 0 && <button className="text-xs text-slate-400 hover:text-slate-200" onClick={() => openSettings(true)} title="Estimated session spend">{fmtUsd(cost.dollars)}</button>}
        <Btn onClick={() => openSettings(true)} aria-label="Settings">⚙</Btn>
      </header>
      <Banners />
      {current ? (
        <>
          <main className="min-h-0 flex-1 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <section className={`${tab === 'chat' ? 'block' : 'hidden'} h-full min-h-0 border-slate-800 md:block md:border-r`}><Chat goalId={current.id} stub={!!stub} /></section>
            <section className={`${tab === 'dashboard' ? 'block' : 'hidden'} h-full min-h-0 overflow-y-auto md:block`}><Dashboard goalId={current.id} /></section>
          </main>
          <nav className="grid grid-cols-2 border-t border-slate-800 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {(['chat', 'dashboard'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`py-3 text-sm capitalize ${tab === t ? 'text-sky-300' : 'text-slate-400'}`}>{t}</button>
            ))}
          </nav>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="max-w-sm text-sm text-slate-400">Start with a goal. Give it a working title; you'll sharpen it in conversation while the dashboard fills in.</p>
          <Btn kind="primary" onClick={() => setCreating(true)}>Start a goal</Btn>
        </div>
      )}
      {creating && <NewGoalDialog onClose={() => { setCreating(false); setTab('chat'); }} />}
      {settingsOpen && <Settings goalId={current?.id} />}
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { void (async () => { await migrateAll(); await initDurability(); setReady(true); })(); }, []);
  const needsSetup = useLiveQuery(async () => { const p = await getProvider(); return !p || !(await hasApiKey(p.kind)); }, []);
  if (!ready || needsSetup === undefined) return null;
  return needsSetup ? <Setup /> : <Main />;
}
