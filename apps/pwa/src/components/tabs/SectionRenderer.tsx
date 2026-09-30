import { useState } from 'react';
import { writeSection } from '@gambit/core';
import { applyOp } from '../../lib/goals';
import { snapshot } from '../../lib/goals';
import type { Goal } from '../../lib/types';
import { TextAction, InkButton, PencilWord, inputCls } from '../ui';
import { SectionBody, EMPTY_PROMPTS } from '../Sections';
import { sectionTitleFor } from '../sectionTitles';

// A single goal-key section: heading (+ method gloss), body, and the
// desktop-only inline Edit-as-JSON escape hatch. Split out of Dashboard.tsx
// (which owned this inline before the tab split) so every tab's content
// component can render its own section list without duplicating the
// heading/edit chrome.

const SECTION_KEYS = ['plan', 'criteriaStatus', 'successCriteria', 'people', 'stakeholders', 'systemsNotes', 'riskNotes', 'decisions', 'exposure', 'capacity', 'forecasts', 'experiments'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const isEmptySection = (v: unknown) => v == null || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.keys(v as object).length === 0);

function EditJson({ goalId, k, value, onDone }: { goalId: string; k: string; value: unknown; onDone: () => void }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [errs, setErrs] = useState<string[]>([]);
  async function save() {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch (e) { return setErrs([`Invalid JSON: ${(e as Error).message}`]); }
    await snapshot(goalId, 'edit');
    const r = await applyOp(goalId, (g) => writeSection(g, k, parsed) as never);
    if (r.ok) onDone(); else setErrs(r.errors.map((e) => `${e.path}: ${e.message}`));
  }
  return (
    <div className="space-y-2">
      <textarea className={`${inputCls} min-h-64 font-mono text-[14px]`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      {errs.map((e, i) => <p key={i} className="text-[14px] text-accent">{e}</p>)}
      <div className="flex gap-3"><InkButton onClick={() => void save()}>Save</InkButton><TextAction onClick={onDone}>Cancel</TextAction></div>
    </div>
  );
}

export function Section({ goalId, k, data }: { goalId: string; k: SectionKey; data: unknown }) {
  const [editing, setEditing] = useState(false);
  const { title, method, methodNote } = sectionTitleFor(k);
  return (
    <section className="anim-fade-in space-y-2">
      <h2 className="font-sans text-[17px] font-semibold leading-6">
        {title}
        {method && (
          <>
            <span className="sr-only"> — </span>
            <span data-note={methodNote}>
              <PencilWord className="ml-2 text-[19px]">{method}</PencilWord>
            </span>
          </>
        )}
      </h2>
      {editing ? (
        <EditJson goalId={goalId} k={k} value={data} onDone={() => setEditing(false)} />
      ) : (
        <>
          <SectionBody k={k} data={data} goalId={goalId} editable />
          <TextAction className="mt-1 hidden text-[14px] text-graphite md:inline-flex" onClick={() => setEditing(true)}>Edit</TextAction>
        </>
      )}
    </section>
  );
}

export function EmptySection({ k, onTap }: { k: string; onTap?: () => void }) {
  const { title } = sectionTitleFor(k);
  const prompt = EMPTY_PROMPTS[k] ?? 'Nothing here yet.';
  return (
    <section className="anim-fade-in space-y-2">
      <h2 className="font-sans text-[17px] font-semibold leading-6">{title}</h2>
      <TextAction className="text-left" onClick={onTap}>
        <PencilWord>{prompt}</PencilWord>
      </TextAction>
    </section>
  );
}

/** Renders a list of section keys, each as `Section` or `EmptySection`
 * depending on content — the shared body every non-Moves tab uses. */
export function SectionList({ goalId, g, keys }: { goalId: string; g: Goal; keys: SectionKey[] }) {
  return (
    <>
      {keys.map((k) =>
        isEmptySection(g[k]) ? <EmptySection key={k} k={k} /> : <Section key={k} goalId={goalId} k={k} data={g[k]} />
      )}
    </>
  );
}
