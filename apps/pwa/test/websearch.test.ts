import { describe, it, expect, vi } from 'vitest';
import { googleSearch } from '../src/lib/websearch';

const model = {} as never;

describe('googleSearch', () => {
  it('returns the answer with de-duplicated url sources', async () => {
    const generate = vi.fn(async () => ({
      text: 'It opens Monday.',
      sources: [
        { type: 'source', sourceType: 'url', id: '1', url: 'https://a.example/x', title: 'A' },
        { type: 'source', sourceType: 'url', id: '2', url: 'https://a.example/x', title: 'A again' },
        { type: 'source', sourceType: 'document', id: '3', mediaType: 'text/plain', title: 'Doc' },
      ],
    }));
    const r = await googleSearch(model, 'when does it open', { generate: generate as never });
    expect(r).toEqual({ ok: true, text: 'It opens Monday.', sources: [{ title: 'A', url: 'https://a.example/x' }] });
    const call = (generate.mock.calls[0] as unknown as [{ tools: Record<string, unknown> }])[0];
    expect(Object.keys(call.tools)).toEqual(['google_search']);
  });
  it('reports a failed call instead of throwing', async () => {
    const r = await googleSearch(model, 'q', { generate: (async () => { throw new Error('quota'); }) as never });
    expect(r).toMatchObject({ ok: false, error: 'quota', sources: [] });
  });
});
