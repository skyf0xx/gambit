import type { ReactNode } from 'react';

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={k++} className="font-semibold text-ink">{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k++} className="font-mono text-[0.9em] text-ink">{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      out.push(<a key={k++} href={mm[2]} target="_blank" rel="noreferrer" className="font-mono underline underline-offset-[3px]">{mm[1]}</a>);
    } else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** Small safe markdown subset: headings, bullets, numbered lists, quotes, code fences, bold, code, links. */
export function Md({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="overflow-x-auto border-t border-b border-card-rule py-2 font-mono text-[14px] text-ink">{buf.join('\n')}</pre>);
    } else if (/^#{1,4}\s/.test(l)) {
      blocks.push(<h3 key={k++} className="mt-3 text-[17px] font-semibold text-ink">{inline(l.replace(/^#+\s/, ''))}</h3>);
      i++;
    } else if (/^\s*[-*]\s/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s/, ''));
      blocks.push(
        <ul key={k++} className="list-none space-y-1.5">
          {items.map((t, j) => (
            <li key={j} className="grid grid-cols-[16px_1fr] gap-2">
              <span className="text-graphite">–</span>
              <span>{inline(t)}</span>
            </li>
          ))}
        </ul>,
      );
    } else if (/^\s*\d+\.\s/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s/, ''));
      blocks.push(<ol key={k++} className="list-decimal space-y-1.5 pl-5">{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>);
    } else if (l.startsWith('>')) {
      blocks.push(<blockquote key={k++} className="border-l-[1.5px] border-card-rule pl-3 text-graphite">{inline(l.replace(/^>\s?/, ''))}</blockquote>);
      i++;
    } else if (l.trim() === '') {
      i++;
    } else {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|\s*[-*]\s|\s*\d+\.\s|```|>)/.test(lines[i])) buf.push(lines[i++]);
      blocks.push(<p key={k++}>{inline(buf.join(' '))}</p>);
    }
  }
  return <div className="space-y-4 text-[17px] leading-[27px] text-ink">{blocks}</div>;
}
