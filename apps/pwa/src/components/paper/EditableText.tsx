import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { wordCount, lineText } from '@gambit/core';
import { editLine, useEditedPaths } from '../../lib/edits';
import type { OpResult } from '../../lib/goals';
import { useMarksContext } from '../marks/context';

// Edit a line where it sits. The text turns into a one-line field that
// reads like the page (same font, an underline rule instead of a box), and
// the pencil beside it only shows on hover or focus where there is a hover
// to speak of. No modal, no banner: the error, if any, is pencilled under it.

const stop = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();

/** The shared one-line field behind editing a line and adding a move.
 * `onSave` resolves with the write's result; `ok` closes it via `onDone`.
 * An empty or unchanged draft is a cancel, not a write. */
export function InlineInput({ initial = '', original = '', maxWords, label, onSave, onDone, onCancel }: {
  initial?: string;
  /** What counts as "unchanged" (the line's current text; '' when adding). */
  original?: string;
  maxWords?: number;
  label: string;
  onSave: (draft: string) => Promise<OpResult>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Enter and blur can both ask to save, and Escape's unmount can blur:
  // once a save or cancel is under way the rest are ignored.
  const busy = useRef(false);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    // field-sizing does it where supported; this is the fallback.
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    grow();
  }, []);
  // A failed save disables the field; put the caret back once it's live.
  useEffect(() => {
    if (!saving && error) ref.current?.focus();
  }, [saving, error]);

  const cancel = () => {
    if (busy.current) return;
    busy.current = true;
    onCancel();
  };
  const save = async () => {
    if (busy.current) return;
    const text = draft.trim();
    if (!text || text === original.trim()) return cancel();
    busy.current = true;
    setSaving(true);
    setError(null);
    const res = await onSave(text);
    if (res.ok) return onDone();
    busy.current = false;
    setSaving(false);
    setError(res.errors[0]?.message ?? 'That edit could not be saved.');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (!e.shiftKey && !e.nativeEvent.isComposing) void save();
    }
  };

  const words = wordCount(draft);
  const over = maxWords != null && words > maxWords;
  return (
    <span className="block w-full" onClick={stop}>
      <textarea
        ref={ref}
        rows={1}
        value={draft}
        disabled={saving}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        style={{ font: 'inherit', color: 'inherit' }}
        className="m-0 block w-full resize-none rounded-none border-0 border-b border-card-rule bg-transparent p-0 outline-none [field-sizing:content] focus:border-ink disabled:opacity-60"
        onChange={(e) => { setDraft(e.target.value.replace(/\n/g, ' ')); setError(null); }}
        onInput={grow}
        onKeyDown={onKeyDown}
        onBlur={() => void save()}
      />
      {error && <p role="alert" className="hand mt-0.5 text-[16px] leading-5 text-accent">{error}</p>}
      <span className="hand block text-[13px] leading-4 text-graphite">
        enter to save · esc to cancel
        {maxWords != null && <span className={`ml-2 ${over ? 'text-accent' : ''}`}>{words}/{maxWords}</span>}
      </span>
    </span>
  );
}

function Pencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 13.5l.7-3L11 2.7a1.2 1.2 0 011.7 0l.6.6a1.2 1.2 0 010 1.7L5.5 12.8l-3 .7z" />
      <path d="M9.8 3.9l2.3 2.3" />
    </svg>
  );
}

/** The pencilled "edited" beside a line the user changed since the last
 * chat turn: it styles like FreshTag's "new" but says whose hand it was. */
function EditedTag() {
  return (
    <>
      <span aria-hidden="true" className="hand anim-write ml-2 inline-block text-[16px] font-normal text-graphite">edited</span>
      <span className="sr-only"> (you edited this; Gambit sees it on your next message)</span>
    </>
  );
}

/** A line of text that can be reworded in place. `children` is how the line
 * normally reads (it may carry dates or marks). The edit starts from, and is
 * checked against, the stored text: the page shows ISO dates as prose, so
 * the displayed `value` is only the fallback outside a goal's page. */
export function EditableText({ goalId, path, value, children, className = '', maxWords, quiet = false }: {
  goalId: string;
  path: string;
  value: string;
  children: ReactNode;
  className?: string;
  maxWords?: number;
  /** On a touch screen, keep the pencil hidden until the text is tapped,
   * for lines drawn quieter than the rest (a milestone). */
  quiet?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(false);
  const [pressed, setPressed] = useState(false);
  const edited = useEditedPaths(goalId).has(path);
  const goal = useMarksContext()?.goal;
  const stored = (goal && lineText(goal, path)) ?? value;

  if (editing) {
    return (
      <span data-editing="" className={`block w-full ${className}`}>
        <InlineInput
          initial={stored}
          original={stored}
          maxWords={maxWords}
          label={`Edit: ${value}`}
          onSave={(draft) => editLine(goalId, path, draft, stored)}
          onDone={() => { setEditing(false); setPressed(true); }}
          onCancel={() => setEditing(false)}
        />
      </span>
    );
  }
  return (
    <span className={`group/edit ${className}`}>
      <span
        onClick={quiet ? () => setShown((v) => !v) : undefined}
        // Reuses the press keyframe (styles.css) as the "saved" settle;
        // reduced motion collapses it through the catch-all there.
        style={pressed ? { animation: 'press-scale var(--dur-press) ease-out', display: 'inline-block' } : undefined}
        onAnimationEnd={() => setPressed(false)}
      >
        {children}
      </span>
      {edited && <EditedTag />}
      <button
        type="button"
        aria-label={`Edit: ${value}`}
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className={`${quiet && !shown ? '[@media(hover:none)]:hidden ' : ''}relative -my-2 -mr-2 ml-0 inline-flex cursor-pointer items-center bg-transparent p-2 align-middle text-graphite opacity-50 transition-opacity duration-150 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/edit:opacity-100`}
      >
        <Pencil />
      </button>
    </span>
  );
}
