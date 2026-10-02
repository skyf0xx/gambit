import { useEffect, useRef, useState } from 'react';
import { hand, hashSeed, strokePath } from '../marks/stroke';

// Pencil-note tooltips (brand/identity.md §05 "Pencil marks" + §03's margin
// material): a short handwritten aside under whatever carries `data-note`,
// with a small perfect-freehand caret pointing up at it. One delegated
// global handler, mounted once from Filters.tsx (the app's other mounted-
// once root, per this workstream's brief) rather than per-target listeners.
//
// Desktop (hover-capable): hover-after-~500ms, or immediate on keyboard
// focus. Touch: a tap toggles the note only on a target that has no click
// action of its own (an icon button on touch gets no note); a tap elsewhere
// dismisses it. One note showing at a time; Escape dismisses; `aria-
// describedby` points at it while shown; it stays inside the viewport.

const HOVER_DELAY_MS = 500;
const WRITE_MS = 250;
const FADE_MS = 150;
const NOTE_ID = 'pencil-note';

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isHoverCapable(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** A target "has a click action of its own" if it's a button, link, or
 * other native/ARIA control — those already respond to a tap, so touch
 * shouldn't also overload the tap to toggle a note (icon buttons excluded
 * per spec). A plain heading, span or the marks layer's [data-line] element
 * has no such action, so touch there toggles the note instead. */
function hasOwnClickAction(el: Element): boolean {
  if (el.closest('button, a[href], [role="button"], input, select, textarea, summary')) return true;
  return false;
}

function caretPath(cx: number, top: number): string {
  const seed = hashSeed(`caret:${Math.round(cx)}`);
  const pts = hand((t) => [cx - 5 + t * 10, top + 6 - Math.abs(t - 0.5) * 10], { n: 10, wobble: 0.4, seed, press: [0.4, 0.6] });
  return strokePath(pts, { size: 1.4, thinning: 0.5, taper: false });
}

interface NoteState {
  text: string;
  target: Element;
  x: number; // viewport px, clamped
  y: number; // viewport px, top of the note
  caretX: number; // relative to note's left edge
  backed: boolean; // needs a --surface backing to avoid overlapping the next line
}

export function PencilNotes() {
  const [note, setNote] = useState<NoteState | null>(null);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const noteRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentTarget = useRef<Element | null>(null);
  const reduced = prefersReducedMotion();

  const dismiss = () => {
    clearTimeout(hoverTimer.current);
    const target = currentTarget.current;
    if (target) target.removeAttribute('aria-describedby');
    currentTarget.current = null;
    if (reduced) {
      setNote(null);
      return;
    }
    setPhase('out');
    setTimeout(() => setNote(null), FADE_MS);
  };

  const show = (target: Element) => {
    const text = target.getAttribute('data-note');
    if (!text) return;
    if (currentTarget.current === target && note) return;
    if (currentTarget.current && currentTarget.current !== target) currentTarget.current.removeAttribute('aria-describedby');
    currentTarget.current = target;
    target.setAttribute('aria-describedby', NOTE_ID);

    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const approxWidth = 160;
    const x = Math.min(Math.max(8, cx - approxWidth / 2), vw - approxWidth - 8);
    const y = rect.bottom + 10;
    const caretX = cx - x;

    // Overlap check happens post-render against the next sibling's line, but
    // without a full layout pass here we use a conservative heuristic: back
    // it whenever the target sits inside a dense list (more than one line
    // per section) — the grain edge costs nothing when it isn't needed.
    const backed = !!target.closest('ol, ul');

    setPhase('in');
    setNote({ text, target, x, y, caretX, backed });
  };

  useEffect(() => {
    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !isHoverCapable()) return;
      const el = (e.target as Element)?.closest('[data-note]');
      if (!el) return;
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => show(el), HOVER_DELAY_MS);
    };
    const onPointerOut = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element)?.closest('[data-note]');
      if (!el) return;
      clearTimeout(hoverTimer.current);
      if (currentTarget.current === el) dismiss();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = (e.target as Element)?.closest('[data-note]');
      if (!el) return;
      show(el);
    };
    const onFocusOut = (e: FocusEvent) => {
      const el = (e.target as Element)?.closest('[data-note]');
      if (!el || currentTarget.current !== el) return;
      dismiss();
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element)?.closest('[data-note]');
      if (el && !hasOwnClickAction(el)) {
        // Touch (and any other pointer without hover) toggles on tap.
        if (currentTarget.current === el && note) {
          dismiss();
        } else {
          show(el);
        }
        return;
      }
      // Tap elsewhere dismisses the open note.
      if (currentTarget.current && !currentTarget.current.contains(e.target as Node)) dismiss();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && currentTarget.current) dismiss();
    };

    document.addEventListener('pointerover', onPointerOver, true);
    document.addEventListener('pointerout', onPointerOut, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      clearTimeout(hoverTimer.current);
      document.removeEventListener('pointerover', onPointerOver, true);
      document.removeEventListener('pointerout', onPointerOut, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  if (!note) return null;

  return (
    <div
      ref={noteRef}
      id={NOTE_ID}
      role="tooltip"
      style={{ position: 'fixed', left: note.x, top: note.y, zIndex: 60 }}
      className="pointer-events-none"
    >
      <svg width="16" height="10" style={{ position: 'absolute', top: -9, left: note.caretX - 8, overflow: 'visible' }} aria-hidden="true">
        <path d={caretPath(8, 0)} fill="var(--graphite)" filter="url(#graphite)" />
      </svg>
      {/* The pencil filter goes on the words only: on the slip too, it eats
       * the paper and lets the line underneath show through. */}
      <div className="paper rounded-[2px] px-1.5 py-0.5">
        <div
          className={`hand whitespace-nowrap text-[20px] leading-tight text-graphite ${reduced ? '' : phase === 'in' ? 'anim-write' : 'anim-fade-in'}`}
          style={{ filter: 'url(#graphite)', animationDirection: phase === 'out' ? 'reverse' : 'normal' }}
        >
          {note.text}
        </div>
      </div>
    </div>
  );
}
