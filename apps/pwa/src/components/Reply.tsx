import type { Reply } from '../lib/tools';
import { Md } from './Md';
import { TextAction } from './ui';

// What a turn shows by default: the model's `reply` call (lib/tools.ts) —
// one sentence, then the bottom line, set apart and labelled by kind.
// Everything else the model wrote or did sits collapsed under it.

const KIND_LABEL: Record<Reply['kind'], string> = {
  question: 'I need to know',
  decision: 'Your call',
  confirm: 'Before I write it',
  fyi: 'Next',
};

/** `onPick` is set only on the latest reply, so old options can't be tapped. */
export function ReplyView({ reply, onPick }: { reply: Reply; onPick?: (option: string) => void }) {
  const options = reply.options ?? [];
  return (
    <div className="space-y-4">
      <p className="text-[17px] leading-[27px] text-ink">{reply.say}</p>
      <div className={`border-l-[3px] pl-4 ${reply.kind === 'fyi' ? 'border-graphite/40' : 'border-ink'}`}>
        <p className="hand text-[16px] leading-5 text-graphite">{KIND_LABEL[reply.kind]}</p>
        <p className="text-[17px] leading-[27px] font-semibold text-ink">{reply.bottomLine}</p>
        {onPick && options.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-5">
            {options.map((o) => (
              <TextAction key={o} className="underline" onClick={() => onPick(o)}>{o}</TextAction>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The model's working: its text outside the reply and the tools it ran.
 * Closed by default, its toggle centred between the two sides of the
 * conversation; opened, it reads left-aligned at full width. */
export function Reasoning({ text, tools }: { text: string; tools: string[] }) {
  if (!text.trim() && tools.length === 0) return null;
  return (
    <details className="group">
      <summary className="hand flex min-h-[44px] cursor-pointer list-none items-center justify-center text-[16px] text-graphite hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show reasoning</span>
        <span className="hidden group-open:inline">Hide reasoning</span>
      </summary>
      <div className="space-y-2 border-l border-rule pl-4">
        {text.trim() && <Md text={text} />}
        {tools.length > 0 && <p className="hand text-[16px]">{tools.join(' · ')}</p>}
      </div>
    </details>
  );
}
