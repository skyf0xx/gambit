import { useEffect, useRef, useState } from 'react';
import { dictationSupported, useDictation } from '../lib/dictation';
import {
  getProvider, saveProvider, checkKey, keyProvider, settingsForKey, cleanKey, PROVIDERS, GOOGLE_KEY_URL, OPENROUTER_BASE, KEY_LABEL, originAllowed,
  type KeyCheck, type ProviderKind, type ProviderSettings,
} from '../lib/providers';
import { saveApiKey, hasApiKey, clearApiKey } from '../lib/crypto';
import { getOnboarding, saveOnboarding, startFromDraft, type Onboarding } from '../lib/onboarding';
import { InkButton, TextAction, Field, inputCls } from './ui';
import { HandMic } from './paper/HandMic';
import { DividerTabs } from './tabs/DividerTabs';
import { TabPanel } from './tabs/TabPanel';
import { TAB_LABELS, type TabId } from './tabs/tabDefs';

const CHECK_TEXT: Record<Exclude<KeyCheck, 'ok'>, string> = {
  bad: "That key didn't work. Copy it again and paste it here.",
  offline: "You're offline. Connect and paste the key again.",
  unreachable: "Couldn't reach the provider to check this key.",
};

/** Provider, model and key entry. Used under "Other options" on first run and inside Settings. */
export function ProviderForm({ onDone, beforeSave, firstRun }: { onDone?: () => void; beforeSave?: () => Promise<void>; firstRun?: boolean }) {
  const [state, setS] = useState<ProviderSettings>({ kind: firstRun ? 'anthropic' : 'google', model: PROVIDERS[firstRun ? 'anthropic' : 'google'].defaultModel });
  const s = state;
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // An unreachable check (a custom endpoint without browser CORS on its
  // model list, say) can be overridden; a rejected key can't.
  const [unchecked, setUnchecked] = useState(false);
  // A proxy is optional for every provider but a custom one, so its field
  // stays off the form until it's asked for or already in use.
  const [showBase, setShowBase] = useState(false);

  useEffect(() => {
    if (firstRun) return;
    void (async () => {
      const p = await getProvider();
      if (p && p.kind in PROVIDERS) { setS(p); setSaved(await hasApiKey(p.kind)); setShowBase(!!p.baseURL); }
    })();
  }, [firstRun]);

  const change = async (kind: ProviderKind) => {
    setS({ kind, model: PROVIDERS[kind].defaultModel, baseURL: undefined, webSearch: false });
    setSaved(await hasApiKey(kind));
    setKey('');
    setDetected(null);
    setErr('');
    setUnchecked(false);
  };

  // A recognised key picks its own provider, and that provider's recommended
  // model (OpenRouter and DeepSeek as custom endpoints).
  const [detected, setDetected] = useState<keyof typeof KEY_LABEL | null>(null);
  /** The settings a recognised key calls for, or null when the form already has them. */
  function settingsFromKey(k: string): ProviderSettings | null {
    const p = keyProvider(k);
    if (!p || (firstRun && p === 'google')) return null;
    const next = settingsForKey(p);
    const same = next.kind === s.kind && (next.kind !== 'custom' || (s.baseURL ?? '').startsWith(next.baseURL ?? ''));
    return same ? null : { ...next, webSearch: false };
  }
  function adopt(next: ProviderSettings) {
    setS(next);
    setShowBase(!!next.baseURL);
    setErr('');
    setUnchecked(false);
    void hasApiKey(next.kind).then(setSaved);
  }
  function onKey(k: string) {
    setKey(k);
    setDetected(keyProvider(k));
    const next = settingsFromKey(k);
    if (next) adopt(next);
  }

  async function save(skipCheck = false) {
    setErr('');
    setUnchecked(false);
    // Whatever the form shows, a recognised key saves under its own provider.
    const fromKey = key ? settingsFromKey(key) : null;
    if (fromKey) adopt(fromKey);
    const s = fromKey ?? state;
    if (!s.model.trim()) return setErr('Add a model (the default is fine).');
    const base = s.baseURL || PROVIDERS[s.kind].baseURL;
    if (s.kind === 'custom' && !base) return setErr('A custom provider needs a base URL.');
    if (base && !originAllowed(base)) return setErr(`${new URL(base).origin} isn't in this build's allowed origins. Self-hosters can add it with VITE_EXTRA_CONNECT_SRC at build time.`);
    if (!key && !saved) return setErr('Paste your API key to continue.');
    setBusy(true);
    try {
      if (key && !skipCheck) {
        const r = await checkKey(s, key);
        if (r !== 'ok') {
          setErr(CHECK_TEXT[r]);
          if (r === 'unreachable') setUnchecked(true);
          return;
        }
      }
      await beforeSave?.();
      const settings = { ...s, baseURL: s.baseURL || undefined };
      if (key) await saveApiKey(s.kind, cleanKey(key));
      await saveProvider(settings);
      setKey('');
      setSaved(true);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="API key" hint="Only goes to your provider.">
        <input className={`${inputCls} font-mono`} type="password" autoComplete="off" value={key} onChange={(e) => onKey(e.target.value)} placeholder={saved ? 'Saved' : 'Paste your key'} />
        {detected && <span className="anim-fade-in block text-[14px] text-ink">{KEY_LABEL[detected]} key detected. Provider and model are set below.</span>}
      </Field>
      <Field label="Provider" hint={PROVIDERS[s.kind].help}>
        <select className={inputCls} value={s.kind} onChange={(e) => void change(e.target.value as ProviderKind)}>
          {(Object.keys(PROVIDERS) as ProviderKind[]).filter((k) => !(firstRun && k === 'google')).map((k) => <option key={k} value={k}>{PROVIDERS[k].label}</option>)}
        </select>
      </Field>
      <Field label="Model id">
        <input className={inputCls} value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} placeholder={s.kind === 'custom' ? 'e.g. deepseek-flash' : 'model id'} />
      </Field>
      {s.kind === 'custom' || showBase ? (
        <Field label={s.kind === 'custom' ? 'Base URL' : 'Proxy / base URL (optional)'} hint={s.kind === 'custom' ? `OpenRouter: ${OPENROUTER_BASE}` : 'For providers that block browsers.'}>
          <input className={inputCls} value={s.baseURL ?? ''} onChange={(e) => setS({ ...s, baseURL: e.target.value })} placeholder={PROVIDERS[s.kind].baseURL ?? 'https://…/v1'} />
        </Field>
      ) : (
        <TextAction className="text-[14px]! text-graphite! underline underline-offset-[3px]" onClick={() => setShowBase(true)}>Custom base URL</TextAction>
      )}
      {s.kind === 'anthropic' && !firstRun && (
        <label className="flex items-center gap-2 text-[14px] text-graphite">
          <input type="checkbox" checked={!!s.webSearch} onChange={(e) => setS({ ...s, webSearch: e.target.checked })} />
          Web search (billed by Anthropic)
        </label>
      )}
      {err && (
        <p className="anim-fade-in text-[15px] text-accent">
          {err}{' '}
          {unchecked && <TextAction className="text-[15px]! underline underline-offset-[3px]" onClick={() => void save(true)}>Use it anyway</TextAction>}
        </p>
      )}
      <div className="flex items-center gap-4">
        <InkButton disabled={busy} onClick={() => void save()}>{busy ? 'Checking…' : firstRun ? 'Continue' : 'Save'}</InkButton>
        {saved && !firstRun && <TextAction className="text-graphite underline underline-offset-[3px]" onClick={async () => { await clearApiKey(s.kind); setSaved(false); }}>Remove key</TextAction>}
      </div>
    </div>
  );
}

/** First run. With no goals yet: the pitch and the question, then the key.
 * With goals but no working key (it was removed): straight to the key. */
/** The pages ahead, named on their tabs. Each opens to one line saying what
 * will fill it, so the notebook can be looked through before it's started. */
const PREVIEWS: Partial<Record<TabId, string>> = {
  moves: 'The most important moves you can make.',
  people: 'Who matters, what they want, and who can be won over.',
  risks: 'What could go wrong, and how to prepare.',
  bets: 'Not everything is certain, but you can manage risk.',
  doodles: 'A mindmap of our entire plan.',
};
const SETUP_TABS: TabId[] = ['goal', 'moves', 'people', 'risks', 'bets', 'doodles', 'inside-cover'];

export function Setup({ hasGoals }: { hasGoals: boolean }) {
  const [o, setO] = useState<Onboarding | null>(null);
  const [peek, setPeek] = useState<TabId | null>(null);
  useEffect(() => { void getOnboarding().then((v) => setO(hasGoals ? { ...v, step: 'key' } : v)); }, [hasGoals]);
  if (!o) return null;
  const update = (next: Onboarding) => { setPeek(null); setO(next); void saveOnboarding(next); };
  // The goal and its queued first message exist before the key is saved,
  // since saving the key is what swaps this screen for the notebook.
  const beforeSave = hasGoals ? undefined : startFromDraft;
  // The question is the Goal page; the key lives where it will stay, in Settings.
  const home: TabId = o.step === 'goal' ? 'goal' : 'inside-cover';
  const active = peek ?? home;
  // Settings appears once it's where they are: the key page.
  const tabs = o.step === 'key' ? SETUP_TABS : SETUP_TABS.filter((t) => t !== 'inside-cover');
  const pick = (t: TabId) => {
    if (t === home) return setPeek(null);
    if (t === 'goal' && !hasGoals) return update({ ...o, step: 'goal' });
    setPeek(t);
  };

  return (
    <div className="min-h-dvh pt-[env(safe-area-inset-top)] md:pt-8">
      {/* The same page sheet as the notebook (Dashboard.tsx): margin rule,
          tabs off the right edge into the desk. */}
      <div
        className="setup-sheet paper relative mx-auto mr-9 flex min-h-dvh max-w-xl flex-col rounded-t-[3px] md:mr-auto md:min-h-[calc(100dvh-2rem)] md:shadow-[0_1px_1px_var(--lift),0_8px_30px_-8px_var(--lift-far)]"
        style={{ borderLeft: '2px solid var(--margin-rule)' }}
      >
        <DividerTabs tabs={tabs} active={active} onChange={pick} changedTabs={new Set()} />
        <div className="flex flex-1 flex-col px-8.5 pt-10 md:px-16 md:pt-14" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {peek && PREVIEWS[peek] ? (
            <TabPanel tab={peek} active>
              <Preview tab={peek} line={PREVIEWS[peek]!} back={o.step === 'goal' ? 'Start with your goal' : 'Back to your key'} onBack={() => setPeek(null)} />
            </TabPanel>
          ) : o.step === 'goal' ? (
            <TabPanel tab="goal" active>
              <GoalStep draft={o.draft} onDraft={(draft) => update({ ...o, draft })} onNext={() => update({ ...o, step: 'key' })} />
            </TabPanel>
          ) : (
            <TabPanel tab="inside-cover" active>
              <KeyStep beforeSave={beforeSave} onBack={hasGoals ? undefined : () => update({ ...o, step: 'goal' })} />
            </TabPanel>
          )}
        </div>
      </div>
      <style>{`
        /* The dividers slide out from behind the page on arrival, one after
           another. Backwards fill only, so each tab's own resting transform
           takes over once it lands. */
        .setup-sheet .tab-leaf { animation: setup-tab-in 520ms cubic-bezier(0.34, 1.4, 0.64, 1) backwards; }
        ${SETUP_TABS.map((_, i) => `.setup-sheet .tab-leaf:nth-child(${i + 1}) { animation-delay: ${250 + i * 70}ms; }`).join('\n        ')}
        @keyframes setup-tab-in {
          from { transform: translateX(-34px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        /* The panel fills the page, so a short page still reaches its foot. */
        .setup-sheet [role="tabpanel"] { display: flex; flex: 1; flex-direction: column; }
        .setup-sheet [role="tabpanel"] > * { margin-block: 0; }
        @media (prefers-reduced-motion: reduce) {
          .setup-sheet .tab-leaf { animation: none; }
        }
      `}</style>
    </div>
  );
}

/** A page not written yet: its name, what will fill it, and blank ruled lines. */
function Preview({ tab, line, back, onBack }: { tab: TabId; line: string; back: string; onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="ink-bleed font-serif text-[30px] leading-[38px] font-medium text-ink">{TAB_LABELS[tab]}</h1>
      <p className="mt-4 text-[17px] leading-[27px] text-graphite">{line}</p>
      <div aria-hidden="true" className="mt-8 h-48" style={{ background: 'repeating-linear-gradient(transparent 0 31px, var(--card-rule) 31px 32px)' }} />
      <p className="hand mt-6 text-[20px]!">Fills in as we talk.</p>
      <TextAction className="mt-8 self-start underline underline-offset-[3px]" onClick={onBack}>{back}</TextAction>
    </div>
  );
}

function GoalStep({ draft, onDraft, onNext }: { draft: string; onDraft: (v: string) => void; onNext: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [canDictate] = useState(dictationSupported);
  const [voiceNote, setVoiceNote] = useState('');
  const dictation = useDictation({ onText: onDraft, onError: setVoiceNote });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 160)}px`;
  }, [draft]);
  // Focus the field only with a mouse or trackpad: on a phone the keyboard
  // would cover the page before it's been seen.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) ref.current?.focus({ preventScroll: true });
  }, []);
  const ready = !!draft.trim();

  const next = () => { dictation.stop(); onNext(); };

  return (
    <div className="flex flex-1 flex-col">
      {/* Masthead: the brand and its promise, kept small so the question leads. */}
      <div className="anim-rise flex flex-wrap items-baseline gap-x-2.5">
        <span className="font-serif text-[19px] leading-[26px] font-semibold tracking-[-0.01em] text-ink">gambit</span>
        <span className="text-[15px] leading-[26px] text-graphite">the notebook that thinks back</span>
      </div>

      <div className="anim-rise mt-16 md:mt-24">
        <h1 className="ink-bleed font-serif text-[30px] leading-[38px] font-medium text-balance text-ink">
          <label htmlFor="first-goal">What are you trying to make happen?</label>
        </h1>
        <textarea
          id="first-goal"
          ref={ref}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && ready) next(); }}
          placeholder={dictation.listening ? 'listening…' : "Write it the way you'd say it to a friend."}
          className="mt-12 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-sans text-[19px] leading-[32px] text-ink caret-accent placeholder:text-graphite focus:outline-none"
          style={{ background: 'repeating-linear-gradient(transparent 0 31px, var(--card-rule) 31px 32px)' }}
        />
        {voiceNote && <p role="status" className="anim-fade-in mt-2 text-[14px] leading-5 text-accent">{voiceNote}</p>}
        {/* After the field, so "instead" follows the placeholder it answers. */}
        {canDictate && (
          <button
            type="button"
            aria-pressed={dictation.listening}
            onClick={() => {
              if (dictation.listening) return dictation.stop();
              setVoiceNote('');
              dictation.start(draft);
            }}
            className={`anim-press group mt-4 flex min-h-11 items-center gap-2 text-[15px] ${dictation.listening ? 'text-accent' : 'text-graphite hover:text-ink'}`}
          >
            <HandMic size={20} className={dictation.listening ? 'anim-pulse' : 'pencil group-hover:text-ink'} />
            {dictation.listening ? 'Stop listening' : 'Say it instead'}
          </button>
        )}
        <InkButton className={canDictate ? 'mt-8' : 'mt-12'} disabled={!ready} onClick={next}>Continue</InkButton>
      </div>

      <p className="hand mt-auto pt-16 text-[20px]! leading-[26px]!">Next, add your API key.</p>
    </div>
  );
}

const OPENED = 'gambit:opened-studio';

/** Where each provider hands out keys, for anyone arriving without one. */
const KEY_LINKS: { label: string; url: string }[] = [
  { label: 'Google', url: GOOGLE_KEY_URL },
  { label: 'Anthropic', url: 'https://console.anthropic.com/settings/keys' },
  { label: 'OpenAI', url: 'https://platform.openai.com/api-keys' },
  { label: 'DeepSeek', url: 'https://platform.deepseek.com/api_keys' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/keys' },
];

type Status =
  | { kind: 'idle' }
  | { kind: 'checking'; label?: string }
  | { kind: 'ok'; label?: string }
  | { kind: 'error'; text: string };

function KeyStep({ beforeSave, onBack }: { beforeSave?: () => Promise<void>; onBack?: () => void }) {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [otherProvider, setOtherProvider] = useState(false);
  const run = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
  // Set once they've gone off to get a key. Kept for the tab's session,
  // since coming back on a phone can reload the app.
  const [opened, setOpened] = useState(() => { try { return sessionStorage.getItem(OPENED) === '1'; } catch { return false; } });

  async function commit(s: ProviderSettings, k: string) {
    await beforeSave?.();
    await saveApiKey(s.kind, k);
    await saveProvider(s);
  }

  async function verify(s: ProviderSettings, k: string, label: string) {
    const id = ++run.current;
    setStatus({ kind: 'checking', label });
    const r = await checkKey(s, k);
    if (id !== run.current) return;
    if (r !== 'ok') {
      setStatus({ kind: 'error', text: CHECK_TEXT[r] });
      return;
    }
    setStatus({ kind: 'ok', label });
    // A beat to read "key works" before the notebook opens.
    await new Promise((res) => setTimeout(res, 700));
    if (id === run.current) await commit(s, k);
  }

  // Checked on paste or typing, once the key is long enough to be one.
  useEffect(() => {
    const k = cleanKey(key);
    run.current++;
    if (k.length < 20) { setStatus({ kind: 'idle' }); return; }
    const p = keyProvider(k);
    if (!p) { setStatus({ kind: 'error', text: "We don't recognise this key. For another provider, use a custom endpoint below." }); return; }
    const t = setTimeout(() => void verify(settingsForKey(p), k, KEY_LABEL[p]), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function paste() {
    try { setKey(cleanKey(await navigator.clipboard.readText())); } catch { /* declined; the field still takes a long-press paste */ }
  }

  function getKey(url: string) {
    window.open(url, '_blank', 'noopener');
    setOpened(true);
    try { sessionStorage.setItem(OPENED, '1'); } catch { /* the Paste button still works */ }
  }

  // Back from getting a key: read the clipboard, and fill the field if it
  // holds one. Chrome allows it once clipboard permission is granted; where
  // it's refused (Safari wants a tap), the field is focused and Paste leads.
  const keyRef = useRef(key);
  keyRef.current = key;
  useEffect(() => {
    if (!opened) return;
    const onBack = async () => {
      if (document.visibilityState !== 'visible' || keyRef.current) return;
      try {
        const text = cleanKey(await navigator.clipboard.readText());
        if (keyProvider(text)) { setKey(text); return; }
      } catch { /* not allowed without a tap */ }
      inputRef.current?.focus({ preventScroll: true });
    };
    void onBack();
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => { window.removeEventListener('focus', onBack); document.removeEventListener('visibilitychange', onBack); };
  }, [opened]);

  return (
    <div className="flex flex-1 flex-col">
      {onBack && (
        <div className="-mt-3 mb-6 flex min-h-[44px] items-center">
          <TextAction className="text-[15px]! text-graphite!" onClick={onBack}>← Back</TextAction>
        </div>
      )}
      <h1 className="ink-bleed anim-rise font-serif text-[30px] leading-[38px] font-medium text-ink">Add your API key</h1>
      <p className="anim-rise mt-3 text-[17px] leading-[27px] text-graphite">Gambit runs on your own key from an AI provider. It stays encrypted on this device.</p>

      <div className="anim-rise mt-10">
        <div className="flex items-end gap-3">
          <input
            ref={inputRef}
            aria-label="API key"
            className={`${inputCls} font-mono text-[16px]! placeholder:font-sans placeholder:text-[17px]`}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your key"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
          />
          {canPaste && !key && <TextAction className="underline underline-offset-[3px]" onClick={() => void paste()}>Paste</TextAction>}
        </div>
        <div className="mt-2.5 min-h-[20px] text-[14px] leading-[20px]" aria-live="polite">
          {status.kind === 'checking' && <span className="text-graphite">{status.label ? `Checking your ${status.label} key…` : 'Checking…'}</span>}
          {status.kind === 'ok' && (
            <span className="anim-fade-in flex items-center gap-1.5 text-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              {status.label ? `${status.label} key works` : 'Key works'}
            </span>
          )}
          {status.kind === 'error' && <span className="anim-fade-in text-accent">{status.text}</span>}
        </div>
      </div>

      <div className="anim-rise mt-8">
        <p className="text-[14px] leading-5 text-graphite">No key yet? Get one from</p>
        <div className="flex flex-wrap gap-x-5">
          {KEY_LINKS.map((l) => (
            <TextAction key={l.label} className="text-[15px]! underline underline-offset-[3px]" onClick={() => getKey(l.url)}>{l.label}</TextAction>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-16">
        {otherProvider ? (
          <div className="anim-rise">
            <h2 className="mb-4 font-serif text-[20px] font-medium text-ink">Custom endpoint</h2>
            <ProviderForm firstRun beforeSave={beforeSave} />
          </div>
        ) : (
          <TextAction className="self-start text-[14px]! text-graphite! underline underline-offset-[3px]" onClick={() => setOtherProvider(true)}>Use a custom endpoint</TextAction>
        )}
      </div>
    </div>
  );
}
