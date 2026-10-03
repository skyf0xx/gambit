import { generateText, tool, type LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

// Web search for Google AI Studio keys. Gemini can't reliably mix its
// google_search grounding with function tools in one call, so the search is
// a function tool of its own: it makes a second, separate call on the same
// key and model with only grounding switched on, and hands the answer text
// and its sources back to the turn.

export interface SearchResult {
  ok: boolean;
  text: string;
  sources: { title: string; url: string }[];
  error?: string;
}

type Generate = typeof generateText;

/** Run one grounded search. `generate` is injectable so tests need no network. */
export async function googleSearch(model: LanguageModel, query: string, opts: { signal?: AbortSignal; generate?: Generate } = {}): Promise<SearchResult> {
  const generate = opts.generate ?? generateText;
  try {
    const r = await generate({
      model,
      prompt: `Search the web and answer briefly, with the facts that matter and their dates: ${query}`,
      tools: { google_search: google.tools.googleSearch({}) },
      abortSignal: opts.signal,
      maxRetries: 1,
    });
    const seen = new Set<string>();
    const sources: SearchResult['sources'] = [];
    for (const s of r.sources ?? []) {
      if (s.sourceType !== 'url' || seen.has(s.url)) continue;
      seen.add(s.url);
      sources.push({ title: s.title ?? s.url, url: s.url });
    }
    return { ok: true, text: r.text, sources };
  } catch (e) {
    return { ok: false, text: '', sources: [], error: e instanceof Error ? e.message : 'search failed' };
  }
}

/** The `web_search` function tool for a Google provider. */
export function googleWebSearchTool(model: LanguageModel, signal?: AbortSignal) {
  return tool({
    description: 'Search the web for current facts. Returns a short answer with its sources. Use it to check a claim, a date, a price or a person before relying on it.',
    inputSchema: z.object({ query: z.string().min(2).max(300).describe('What to look up, as a plain search question.') }),
    execute: async ({ query }) => googleSearch(model, query, { signal }),
  });
}
