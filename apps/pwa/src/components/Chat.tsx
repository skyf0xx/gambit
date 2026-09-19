import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { runTurn, undoTurn, clearChat } from '../lib/agent';
import { Btn, Pill } from './ui';
import { Md } from './Md';

interface Draft { text: string; tools: { id: string; label: string; ok?: boolean }[] }

export function Chat({ goalId, stub }: { goalId: string; stub: boolean }) {
  const chat = useLiveQuery(() => db.chats.get(goalId), [goalId]);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const busy = draft !== null;
  const display = chat?.display ?? [];
  const lastUndoable = [...display].reverse().find((m) => m.role === 'assistant' && m.snapshotId);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [display.length, draft?.text, draft?.tools.length]);
  useEffect(() => { setInput(''); setError(''); }, [goalId]);

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {display.length === 0 && !busy && (
          <p className="mx-auto mt-10 max-w-sm text-center text-sm text-slate-500">
            {stub ? 'Tell me what you want to achieve, as much or as little as you have.' : 'Ask for a status, a next step, or a hard question about the plan.'}
          </p>
        )}
        {display.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-sky-600/30 px-3 py-2 text-sm">{m.text}</div>
          ) : (
            <div key={m.id} className="max-w-[95%] space-y-2">
              {m.text && <Md text={m.text} />}
              {m.error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{m.error}</p>}
              {(m.tools?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.tools!.map((t, i) => <Pill key={i} tone={t.ok ? 'slate' : 'red'}>{t.label}</Pill>)}
                </div>
              )}
              {(m.summary?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-300">
                  <span>Goal updated: {m.summary!.join(', ')}</span>
                  {m.id === lastUndoable?.id && !m.undone && !busy && (
                    <button className="rounded bg-slate-800 px-2 py-0.5 text-slate-200 hover:bg-slate-700" onClick={() => void undoTurn(goalId, m.id)}>Undo</button>
                  )}
                  {m.undone && <span className="text-slate-500">undone</span>}
                </div>
              )}
              {m.error && (m.summary?.length ?? 0) === 0 && m.id === lastUndoable?.id && !m.undone && <span className="text-xs text-slate-500">No goal changes were applied.</span>}
              {m.error && (m.summary?.length ?? 0) > 0 && <span className="text-xs text-amber-300">Partial progress was kept; Undo rolls the whole turn back.</span>}
            </div>
          ),
        )}
        {draft && (
          <div className="max-w-[95%] space-y-2">
            {draft.text ? <Md text={draft.text} /> : <p className="text-sm text-slate-500">Thinking…</p>}
            <div className="flex flex-wrap gap-1">
              {draft.tools.map((t) => <Pill key={t.id} tone={t.ok === undefined ? 'sky' : t.ok ? 'slate' : 'red'}>{t.label}</Pill>)}
            </div>
          </div>
        )}
        {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <div ref={end} />
      </div>
      <div className="border-t border-slate-800 p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            rows={2}
            placeholder="Message Gambit"
            className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
          {busy ? <Btn kind="danger" onClick={() => abort.current?.abort()}>Stop</Btn> : <Btn kind="primary" onClick={() => void send()} disabled={!input.trim()}>Send</Btn>}
        </div>
        {display.length > 0 && !busy && (
          <button className="mt-2 text-xs text-slate-500 hover:text-slate-300" onClick={() => confirm('Clear this chat? The goal itself is kept.') && void clearChat(goalId)}>
            Clear chat
          </button>
        )}
      </div>
    </div>
  );
}
