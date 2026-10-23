import { useEffect, useRef, useState } from 'react';
import { dictationSupported, useDictation } from '../lib/dictation';
import {
  getProvider, saveProvider, checkKey, keyProvider, settingsForKey, cleanKey, PROVIDERS, GOOGLE_KEY_URL, OPENROUTER_BASE, KEY_LABEL, originAllowed,
  type KeyCheck, type ProviderKind, type ProviderSettings,
} from '../lib/providers';
import { saveApiKey, hasApiKey, clearApiKey } from '../lib/crypto';
import { track } from '../lib/analytics';
import { startFreeKey, takeFreeKeyReturn, exchangeCode, freeKeyPending, FREE_SETTINGS } from '../lib/freekey';
import { t } from '../lib/i18n';
import { getOnboarding, saveOnboarding, startFromDraft, type Onboarding } from '../lib/onboarding';
import { InkButton, TextAction, Field, inputCls } from './ui';
import { HandMic } from './paper/HandMic';
import { DividerTabs } from './tabs/DividerTabs';
import { TabPanel } from './tabs/TabPanel';
import { TAB_LABELS, type TabId } from './tabs/tabDefs';

const CHECK_TEXT: Record<Exclude<KeyCheck, 'ok'>, string> = {
  bad: t('setup.checkBad'),
  offline: t('setup.checkOffline'),
  unreachable: t('setup.checkUnreachable'),
};

/** Provider, model and key entry. Used under "Other options" on first run and inside Settings. */
export function ProviderForm({ onDone, beforeSave, firstRun }: { onDone?: () => void; beforeSave?: () => Promise<void>; firstRun?: boolean }) {
  const [state, setS] = useState<ProviderSettings>({ kind: firstRun ? 'anthropic' : 'google', model: PROVIDERS[firstRun ? 'anthropic' : 'google'].defaultModel, webSearch: !firstRun });
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
    setS({ kind, model: PROVIDERS[kind].defaultModel, baseURL: undefined, webSearch: kind === 'google' && !firstRun });
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
    return same ? null : { ...next, webSearch: next.kind === 'google' };
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
    if (!s.model.trim()) return setErr(t('setup.errModel'));
    const base = s.baseURL || PROVIDERS[s.kind].baseURL;
    if (s.kind === 'custom' && !base) return setErr(t('setup.errCustomBase'));
    if (base && !originAllowed(base)) return setErr(t('setup.errOrigin', { origin: new URL(base).origin }));
    if (!key && !saved) return setErr(t('setup.errPasteKey'));
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
      track('provider_saved', { provider: s.kind, newKey: !!key });
      setKey('');
      setSaved(true);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label={t('setup.apiKey')} hint={t('setup.apiKeyHint')}>
        <input className={`${inputCls} font-mono`} type="password" autoComplete="off" value={key} onChange={(e) => onKey(e.target.value)} placeholder={saved ? t('setup.keySaved') : t('setup.keyPaste')} />
        {detected && <span className="anim-fade-in block text-[14px] text-ink">{t('setup.keyDetected', { provider: KEY_LABEL[detected] })}</span>}
      </Field>
      <Field label={t('setup.provider')} hint={PROVIDERS[s.kind].help}>
        <select className={inputCls} value={s.kind} onChange={(e) => void change(e.target.value as ProviderKind)}>
          {(Object.keys(PROVIDERS) as ProviderKind[]).filter((k) => !(firstRun && k === 'google')).map((k) => <option key={k} value={k}>{PROVIDERS[k].label}</option>)}
        </select>
      </Field>
      <Field label={t('setup.modelId')}>
        <input className={inputCls} value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} placeholder={s.kind === 'custom' ? t('setup.modelPlaceholderCustom') : t('setup.modelPlaceholder')} />
      </Field>
      {s.kind === 'custom' || showBase ? (
        <Field label={s.kind === 'custom' ? t('setup.baseUrl') : t('setup.baseUrlProxy')} hint={s.kind === 'custom' ? t('setup.baseUrlHintCustom', { url: OPENROUTER_BASE }) : t('setup.baseUrlHintProxy')}>
          <input className={inputCls} value={s.baseURL ?? ''} onChange={(e) => setS({ ...s, baseURL: e.target.value })} placeholder={PROVIDERS[s.kind].baseURL ?? 'https://…/v1'} />
        </Field>
      ) : (
        <TextAction className="text-[14px]! text-graphite! underline underline-offset-[3px]" onClick={() => setShowBase(true)}>{t('setup.customBase')}</TextAction>
      )}
      {(s.kind === 'anthropic' || s.kind === 'google') && !firstRun && (
        <label className="flex items-center gap-2 text-[14px] text-graphite">
          <input type="checkbox" checked={!!s.webSearch} onChange={(e) => setS({ ...s, webSearch: e.target.checked })} />
          {s.kind === 'google' ? t('setup.webSearchGoogle') : t('setup.webSearchAnthropic')}
        </label>
      )}
      {err && (
        <p className="anim-fade-in text-[15px] text-accent">
          {err}{' '}
          {unchecked && <TextAction className="text-[15px]! underline underline-offset-[3px]" onClick={() => void save(true)}>{t('setup.useAnyway')}</TextAction>}
        </p>
      )}
      <div className="flex items-center gap-4">
        <InkButton disabled={busy} onClick={() => void save()}>{busy ? t('setup.checking') : firstRun ? t('setup.continue') : t('setup.save')}</InkButton>
        {saved && !firstRun && <TextAction className="text-graphite underline underline-offset-[3px]" onClick={async () => { await clearApiKey(s.kind); setSaved(false); }}>{t('setup.removeKey')}</TextAction>}
      </div>
    </div>
  );
}

/** First run. With no goals yet: the pitch and the question, then the key.
 * With goals but no working key (it was removed): straight to the key. */
/** The pages ahead, named on their tabs. Each opens to one line saying what
 * will fill it, so the notebook can be looked through before it's started. */
const PREVIEWS: Partial<Record<TabId, string>> = {
  moves: t('setup.preview.moves'),
  people: t('setup.preview.people'),
  risks: t('setup.preview.risks'),
  bets: t('setup.preview.bets'),
  doodles: t('setup.preview.doodles'),
};
const SETUP_TABS: TabId[] = ['goal', 'moves', 'people', 'risks', 'bets', 'doodles', 'inside-cover'];

export function Setup({ hasGoals }: { hasGoals: boolean }) {
  const [o, setO] = useState<Onboarding | null>(null);
  const [peek, setPeek] = useState<TabId | null>(null);
  // Back from OpenRouter's sign-in: the page fades back in as it was, so the
  // trip reads as one step rather than a fresh start.
  const [returning] = useState(freeKeyPending);
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
  const tabs = o.step === 'key' ? SETUP_TABS : SETUP_TABS.filter((x) => x !== 'inside-cover');
  const pick = (x: TabId) => {
    if (x === home) return setPeek(null);
    if (x === 'goal' && !hasGoals) return update({ ...o, step: 'goal' });
    setPeek(x);
  };

  return (
    <div className="min-h-dvh pt-[env(safe-area-inset-top)] md:pt-8">
      {/* The same page sheet as the notebook (Dashboard.tsx): margin rule,
          tabs off the right edge into the desk. */}
      <div
        className={`setup-sheet paper relative ${returning ? 'setup-return anim-fade-in' : ''} mx-auto mr-9 flex min-h-dvh max-w-xl flex-col rounded-t-[3px] md:mr-auto md:min-h-[calc(100dvh-2rem)] md:shadow-[0_1px_1px_var(--lift),0_8px_30px_-8px_var(--lift-far)]`}
        style={{ borderLeft: '2px solid var(--margin-rule)' }}
      >
        <DividerTabs tabs={tabs} active={active} onChange={pick} changedTabs={new Set()} />
        <div className="flex flex-1 flex-col px-8.5 pt-10 md:px-16 md:pt-14" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {peek && PREVIEWS[peek] ? (
            <TabPanel tab={peek} active>
              <Preview tab={peek} line={PREVIEWS[peek]!} back={o.step === 'goal' ? t('setup.backToGoal') : t('setup.backToKey')} onBack={() => setPeek(null)} />
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
        .setup-sheet.setup-return .tab-leaf { animation: none; }
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
      <p className="hand mt-6 text-[20px]!">{t('setup.fillsIn')}</p>
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
        <span className="text-[15px] leading-[26px] text-graphite">{t('setup.tagline')}</span>
      </div>

      <div className="anim-rise mt-16 md:mt-24">
        <h1 className="ink-bleed font-serif text-[30px] leading-[38px] font-medium text-balance text-ink">
          <label htmlFor="first-goal">{t('setup.goalQuestion')}</label>
        </h1>
        <textarea
          id="first-goal"
          ref={ref}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && ready) next(); }}
          placeholder={dictation.listening ? t('setup.listening') : t('setup.goalPlaceholder')}
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
            {dictation.listening ? t('setup.stopListening') : t('setup.talkItOut')}
          </button>
        )}
        <InkButton className={canDictate ? 'mt-8' : 'mt-12'} disabled={!ready} onClick={next}>{t('setup.continue')}</InkButton>
      </div>

      <p className="hand mt-auto pt-16 text-[20px]! leading-[26px]!">{t('setup.nextAddKey')}</p>
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
  | { kind: 'checking'; label?: string; text?: string }
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

  async function commit(s: ProviderSettings, k: string, source?: string) {
    await beforeSave?.();
    await saveApiKey(s.kind, k);
    await saveProvider(s);
    track('provider_saved', { provider: s.kind, newKey: true, ...(source ? { source } : {}) });
  }

  async function verify(s: ProviderSettings, k: string, label: string, source?: string, id = ++run.current) {
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
    if (id === run.current) await commit(s, k, source);
  }

  // The free key: off to OpenRouter's sign-in, and back with a code to trade.
  const [free, setFree] = useState<'idle' | 'leaving' | 'cancelled' | 'failed'>('idle');
  const tookReturn = useRef(false);
  useEffect(() => {
    const back = async () => {
      const r = takeFreeKeyReturn();
      if (!r) return setFree('idle');
      if (r.kind === 'cancelled') {
        track('free_key', { step: 'cancelled' });
        return setFree('cancelled');
      }
      const id = ++run.current;
      setStatus({ kind: 'checking', text: t('setup.free.signingIn') });
      const k = await exchangeCode(r.code, r.verifier);
      if (id !== run.current) return;
      if (!k) {
        track('free_key', { step: 'failed' });
        setStatus({ kind: 'idle' });
        return setFree('failed');
      }
      await verify(FREE_SETTINGS, k, KEY_LABEL.openrouter, 'openrouter_oauth', id);
    };
    if (!tookReturn.current) { tookReturn.current = true; void back(); }
    // The back button from OpenRouter can restore this page from the cache.
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) void back(); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getFreeKey() {
    setFree('leaving');
    track('free_key', { step: 'start' });
    // A beat for the page to fade before it goes.
    await new Promise((res) => setTimeout(res, 250));
    try { await startFreeKey(); } catch { setFree('failed'); }
  }

  // Checked on paste or typing, once the key is long enough to be one. Only
  // a change to the field cancels a check in flight: a rerun with the same
  // text (StrictMode's mount) mustn't drop the free key being fetched.
  const lastKey = useRef(key);
  useEffect(() => {
    if (key === lastKey.current) return;
    lastKey.current = key;
    const k = cleanKey(key);
    run.current++;
    if (k.length < 20) { setStatus({ kind: 'idle' }); return; }
    const p = keyProvider(k);
    if (!p) { setStatus({ kind: 'error', text: t('setup.errUnknownKey') }); return; }
    const timer = setTimeout(() => void verify(settingsForKey(p), k, KEY_LABEL[p]), 350);
    return () => clearTimeout(timer);
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

  // Two ways in, one open at a time. Back from OpenRouter, the free one is
  // open already; back from getting a key, the key one.
  const [choice, setChoice] = useState<'key' | 'free' | null>(() => (freeKeyPending() ? 'free' : opened ? 'key' : null));
  const pickChoice = (c: 'key' | 'free') => setChoice((cur) => (cur === c ? null : c));

  const statusLine = (
    <div className="mt-2.5 min-h-[20px] text-[14px] leading-[20px]" aria-live="polite">
      {status.kind === 'checking' && <span className="anim-fade-in text-graphite">{status.text ?? (status.label ? t('setup.checkingKey', { provider: status.label }) : t('setup.checking'))}</span>}
      {status.kind === 'ok' && (
        <span className="anim-fade-in flex items-center gap-1.5 text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          {status.label ? t('setup.keyWorks', { provider: status.label }) : t('setup.keyWorksPlain')}
        </span>
      )}
      {status.kind === 'error' && <span className="anim-fade-in text-accent">{status.text}</span>}
    </div>
  );

  return (
    <div className={`flex flex-1 flex-col motion-safe:transition-opacity motion-safe:duration-300 ${free === 'leaving' ? 'opacity-40' : ''}`}>
      {onBack && (
        <div className="-mt-3 mb-6 flex min-h-[44px] items-center">
          <TextAction className="text-[15px]! text-graphite!" onClick={onBack}>{t('setup.back')}</TextAction>
        </div>
      )}
      <h1 className="ink-bleed anim-rise font-serif text-[30px] leading-[38px] font-medium text-ink">{t('setup.connect')}</h1>

      <div className="anim-rise mt-10 border-b border-card-rule">
        <Choice open={choice === 'key'} onToggle={() => pickChoice('key')} title={t('setup.byok.title')} line={t('setup.byok.line')}>
          <div className="flex items-end gap-3">
            <input
              ref={inputRef}
              aria-label={t('setup.apiKey')}
              className={`${inputCls} font-mono text-[16px]! placeholder:font-sans placeholder:text-[17px]`}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t('setup.keyPaste')}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
            {canPaste && !key && <TextAction className="underline underline-offset-[3px]" onClick={() => void paste()}>{t('setup.paste')}</TextAction>}
          </div>
          {choice === 'key' && statusLine}
          <p className="mt-6 text-[14px] leading-5 text-graphite">{t('setup.getOne')}</p>
          <div className="flex flex-wrap gap-x-5">
            {KEY_LINKS.map((l) => (
              <TextAction key={l.label} className="text-[15px]! underline underline-offset-[3px]" onClick={() => getKey(l.url)}>{l.label}</TextAction>
            ))}
          </div>
          <div className="mt-4">
            {otherProvider ? (
              <div className="anim-rise mt-4">
                <h2 className="mb-4 font-serif text-[20px] font-medium text-ink">{t('setup.customEndpoint')}</h2>
                <ProviderForm firstRun beforeSave={beforeSave} />
              </div>
            ) : (
              <TextAction className="text-[14px]! text-graphite! underline underline-offset-[3px]" onClick={() => setOtherProvider(true)}>{t('setup.customEndpoint')}</TextAction>
            )}
          </div>
        </Choice>

        <Choice open={choice === 'free'} onToggle={() => pickChoice('free')} title={t('setup.free.title')} line={t('setup.free.line')}>
          <InkButton disabled={free === 'leaving'} onClick={() => void getFreeKey()}>
            {free === 'leaving' ? t('setup.free.leaving') : free === 'idle' ? t('setup.free.button') : t('setup.free.retry')}
          </InkButton>
          {free === 'cancelled' || free === 'failed' ? (
            <p role="status" className="anim-fade-in mt-2.5 text-[14px] leading-[20px] text-accent">{free === 'cancelled' ? t('setup.free.cancelled') : t('setup.free.failed')}</p>
          ) : choice === 'free' && statusLine}
          <p className="mt-4 text-[14px] leading-5 text-graphite">{t('setup.free.note')}</p>
        </Choice>
      </div>
    </div>
  );
}

/** One way in: a row to pick, and what it needs folded open beneath it. */
function Choice({ open, onToggle, title, line, children }: { open: boolean; onToggle: () => void; title: string; line: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-card-rule">
      <button type="button" aria-expanded={open} onClick={onToggle} className="anim-press group flex w-full items-start gap-3 py-4 text-left">
        <span aria-hidden="true" className={`mt-[8px] h-3 w-3 flex-none rounded-full border-[1.5px] border-ink motion-safe:transition-colors ${open ? 'bg-ink' : 'bg-transparent'}`} />
        <span className="flex-1">
          <span className="block text-[18px] leading-[26px] font-medium text-ink">{title}</span>
          <span className="block text-[15px] leading-[22px] text-graphite group-hover:text-ink">{line}</span>
        </span>
      </button>
      {/* Rows 0fr → 1fr, so the panel opens to its own height. */}
      <div className="grid motion-safe:transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className={`pb-6 pl-6 motion-safe:transition-opacity motion-safe:duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
