import type { ReactNode } from 'react';

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={k++} className="font-semibold text-slate-100">{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k++} className="rounded bg-slate-800 px-1 text-[0.85em]">{t.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** Small safe markdown subset: headings, bullets, numbered lists, quotes, code fences, bold, code. */
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
      blocks.push(<pre key={k++} className="overflow-x-auto rounded bg-slate-900 p-3 text-xs">{buf.join('\n')}</pre>);
    } else if (/^#{1,4}\s/.test(l)) {
      blocks.push(<h3 key={k++} className="mt-3 text-sm font-semibold text-slate-100">{inline(l.replace(/^#+\s/, ''))}</h3>);
      i++;
    } else if (/^\s*[-*]\s/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s/, ''));
      blocks.push(<ul key={k++} className="list-disc space-y-1 pl-5">{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>);
    } else if (/^\s*\d+\.\s/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s/, ''));
      blocks.push(<ol key={k++} className="list-decimal space-y-1 pl-5">{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>);
    } else if (l.startsWith('>')) {
      blocks.push(<blockquote key={k++} className="border-l-2 border-slate-600 pl-3 text-slate-400">{inline(l.replace(/^>\s?/, ''))}</blockquote>);
      i++;
    } else if (l.trim() === '') {
      i++;
    } else {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|\s*[-*]\s|\s*\d+\.\s|```|>)/.test(lines[i])) buf.push(lines[i++]);
      blocks.push(<p key={k++}>{inline(buf.join(' '))}</p>);
    }
  }
  return <div className="space-y-2 text-sm leading-relaxed text-slate-300">{blocks}</div>;
}
