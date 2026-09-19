import type { ButtonHTMLAttributes, ReactNode } from 'react';

const base = 'rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed';
const styles = {
  primary: 'bg-sky-500 text-slate-950 hover:bg-sky-400',
  ghost: 'bg-slate-800 text-slate-200 hover:bg-slate-700',
  danger: 'bg-red-500/15 text-red-300 hover:bg-red-500/25',
};

export function Btn({ kind = 'ghost', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: keyof typeof styles }) {
  return <button {...p} className={`${base} ${styles[kind]} ${className}`} />;
}

export const inputCls = 'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-slate-800 bg-slate-950 p-5 sm:rounded-xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Pill = ({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'sky' }) => {
  const t = { slate: 'bg-slate-800 text-slate-300', green: 'bg-emerald-500/15 text-emerald-300', amber: 'bg-amber-500/15 text-amber-300', red: 'bg-red-500/15 text-red-300', sky: 'bg-sky-500/15 text-sky-300' }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${t}`}>{children}</span>;
};
