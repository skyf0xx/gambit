import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Paper-system primitives (brand/identity.md §03-05). Materials, not
// colours, carry meaning: ink is committed, pencil is changeable, a slip is
// touchable. `Btn` and `Pill` stay exported with their current props so
// other (not-yet-restyled) files keep compiling; they now render through
// the new primitives underneath.

const tapTarget = 'inline-flex min-h-[44px] items-center';

/** A plain typed-word action. Pencil-circled on hover/focus by the marks layer via `data-circle`. */
export function TextAction({ className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      data-circle
      {...p}
      className={`${tapTarget} bg-transparent p-0 font-sans text-[17px] text-ink underline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    />
  );
}

/** The one filled ink button a screen may have, with a slight bleed. */
export function InkButton({ className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={`ink-bleed min-h-[44px] rounded-[3px] bg-ink px-5 py-3 font-sans text-[17px] font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    />
  );
}

/** A short pencilled word (Caveat), for statuses, dates and the like. */
export function PencilWord({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`hand ${className}`}>{children}</span>;
}

export const inputCls =
  'w-full border-0 border-b border-card-rule bg-transparent px-0 py-2.5 text-[17px] text-ink placeholder-graphite focus:border-ink focus:outline-none';

export function RuledInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`${inputCls} ${p.className ?? ''}`} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[14px] font-medium text-graphite">{label}</span>
      {children}
      {hint && <span className="block text-[14px] text-graphite">{hint}</span>}
    </label>
  );
}

/** A slip laid over the page, with a shadow (the shadow is a drop-shadow on
 * the wrapper, since a torn slip's clip-path would otherwise cut off a
 * box-shadow). Exported as `Leaf`; `Modal` is kept as an alias so existing
 * callers compile unchanged. */
export function Leaf({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ filter: 'drop-shadow(0 1px 1px var(--lift)) drop-shadow(0 8px 30px -8px var(--lift-far))', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        className={`slip max-h-[92dvh] w-full overflow-y-auto rounded-t-[3px] p-5 sm:rounded-[3px] ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-[20px] font-medium text-ink">{title}</h2>
          <TextAction onClick={onClose} aria-label="Close" className="text-graphite">
            close
          </TextAction>
        </div>
        {children}
      </div>
    </div>
  );
}
export const Modal = Leaf;

/** @deprecated kept for callers not yet ported to `TextAction`/`InkButton`.
 * `danger` no longer tints text with the accent — the accent is reserved for
 * the change loop, the working-skill name, and error text (brand/identity.md
 * §03), not a general "destructive action" tone. */
export function Btn({ kind = 'ghost', className = '', children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' | 'danger' }) {
  if (kind === 'primary') return <InkButton {...p} className={className}>{children}</InkButton>;
  return (
    <TextAction {...p} className={`text-ink ${className}`}>
      {children}
    </TextAction>
  );
}

/** @deprecated kept for callers not yet ported; renders as a pencilled word.
 * `tone` no longer maps to the accent — status is a pencilled word, not a
 * colour (brand/identity.md §03). */
export const Pill = ({ children }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'sky' }) => {
  return <PencilWord>{children}</PencilWord>;
};
