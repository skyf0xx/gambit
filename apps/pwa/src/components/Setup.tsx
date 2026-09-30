import { useState } from 'react';
import { getProvider, saveProvider, PROVIDERS, originAllowed, type ProviderKind, type ProviderSettings } from '../lib/providers';
import { saveApiKey, hasApiKey, clearApiKey } from '../lib/crypto';
import { InkButton, TextAction, Field, inputCls } from './ui';
import { useEffect } from 'react';

/** Provider, model and key entry. Used for first run and inside Settings. */
export function ProviderForm({ onDone }: { onDone?: () => void }) {
  const [s, setS] = useState<ProviderSettings>({ kind: 'anthropic', model: PROVIDERS.anthropic.defaultModel });
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    void (async () => {
      const p = await getProvider();
      if (p) { setS(p); setSaved(await hasApiKey(p.kind)); }
    })();
  }, []);

  const change = async (kind: ProviderKind) => {
    setS({ kind, model: PROVIDERS[kind].defaultModel, baseURL: undefined, webSearch: false });
    setSaved(await hasApiKey(kind));
    setKey('');
  };

  async function save() {
    setErr('');
    if (!s.model.trim()) return setErr('Add a model (the default is fine).');
    const base = s.baseURL || PROVIDERS[s.kind].baseURL;
    if (s.kind === 'custom' && !base) return setErr('A custom provider needs a base URL.');
    if (base && !originAllowed(base)) return setErr(`${new URL(base).origin} isn't in this build's allowed origins. Self-hosters can add it with VITE_EXTRA_CONNECT_SRC at build time.`);
    if (!key && !saved) return setErr('Paste your API key to continue.');
    if (key) await saveApiKey(s.kind, key);
    await saveProvider({ ...s, baseURL: s.baseURL || undefined });
    setKey('');
    setSaved(true);
    onDone?.();
  }

  return (
    <div className="space-y-4">
      <Field label="Provider" hint={PROVIDERS[s.kind].help}>
        <select className={inputCls} value={s.kind} onChange={(e) => void change(e.target.value as ProviderKind)}>
          {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </Field>
      <Field label="Model id">
        <input className={inputCls} value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} placeholder="model id" />
      </Field>
      <Field label={saved ? 'API key (saved; leave blank to keep)' : 'API key'} hint="Encrypted on this device and sent only to the provider you selected.">
        <input className={inputCls} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={saved ? '••••••••••••' : 'sk-…'} />
      </Field>
      <Field label={s.kind === 'custom' ? 'Base URL' : 'Proxy / base URL (optional)'} hint="Needed for providers without browser CORS support.">
        <input className={inputCls} value={s.baseURL ?? ''} onChange={(e) => setS({ ...s, baseURL: e.target.value })} placeholder={PROVIDERS[s.kind].baseURL ?? 'https://…/v1'} />
      </Field>
      {s.kind === 'anthropic' && (
        <label className="flex items-center gap-2 text-[14px] text-graphite">
          <input type="checkbox" checked={!!s.webSearch} onChange={(e) => setS({ ...s, webSearch: e.target.checked })} />
          Allow provider-side web search (billed by Anthropic)
        </label>
      )}
      {err && <p className="anim-fade-in text-[15px] text-accent">{err}</p>}
      <div className="flex items-center gap-4">
        <InkButton onClick={() => void save()}>Save</InkButton>
        {saved && <TextAction className="text-graphite underline underline-offset-[3px]" onClick={async () => { await clearApiKey(s.kind); setSaved(false); }}>Remove key</TextAction>}
      </div>
    </div>
  );
}

export function Setup() {
  return (
    <div className="paper mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="anim-rise">
        <h1 className="font-serif text-[29px] leading-[37px] font-medium text-ink ink-bleed">Gambit</h1>
        <p className="mt-2 text-[14px] text-graphite">
          Strategy and planning with your own model key. Everything stays on this device: your goals, your chats and your key. There's no account and no server.
        </p>
      </div>
      <div className="anim-rise">
        <ProviderForm />
      </div>
    </div>
  );
}
