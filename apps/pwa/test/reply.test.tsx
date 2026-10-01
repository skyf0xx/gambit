import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { replySchema } from '../src/lib/tools';
import { ReplyView, Reasoning, lastParagraph } from '../src/components/Reply';
import { PREAMBLE } from '../src/lib/skills';
import { replied } from '../src/lib/agent';
import { streamText, stepCountIs, tool } from 'ai';
import { MockLanguageModelV2, simulateReadableStream } from 'ai/test';

const reply = { say: 'Your plan leans on one vendor.', bottomLine: 'Should I add a backup vendor line?', kind: 'confirm' as const, options: ['Yes', 'Not quite'] };

describe('reply', () => {
  it('accepts a short reply and rejects a long bottom line or too many options', () => {
    expect(replySchema.safeParse(reply).success).toBe(true);
    expect(replySchema.safeParse({ ...reply, bottomLine: 'x'.repeat(121) }).success).toBe(false);
    expect(replySchema.safeParse({ ...reply, options: ['a', 'b', 'c', 'd', 'e', 'f'] }).success).toBe(false);
    expect(replySchema.safeParse({ ...reply, kind: 'essay' }).success).toBe(false);
  });

  it('rejects a reply line over the word cap or above grade 7', () => {
    expect(replySchema.safeParse({ ...reply, say: 'a b c d e f g h i j k l m n o p q r s t u' }).success).toBe(false);
    const dense = 'Organizational interdependencies necessitate comprehensive reconsideration of institutional prioritization methodologies.';
    expect(replySchema.safeParse({ ...reply, bottomLine: dense + ' Consequently everything changes.' }).success).toBe(false);
    expect(replySchema.safeParse({ ...reply, say: 'Your plan has one weak spot, and it is the vendor you pay most.' }).success).toBe(true);
  });

  it('splits text into its last paragraph and the rest', () => {
    expect(lastParagraph('a\n\nb\n\n c ')).toEqual({ last: 'c', rest: 'a\n\nb' });
    expect(lastParagraph('only')).toEqual({ last: 'only', rest: '' });
  });

  it('shows the sentence, the labelled bottom line, and options only when pickable', () => {
    const live = renderToStaticMarkup(<ReplyView reply={reply} onPick={() => {}} />);
    expect(live).toContain('Your plan leans on one vendor.');
    expect(live).toContain('Before I write it');
    expect(live).toContain('Should I add a backup vendor line?');
    expect(live).toContain('Not quite');
    expect(renderToStaticMarkup(<ReplyView reply={reply} />)).not.toContain('Not quite');
  });

  it('keeps reasoning collapsed, and renders nothing when there is none', () => {
    const html = renderToStaticMarkup(<Reasoning text="- one vendor carries 80%" tools={['wrote plan']} />);
    expect(html).toContain('<details');
    expect(html).not.toContain('open=""');
    expect(html).toContain('wrote plan');
    expect(renderToStaticMarkup(<Reasoning text="  " tools={[]} />)).toBe('');
  });

  it('tells the model to end every turn with reply', () => {
    expect(PREAMBLE).toContain('exactly one reply(');
    expect(PREAMBLE).toContain('End every turn with one `reply` call');
  });

  it('lets the model retry an invalid reply, then stops on the valid one', async () => {
    const step = (input: object, id: string) => [
      { type: 'tool-call', toolCallId: id, toolName: 'reply', input: JSON.stringify(input) },
      { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
    ];
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        const bottomLine = calls === 1 ? 'x'.repeat(200) : 'short';
        return { stream: simulateReadableStream({ chunks: step({ say: 'hi', bottomLine, kind: 'fyi' }, `c${calls}`) as never }) };
      },
    });
    const r = streamText({ model, prompt: 'x', tools: { reply: tool({ inputSchema: replySchema, execute: async () => ({ ok: true }) }) }, stopWhen: [stepCountIs(12), replied] });
    const seen: string[] = [];
    for await (const p of r.fullStream) if (p.type === 'tool-call') seen.push(`${p.toolCallId}:${p.invalid ? 'invalid' : 'ok'}`);
    expect(seen).toEqual(['c1:invalid', 'c2:ok']);
    expect(calls).toBe(2);
  });
});
