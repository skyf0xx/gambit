import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { runTurn, undoTurn } from '../lib/agent';
import { TextAction } from './ui';
import { useTornEdge } from './marks/torn';
import { COMPOSE_EVENT } from '../lib/compose';
import { takePendingSend } from '../lib/onboarding';
import { Md } from './Md';
import { HandMic } from './paper/HandMic';
import { dictationSupported, useDictation } from '../lib/dictation';

interface Draft { text: string; tools: { id: string; label: string; ok?: boolean }[] }

const REDUCED_MOTION = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Matches styles.css's .anim-sheet-down duration; 0 under reduced motion. */
const SHEET_DOWN_MS = () => (REDUCED_MOTION() ? 0 : 200);

/** A phone or tablet with no hardware keyboard in charge: there the
 * keyboard's return key makes a new line and the send button sends, as in
 * any messaging app. */
const TOUCH_FIRST = () => typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/** The composer grows with its text up to this many lines, then scrolls. */
const MAX_LINES = 8;
const LINE_PX = 27;

// The unsent message for each goal, kept in this browser so it survives
// closing the conversation, switching goals and reloading. A convenience
// only: if storage is unavailable the composer just starts empty.
const draftKey = (goalId: string) => `gambit:draft:${goalId}`;
function loadDraft(goalId: string): string {
  try { return localStorage.getItem(draftKey(goalId)) ?? ''; } catch { return ''; }
}
function saveDraft(goalId: string, text: string) {
  try {
    if (text) localStorage.setItem(draftKey(goalId), text);
    else localStorage.removeItem(draftKey(goalId));
  } catch { /* storage unavailable; the draft just isn't kept */ }
}

/** Puts a newline at the caret. `insertText` keeps the browser's own undo
 * history and fires a normal input event; the fallback splices the value
 * directly where that command isn't supported. */
function insertNewline(el: HTMLTextAreaElement, set: (v: string) => void) {
  if (document.execCommand?.('insertText', false, '\n')) return;
  const { selectionStart: a, selectionEnd: b, value } = el;
  set(`${value.slice(0, a)}\n${value.slice(b)}`);
  requestAnimationFrame(() => el.setSelectionRange(a + 1, a + 1));
}

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
      // A 44×44 hit area (padding around a 36×36 visible circle) so the tap
      // target meets the minimum without growing the ring itself.
      className="grid h-11 w-11 flex-none place-items-center disabled:cursor-default"
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-full transition-[background-color,box-shadow] duration-150 ${pressed ? 'anim-press' : ''} ${
          ready || busy ? 'bg-ink text-bg' : 'text-graphite shadow-[inset_0_0_0_1.2px_var(--graphite)]'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {busy ? <rect x="6" y="6" width="12" height="12" rx="1.5" /> : <><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>}
        </svg>
      </span>
    </button>
  );
}

/** Dictation on and off. Pencil when idle; while listening, the accent and
 * a slow pulse, since it's the one thing on the screen that's live. Only
 * rendered where the browser can dictate. */
export function MicButton({ listening, onClick }: { listening: boolean; onClick: () => void }) {
  const label = listening ? 'Stop dictating' : 'Dictate';
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={listening}
      data-note={listening ? 'Stop dictating' : "Dictate · your browser's speech service writes it out"}
      onClick={onClick}
      className="anim-press grid h-11 w-11 flex-none place-items-center"
    >
      <HandMic className={listening ? 'anim-pulse text-accent' : 'pencil hover:text-ink'} />
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
  const [input, setInputState] = useState(() => loadDraft(goalId));
  const setInput = (v: string) => { setInputState(v); saveDraft(goalId, v); };
  const [canDictate] = useState(dictationSupported);
  const [voiceNote, setVoiceNote] = useState('');
  const dictation = useDictation({ onText: setInput, onError: setVoiceNote });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [closing, setClosing] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  useTornEdge(composerRef, goalId, 'top');
  useTornEdge(leafRef, `${goalId}:leaf`, 'top');
  const busy = draft !== null;
  const display = chat?.display ?? [];
  const lastUndoable = [...display].reverse().find((m) => m.role === 'assistant' && m.snapshotId);
  const workingSkill = busy ? activeSkillFrom(draft.tools) : null;
  const hasContent = useRef(false);
  hasContent.current = display.length > 0 || !!draft;

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
      setShowJump(!atBottom && hasContent.current);
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

  useEffect(() => { dictation.cancel(); setInputState(loadDraft(goalId)); setError(''); setVoiceNote(''); }, [goalId]);

  // Grow the composer with its text, up to MAX_LINES, then let it scroll.
  // Runs again when the composer remounts between the collapsed slip and
  // the open overlay. Skipped while the field isn't laid out yet (the
  // overlay's first frame), where scrollHeight would read 0.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || el.offsetParent === null) return;
    const max = MAX_LINES * LINE_PX + 16;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [input, open, closing, variant]);

  // A starter handed over from the page (lib/compose.ts). Both variants are
  // mounted; only the one on screen takes it. Mobile expands the overlay,
  // which focuses the input itself; the caret then goes to the end so the
  // user types straight on from the starter.
  useEffect(() => {
    const onCompose = (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text;
      if (!text) return;
      const desktop = matchMedia('(min-width: 768px)').matches;
      if (desktop !== (variant === 'desktop')) return;
      setInput(text);
      if (variant === 'mobile') onExpand();
      let tries = 0;
      const place = () => {
        const el = inputRef.current;
        if (el && el.offsetParent !== null) {
          el.focus();
          el.setSelectionRange(text.length, text.length);
          return;
        }
        if (++tries < 12) requestAnimationFrame(place);
      };
      requestAnimationFrame(place);
    };
    window.addEventListener(COMPOSE_EVENT, onCompose);
    return () => window.removeEventListener(COMPOSE_EVENT, onCompose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, goalId]);

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
      // Escape is handled here too, on the overlay that holds focus, so it
      // still closes when something upstream swallows the window listener.
      if (e.key === 'Escape') { e.preventDefault(); requestClose(); return; }
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

  const closingRef = useRef(false);
  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => {
      onCollapse();
      setClosing(false);
      closingRef.current = false;
      // Focus goes back to the collapsed slip itself, not its text field:
      // focusing the field is what opens the conversation, so returning
      // focus there reopened it the moment it closed (and raised the
      // keyboard on a phone). The slip only mounts once React processes
      // the state updates above, so wait a frame.
      requestAnimationFrame(() => collapsedRef.current?.focus({ preventScroll: true }));
    }, SHEET_DOWN_MS());
  }

  async function send(queued?: string, quick = false) {
    const text = (queued ?? input).trim();
    if (!text || busy) return;
    // Anything still being heard would otherwise land in the emptied field.
    dictation.cancel();
    setInput('');
    setError('');
    setDraft({ text: '', tools: [] });
    stickToBottom.current = true;
    abort.current = new AbortController();
    try {
      await runTurn({
        goalId, text, quick, signal: abort.current.signal,
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

  // First run: what they wrote before getting a key goes in as the first
  // message (lib/onboarding.ts). Both variants are mounted; only the one on
  // screen sends it.
  useEffect(() => {
    const desktop = matchMedia('(min-width: 768px)').matches;
    if (desktop !== (variant === 'desktop')) return;
    void takePendingSend(goalId).then((text) => { if (text) void send(text, true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId, variant]);

  const lastSent = [...display].reverse().find((m) => m.role === 'user')?.text;

  // Enter sends. Enter with any modifier (Shift, Cmd, Ctrl, Option) makes a
  // new line, so a long message can be laid out without reaching for the
  // mouse. On a touch-first device, return makes a new line and the send
  // button sends. Up in an empty composer brings back the last message
  // sent, to fix and resend.
  function onInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Mid-composition (an IME, or Safari's 229 for the same) the key belongs
    // to the input method, not to us.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape' && dictation.listening) { e.preventDefault(); dictation.stop(); return; }
    if (e.key === 'ArrowUp' && !input && lastSent) {
      e.preventDefault();
      setInput(lastSent);
      const el = e.currentTarget;
      requestAnimationFrame(() => el.setSelectionRange(lastSent.length, lastSent.length));
      return;
    }
    if (e.key !== 'Enter') return;
    if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) {
      e.preventDefault();
      insertNewline(e.currentTarget, setInput);
      return;
    }
    if (TOUCH_FIRST()) return;
    e.preventDefault();
    void send();
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
      {/* The send button sits level with the last line as the field grows. */}
      <div className="flex items-end gap-3 border-b border-card-rule py-2.5 focus-within:border-ink">
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          // Typing takes over from dictation: a late result would otherwise
          // overwrite what was just typed.
          onChange={(e) => { if (dictation.listening) dictation.cancel(); setVoiceNote(''); setInput(e.target.value); }}
          onFocus={() => { if (variant === 'mobile') onExpand(); }}
          onKeyDown={onInputKeyDown}
          placeholder={dictation.listening ? 'listening…' : PLACEHOLDER}
          aria-label="Message"
          enterKeyHint={TOUCH_FIRST() ? 'enter' : 'send'}
          autoCapitalize="sentences"
          className="min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent py-2 font-sans text-[17px] leading-[27px] text-ink placeholder:font-hand placeholder:text-[23px] placeholder:text-graphite focus:outline-none"
        />
        {/* Stopping a turn from the collapsed slip leaves the conversation
         * closed; only sending opens it. */}
        <div className="flex flex-none items-center">
          {canDictate && (
            <MicButton
              listening={dictation.listening}
              onClick={() => {
                if (dictation.listening) return dictation.stop();
                setVoiceNote('');
                dictation.start(input);
                // Keep the caret in the field on desktop, so Enter sends what
                // was said. On mobile, focusing it would open the
                // conversation and raise the keyboard over the dictation.
                if (variant === 'desktop') inputRef.current?.focus();
              }}
            />
          )}
          <SendButton ready={!!input.trim()} busy={busy} onClick={() => { if (busy) { abort.current?.abort(); return; } if (variant === 'mobile') onExpand(); void send(); }} />
        </div>
      </div>
      {voiceNote && <p role="status" className="anim-fade-in pt-2 text-[14px] leading-5 text-accent">{voiceNote}</p>}
    </div>
  );

  const conversation = (
    <div ref={scrollRef} className="relative min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6">
      {(busy || workingSkill) && (
        <p className="text-[14px] leading-5">
          {workingSkill ? (
            <span className="text-accent">{skillVerb(workingSkill)}</span>
          ) : (
            <span className="hand anim-pulse text-[16px]">{display.length <= 1 ? 'reading what you wrote…' : 'thinking…'}</span>
          )}
        </p>
      )}
      {chat?.trimmed && display.length > 0 && (
        <p className="hand text-center text-[16px]">Earlier talk is kept on your page, not here.</p>
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
          {draft.text ? <Md text={draft.text} /> : !workingSkill && <p className="hand anim-pulse text-[16px]">{display.length <= 1 ? 'reading what you wrote…' : 'thinking…'}</p>}
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
    return <div ref={collapsedRef} tabIndex={-1} className="fixed inset-x-0 bottom-0 z-20 outline-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>{composer}</div>;
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
