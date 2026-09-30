import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { runTurn, undoTurn, clearChat } from '../lib/agent';
import { TextAction } from './ui';
import { useTornEdge } from './marks/torn';
import { Md } from './Md';

interface Draft { text: string; tools: { id: string; label: string; ok?: boolean }[] }

/** A pencil ring until there's text to send, then an ink circle. */
function SendButton({ ready, busy, onClick }: { ready: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={busy ? 'Stop' : 'Send'}
      onClick={onClick}
      disabled={!ready && !busy}
      className={`grid h-9 w-9 flex-none place-items-center rounded-full disabled:cursor-default ${
        ready || busy ? 'bg-ink text-bg' : 'text-graphite shadow-[inset_0_0_0_1.2px_var(--graphite)]'
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {busy ? <rect x="6" y="6" width="12" height="12" rx="1.5" /> : <><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>}
      </svg>
    </button>
  );
}

/** Plain-language names for goal keys, for the "wrote to your page" line. */
const KEY_WORDS: Record<string, string> = {
  successCriteria: 'what done looks like',
  people: 'people',
  posture: 'posture',
  plan: 'the plan',
  systemsNotes: 'systems notes',
  riskNotes: 'risks',
  decisions: 'decisions',
  stakeholders: 'stakeholders',
  exposure: 'exposure',
  capacity: 'capacity',
  forecasts: 'forecasts',
  experiments: 'experiments',
  criteriaStatus: 'progress',
};

function plainSummary(items: string[]): string[] {
  return items.map((s) => {
    for (const [key, word] of Object.entries(KEY_WORDS)) {
      const re = new RegExp(`\\b${key}\\b`, 'i');
      if (re.test(s)) return s.replace(re, word);
    }
    return s;
  });
}

interface ChatProps {
  goalId: string;
  stub: boolean;
  /** 'desktop': the leaf always shows, laid along the right. 'mobile': a
   * floating overlay, collapsed to its composer slip by default. */
  variant: 'desktop' | 'mobile';
  /** Mobile only: whether the conversation overlay is expanded. */
  open: boolean;
  /** Mobile only: collapse the overlay back to just the composer. */
  onCollapse: () => void;
  /** Mobile only: called when the user taps into the collapsed composer, so
   * the overlay expands before they start typing. */
  onExpand: () => void;
}

export function Chat({ goalId, stub, variant, open, onCollapse, onExpand }: ChatProps) {
  const chat = useLiveQuery(() => db.chats.get(goalId), [goalId]);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  useTornEdge(composerRef, goalId, 'top');
  useTornEdge(leafRef, `${goalId}:leaf`, 'top');
  const busy = draft !== null;
  const display = chat?.display ?? [];
  const lastUndoable = [...display].reverse().find((m) => m.role === 'assistant' && m.snapshotId);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [display.length, draft?.text, draft?.tools.length]);
  useEffect(() => { setInput(''); setError(''); }, [goalId]);

  // The index card's "Not yet" / "Something changed" dispatch this event
  // with the drafted text; fill the composer and focus it (App.tsx handles
  // expanding the overlay on mobile).
  useEffect(() => {
    const onCompose = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (!detail) return;
      setInput(detail.text);
      // Desktop and mobile both mount a Chat instance (one hidden via
      // `md:block` / `md:hidden`); only focus the one that's actually
      // visible. On mobile the overlay may still be expanding (App.tsx's own
      // `gambit:compose` listener flips `chatOpen`), so retry across a
      // couple of frames rather than a single rAF.
      let tries = 0;
      const tryFocus = () => {
        const el = inputRef.current;
        if (el && el.offsetParent !== null) { el.focus(); return; }
        if (++tries < 10) requestAnimationFrame(tryFocus);
      };
      requestAnimationFrame(tryFocus);
    };
    window.addEventListener('gambit:compose', onCompose);
    return () => window.removeEventListener('gambit:compose', onCompose);
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    setDraft({ text: '', tools: [] });
    abort.current = new AbortController();
    try {
      await runTurn({
        goalId, text, signal: abort.current.signal,
        onEvent: (e) =>
          setDraft((d) => {
            if (!d) return d;
            if (e.type === 'text') return { ...d, text: e.text };
            const has = d.tools.some((t) => t.id === e.id);
            return { ...d, tools: has ? d.tools.map((t) => (t.id === e.id ? { ...t, ok: e.ok } : t)) : [...d.tools, { id: e.id, label: e.label, ok: e.ok }] };
          }),
      });
    } catch (e) {
      setError((e as Error).message);
      setInput(text);
    } finally {
      setDraft(null);
    }
  }

  const composer = (
    <div
      ref={composerRef}
      style={{
        filter: 'drop-shadow(0 -2px 2px var(--lift-far)) drop-shadow(0 -8px 14px var(--lift-far))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        clipPath: 'var(--torn, none)',
      }}
      className="slip -mx-px px-5 pt-4"
    >
      <div className="flex items-center gap-3 border-b border-card-rule py-2.5 focus-within:border-ink">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => { if (variant === 'mobile') onExpand(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
          placeholder={variant === 'desktop' || open ? "What's your next move?" : 'Think out loud…'}
          aria-label="Message"
          className="min-w-0 flex-1 border-0 bg-transparent py-2 font-sans text-[17px] text-ink placeholder:font-hand placeholder:text-[23px] placeholder:text-graphite focus:outline-none"
        />
        <SendButton ready={!!input.trim()} busy={busy} onClick={() => { if (variant === 'mobile') onExpand(); busy ? abort.current?.abort() : void send(); }} />
      </div>
      {(variant === 'desktop' || open) && display.length > 0 && !busy && (
        <TextAction className="!min-h-0 mt-2 text-[14px] text-graphite underline underline-offset-[3px]" onClick={() => confirm('Clear this chat? The goal itself is kept.') && void clearChat(goalId)}>
          Clear chat
        </TextAction>
      )}
    </div>
  );

  const conversation = (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6">
      {display.length === 0 && !busy && (
        <p className="mx-auto mt-10 max-w-sm text-center text-[14px] text-graphite">
          {stub ? 'Tell me what you want to achieve, as much or as little as you have.' : 'Ask for a status, a next step, or a hard question about the plan.'}
        </p>
      )}
      {display.map((m) =>
        m.role === 'user' ? (
          <p key={m.id} className="mt-6 border-l-[1.5px] border-graphite/55 pl-[18px] text-[17px] leading-[27px] font-medium whitespace-pre-wrap text-ink">
            {m.text}
          </p>
        ) : (
          <div key={m.id} className="mt-8 space-y-2">
            {m.text && <Md text={m.text} />}
            {m.error && <p className="text-[15px] text-accent">{m.error}</p>}
            {(m.tools?.length ?? 0) > 0 && (
              <p className="hand text-[16px]">{m.tools!.map((t) => t.label).join(' · ')}</p>
            )}
            {(m.summary?.length ?? 0) > 0 && (
              <p className="hand mt-6 flex flex-wrap items-center gap-2 text-[16px]">
                <span>wrote to your page: {plainSummary(m.summary!).join(' · ')}</span>
                {m.id === lastUndoable?.id && !m.undone && !busy && (
                  <TextAction className="!min-h-0 font-sans text-[14px] not-italic underline underline-offset-[3px]" onClick={() => void undoTurn(goalId, m.id)}>
                    undo
                  </TextAction>
                )}
                {m.undone && <span>undone</span>}
              </p>
            )}
            {m.error && (m.summary?.length ?? 0) === 0 && m.id === lastUndoable?.id && !m.undone && (
              <p className="text-[14px] text-graphite">No goal changes were applied.</p>
            )}
            {m.error && (m.summary?.length ?? 0) > 0 && (
              <p className="text-[14px] text-graphite">Partial progress was kept; Undo rolls the whole turn back.</p>
            )}
          </div>
        ),
      )}
      {draft && (
        <div className="mt-8 space-y-2">
          {draft.text ? <Md text={draft.text} /> : <p className="text-[14px] text-graphite">Thinking…</p>}
          {draft.tools.length > 0 && <p className="hand text-[16px]">{draft.tools.map((t) => t.label).join(' · ')}</p>}
        </div>
      )}
      {error && <p className="text-[15px] text-accent">{error}</p>}
      <div ref={end} />
    </div>
  );

  // Desktop: always the full leaf, laid along the right with its own
  // shadow (brand/identity.md §05). The shadow is a drop-shadow on this
  // wrapper, since the leaf's torn top edge is a clip-path that would
  // otherwise cut a box-shadow off.
  if (variant === 'desktop') {
    return (
      <div
        className="flex h-full min-h-0 flex-col"
        style={{ filter: 'drop-shadow(-1px 0 1px var(--lift)) drop-shadow(-12px 0 30px -12px var(--lift-far))' }}
      >
        <div className="slip flex h-full min-h-0 flex-col">
          {conversation}
          {composer}
        </div>
      </div>
    );
  }

  // Mobile: collapsed shows just the composer slip, sticky at the bottom of
  // the page; expanded is a full-screen leaf over the page with a torn top
  // edge, closed by an explicit control.
  if (!open) {
    return <div className="fixed inset-x-0 bottom-0 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>{composer}</div>;
  }

  return (
    // A sliver of the page stays visible above the leaf (brand/identity.md
    // §09: "with the next move faintly visible above it") — this overlay
    // starts 84px down rather than covering the full screen, leaving the
    // real page underneath showing through that gap.
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col motion-safe:animate-[leaf-in_0.22s_ease-out]"
      style={{ top: 'calc(84px + env(safe-area-inset-top))' }}
    >
      <div
        ref={leafRef}
        className="slip flex min-h-0 flex-1 flex-col pt-9"
        style={{ filter: 'drop-shadow(0 -1px 1px var(--lift)) drop-shadow(0 -10px 18px var(--lift-far))', clipPath: 'var(--torn, none)' }}
      >
        <div className="flex items-center justify-between px-5 pt-2">
          <span className="text-[14px] text-graphite">Conversation</span>
          <button
            onClick={onCollapse}
            aria-label="Back to your page"
            className="grid h-11 w-11 place-items-center text-graphite hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {conversation}
        {composer}
      </div>
    </div>
  );
}
