import { create } from 'zustand';
import { getSetting, setSetting } from './db';

export interface Durability {
  persisted: boolean | null;
  installed: boolean;
  usageMB: number | null;
  quotaMB: number | null;
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

// iPadOS reports itself as a Mac; touch support gives it away.
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const isMacSafari = () => {
  const ua = navigator.userAgent;
  return /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua) && !isIos();
};

/** How this browser installs Gambit: its own prompt, a manual step to
 * describe, or not at all (Firefox and friends). */
export type InstallRoute = 'prompt' | 'ios' | 'mac-safari' | 'none';
export const installRoute = (hasEvent: boolean): InstallRoute =>
  hasEvent ? 'prompt' : isIos() ? 'ios' : isMacSafari() ? 'mac-safari' : 'none';

export const installSteps: Record<Exclude<InstallRoute, 'prompt' | 'none'>, string> = {
  ios: 'Share → Add to Home Screen.',
  'mac-safari': 'File → Add to Dock.',
};

/** Ask once at first run; the result is reported honestly in Settings. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  const granted = await navigator.storage.persist();
  await setSetting('persistAsked', { at: Date.now(), granted });
  return granted;
}

export async function readDurability(): Promise<Durability> {
  const est = (await navigator.storage?.estimate?.()) ?? {};
  return {
    persisted: navigator.storage?.persisted ? await navigator.storage.persisted() : null,
    installed: isStandalone(),
    usageMB: est.usage != null ? est.usage / 1e6 : null,
    quotaMB: est.quota != null ? est.quota / 1e6 : null,
  };
}

interface InstallEvent extends Event { prompt: () => Promise<void> }
interface UiState {
  installEvent: InstallEvent | null;
  installDismissed: boolean;
  /** Set by `appinstalled` — the tab that ran the install still isn't in
   * standalone mode, so this is how it knows. */
  justInstalled: boolean;
  /** Mobile only: the conversation leaf is a floating overlay, collapsed to
   * just its composer slip by default and expanded full-screen over the
   * page when opened (brand/identity.md §05's "conversation is a loose leaf
   * over the page"). Desktop always shows both panes side by side. */
  chatOpen: boolean;
  settingsOpen: boolean;
  setChatOpen: (o: boolean) => void;
  openSettings: (o: boolean) => void;
  dismissInstall: () => void;
}

export const useUi = create<UiState>((set) => ({
  installEvent: null,
  installDismissed: false,
  justInstalled: false,
  chatOpen: false,
  settingsOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
  openSettings: (settingsOpen) => set({ settingsOpen }),
  dismissInstall: () => { void setSetting('installDismissed', Date.now()); set({ installDismissed: true }); },
}));

export async function initDurability() {
  const dismissed = await getSetting<number>('installDismissed');
  useUi.setState({ installDismissed: !!dismissed });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useUi.setState({ installEvent: e as InstallEvent });
  });
  // The prompt event is single-use; drop it once the install lands.
  window.addEventListener('appinstalled', () => useUi.setState({ installEvent: null, justInstalled: true }));
  await requestPersistence();
}
