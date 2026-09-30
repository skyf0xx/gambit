import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { runTurn, undoTurn, clearChat } from '../lib/agent';
import { TextAction } from './ui';
import { useTornEdge } from './marks/torn';
import { Md } from './Md';

interface Draft { text: string; tools: { id: string; label: string; ok?: boolean }[] }

const REDUCED_MOTION = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Matches styles.css's .anim-sheet-down duration; 0 under reduced motion. */
const SHEET_DOWN_MS = () => (REDUCED_MOTION() ? 0 : 200);

/** Plain, present-participle names for the working skill, matching
 * desktop.html's "Pressure-testing" over the leaf while a turn runs.
 * Falls back to a capitalized skill name for anything not in the catalogue
 * (see AGENTS.md's skill table). */
const SKILL_VERBS: Record<string, string> = {
  onboard: 'Getting oriented',
  intake: 'Getting oriented',
  brief: 'Reading back',
  status: 'Checking status',
  strategy: 'Setting strategy',
  systems: 'Finding the leverage point',
  plan: 'Sequencing the plan',
  decide: 'Working the decision',
  experiment: 'Designing a test',
  forecast: 'Sharpening the forecast',
  threat: 'Red-teaming the plan',
  premortem: 'Stipulating failure',
  exposure: 'Assessing exposure',
  capacity: 'Checking capacity',
  stakeholders: 'Mapping stakeholders',
  negotiate: 'Prepping the negotiation',
  comms: 'Sharpening the message',
  eval: 'Auditing progress',
  review: 'Reviewing what happened',
  elicit: 'Pressure-testing',
};

function skillVerb(name: string): string {
  return SKILL_VERBS[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

/** A tool-event label of the shape `skill: <name>` (see lib/tools.ts's
 * load_skill label), if any, from the running draft's tool list. */
function activeSkillFrom(tools: Draft['tools']): string | null {
  for (let i = tools.length - 1; i >= 0; i--) {
    const m = /^skill:\s*(\S+)/.exec(tools[i].label);
    if (m) return m[1];
  }
  return null;
}

/** A pencil ring until there's text to send, then an ink circle. */
function SendButton({ ready, busy, onClick }: { ready: boolean; busy: boolean; onClick: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      aria-label={busy ? 'Stop' : 'Send'}
      data-note={busy ? 'Stop' : 'Send'}
      onClick={() => { setPressed(true); onClick(); }}
      onAnimationEnd={() => setPressed(false)}
      disabled={!ready && !busy}
      className={`grid h-9 w-9 flex-none place-items-center rounded-full transition-[background-color,box-shadow] duration-150 disabled:cursor-default ${pressed ? 'anim-press' : ''} ${
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
  const [multiline, setMultiline] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [closing, setClosing] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  useTornEdge(composerRef, goalId, 'top');
  useTornEdge(leafRef, `${goalId}:leaf`, 'top');
  const busy = draft !== null;
  const display = chat?.display ?? [];
  const lastUndoable = [...display].reverse().find((m) => m.role === 'assistant' && m.snapshotId);
  const workingSkill = busy ? activeSkillFrom(draft.tools) : null;

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    end.current?.scrollIntoView({ block: 'end', behavior });
    stickToBottom.current = true;
    setShowJump(false);
  };

  // Track whether the user has scrolled away from the bottom, so new
  // content doesn't yank them back down mid-read.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      stickToBottom.current = atBottom;
      if (atBottom) setShowJump(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [variant, open]);

  // Autoscroll on new messages / streamed text, unless the user has
  // scrolled up to read something earlier.
  useEffect(() => {
    if (stickToBottom.current) end.current?.scrollIntoView({ block: 'end' });
    else if (display.length > 0 || draft) setShowJump(true);
  }, [display.length, draft?.text, draft?.tools.length]);

  useEffect(() => { setInput(''); setError(''); }, [goalId]);

  // Reset the "closing" flag whenever the overlay is (re)opened.
  useEffect(() => { if (open) setClosing(false); }, [open]);

  // On mobile expand, scroll to the bottom and focus the input once the
  // overlay has actually laid out (its content is 0-height for a frame).
  const focusAndScrollOnExpand = () => {
    let tries = 0;
    const tick = () => {
      const el = inputRef.current;
      const ready = el && el.offsetParent !== null;
      if (ready) {
        scrollToBottom();
        el.focus();
        return;
      }
      if (++tries < 12) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (variant === 'mobile' && open) focusAndScrollOnExpand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, open]);

  // The index card's "Not yet" / "Something changed" dispatch this event
  // with the drafted text; fill the composer and focus it (App.tsx handles
  // expanding the overlay on mobile).
  useEffect(() => {
    const onCompose = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (!detail) return;
      setInput(detail.text);
      focusAndScrollOnExpand();
    };
    window.addEventListener('gambit:compose', onCompose);
    return () => window.removeEventListener('gambit:compose', onCompose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes the mobile overlay and returns focus to the collapsed
  // composer.
  useEffect(() => {
    if (variant !== 'mobile' || !open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, open]);

  // Lock page scroll behind the overlay while it's open.
  useEffect(() => {
    if (variant !== 'mobile' || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [variant, open]);

  // Trap focus inside the overlay while it's open (Chat's own mobile
  // overlay isn't the shared Leaf primitive, so it needs this itself).
  useEffect(() => {
    if (variant !== 'mobile' || !open) return;
    const el = leafRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = el.querySelectorAll<HTMLElement>('button, input, textarea, a[href], [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [variant, open]);

  function requestClose() {
    setClosing(true);
    window.setTimeout(() => {
      onCollapse();
      setClosing(false);
      collapsedRef.current?.querySelector('input,textarea')?.dispatchEvent(new FocusEvent('focus'));
      (collapsedRef.current?.querySelector('input,textarea') as HTMLElement | null)?.focus();
    }, SHEET_DOWN_MS());
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMultiline(false);
    setError('');
    setDraft({ text: '', tools: [] });
    stickToBottom.current = true;
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

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      // Shift+Enter makes a newline only once the field is already
      // behaving as a textarea (multi-line content present); otherwise
      // Enter sends, matching the single-line composer's usual behaviour.
      if (multiline && e.shiftKey) return;
      e.preventDefault();
      void send();
    }
  }

  const PLACEHOLDER = 'Reply to keep thinking…';

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
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={input}
            rows={Math.min(6, input.split('\n').length)}
            onChange={(e) => { setInput(e.target.value); setMultiline(e.target.value.includes('\n')); }}
            onFocus={() => { if (variant === 'mobile') onExpand(); }}
            onKeyDown={onInputKeyDown}
            placeholder={PLACEHOLDER}
            aria-label="Message"
            className="min-w-0 flex-1 resize-none border-0 bg-transparent py-2 font-sans text-[17px] text-ink placeholder:font-hand placeholder:text-[23px] placeholder:text-graphite focus:outline-none"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={input}
            onChange={(e) => { setInput(e.target.value); setMultiline(e.target.value.includes('\n')); }}
            onFocus={() => { if (variant === 'mobile') onExpand(); }}
            onKeyDown={onInputKeyDown}
            placeholder={PLACEHOLDER}
            aria-label="Message"
            className="min-w-0 flex-1 border-0 bg-transparent py-2 font-sans text-[17px] text-ink placeholder:font-hand placeholder:text-[23px] placeholder:text-graphite focus:outline-none"
          />
        )}
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
    <div ref={scrollRef} className="relative min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6">
      {(busy || workingSkill) && (
        <p className="text-[14px] leading-5">
          {workingSkill ? (
            <span className="text-accent">{skillVerb(workingSkill)}</span>
          ) : (
            <span className="hand anim-pulse text-[16px]">thinking…</span>
          )}
        </p>
      )}
      {display.length === 0 && !busy && (
        <p className="mx-auto mt-10 max-w-sm text-center text-[14px] text-graphite">
          {stub ? 'Tell me what you want to achieve, as much or as little as you have.' : 'Ask for a status, a next step, or a hard question about the plan.'}
        </p>
      )}
      {display.map((m) =>
        m.role === 'user' ? (
          <p key={m.id} className="anim-rise mt-6 border-l-[1.5px] border-graphite/55 pl-[18px] text-[17px] leading-[27px] font-medium whitespace-pre-wrap text-ink">
            {m.text}
          </p>
        ) : (
          <div key={m.id} className="anim-rise mt-8 space-y-2">
            {m.text && <Md text={m.text} />}
            {m.error && <p className="anim-fade-in text-[15px] text-accent">{m.error}</p>}
            {(m.tools?.length ?? 0) > 0 && (
              <p className="hand text-[16px]">{m.tools!.map((t) => t.label).join(' · ')}</p>
            )}
            {(m.summary?.length ?? 0) > 0 && (
              <p className="hand anim-write mt-6 flex flex-wrap items-center gap-2 text-[16px]">
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
        <div className="anim-rise mt-8 space-y-2">
          {draft.text ? <Md text={draft.text} /> : !workingSkill && <p className="hand anim-pulse text-[16px]">thinking…</p>}
          {draft.tools.length > 0 && <p className="hand text-[16px]">{draft.tools.map((t) => t.label).join(' · ')}</p>}
        </div>
      )}
      {error && (
        <p className="anim-fade-in text-[15px] text-accent">{error}</p>
      )}
      <div ref={end} />
      {showJump && (
        <div className="sticky bottom-0 flex justify-center pb-1">
          <TextAction
            className="hand !min-h-[32px] rounded-full border border-rule bg-surface px-3 py-1 text-[16px] shadow-[0_1px_1px_var(--lift)]"
            onClick={() => scrollToBottom('smooth')}
          >
            ↓ latest
          </TextAction>
        </div>
      )}
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
  // edge, closed by an explicit control. The collapsed composer's own
  // height is reserved as bottom padding on the page (App.tsx) so it never
  // covers the page's last content.
  if (!open && !closing) {
    return <div ref={collapsedRef} className="fixed inset-x-0 bottom-0 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>{composer}</div>;
  }

  return (
    // A sliver of the page stays visible above the leaf (brand/identity.md
    // §09: "with the next move faintly visible above it") — this overlay
    // starts 84px down rather than covering the full screen, leaving the
    // real page underneath showing through that gap.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conversation"
      className={`fixed inset-x-0 bottom-0 z-30 flex flex-col ${closing ? 'anim-sheet-down' : 'anim-sheet-up'}`}
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
            onClick={requestClose}
            aria-label="Back to your page"
            data-note="Back to your page"
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
