import { streamText, stepCountIs, type ModelMessage, type StopCondition, type ToolSet } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { summarizeChange } from '@gambit/core';
import { db, type ChatRecord, type DisplayMsg } from './db';
import { loadApiKey } from './crypto';
import { getProvider, makeModel, GOOGLE_FALLBACK_MODEL, type ProviderKind } from './providers';
import { PREAMBLE, getSkillStore, skillIndexText, skillText } from './skills';
import { makeTools, goalStateJson, toolLabel, type Reply } from './tools';
import { readRecord, restoreSnapshot, snapshot } from './goals';
import { changedKeys, changedLines } from './changes';
import { session } from './session';

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; id: string; label: string; ok?: boolean }
  | { type: 'reply'; reply: Reply };

/** Context sent to the model per turn: about 60k characters of message
 * content, oldest whole turns dropped first. */
export const HISTORY_CHAR_BUDGET = 60_000;
/** Newest turns kept in storage per goal, after each completed turn. A turn
 * is one user message and everything that answers it, so the model's
 * history (which also holds every tool call and result) and the chat the
 * user sees always cover the same exchanges. */
export const CHAT_TURNS = 12;
const STUBBED = new Set(['load_skill', 'read_skill_file', 'get_goal']);
const CACHE = { anthropic: { cacheControl: { type: 'ephemeral' as const } } };
const uid = () => Math.random().toString(36).slice(2, 10);

/** Stop once a reply call has gone through. Not the SDK's hasToolCall,
 * which also stops on a reply that failed validation, leaving the model no
 * step to fix it in. Typed like hasToolCall, so it fits any tool set. */
export const replied: StopCondition<any> = ({ steps }) =>
  steps.at(-1)?.toolResults.some((r) => r.toolName === 'reply') ?? false;

/**
 * Newest messages within a character budget, dropping the oldest whole
 * turns first. A turn starts at a 'user' message and runs through every
 * assistant/tool message that follows it, so the cut point only ever lands
 * on a 'user' message — never mid-turn, so tool-call/tool-result pairs stay
 * intact and no tool-result is left dangling at the start of the window.
 * The most recent turn (and within it, at minimum the latest user message)
 * is always kept even if it alone exceeds the budget.
 */
export function trimHistory(messages: ModelMessage[], budget = HISTORY_CHAR_BUDGET): { messages: ModelMessage[]; trimmed: boolean } {
  const turnStarts: number[] = [];
  messages.forEach((m, i) => { if (m.role === 'user') turnStarts.push(i); });
  if (turnStarts.length === 0) return { messages, trimmed: false };

  let total = 0;
  let start = messages.length;
  for (let t = turnStarts.length - 1; t >= 0; t--) {
    const turnStart = turnStarts[t];
    const turnEnd = t + 1 < turnStarts.length ? turnStarts[t + 1] : messages.length;
    let turnLen = 0;
    for (let i = turnStart; i < turnEnd; i++) turnLen += JSON.stringify(messages[i]).length;
    if (total + turnLen > budget && start < messages.length) break;
    total += turnLen;
    start = turnStart;
  }
  return { messages: messages.slice(start), trimmed: start > 0 };
}

/**
 * Keep the newest `turns` turns. A turn starts at a 'user' message and runs
 * through everything after it until the next one, so the cut only ever
 * lands on a user message: a tool call and its result are never split, and
 * no tool result is left dangling at the start. Counting turns rather than
 * messages is what keeps the model's history (several messages a turn) and
 * the display (two entries a turn) covering the same exchanges.
 */
export function keepLastTurns<T extends { role: string }>(messages: T[], turns = CHAT_TURNS): T[] {
  const starts: number[] = [];
  messages.forEach((m, i) => { if (m.role === 'user') starts.push(i); });
  if (starts.length <= turns) return messages;
  return messages.slice(starts[starts.length - turns]);
}

/** Loaded skill text lives in the system prompt while active, so old copies in history are dropped. */
export function compactToolResults(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((m) => {
    if (m.role !== 'tool') return m;
    return {
      ...m,
      content: m.content.map((p) =>
        p.type === 'tool-result' && STUBBED.has(p.toolName)
          ? { ...p, output: { type: 'text' as const, value: '[omitted from history; the active skill is in the system prompt]' } }
          : p,
      ),
    };
  });
}

export async function runTurn(opts: {
  goalId: string;
  text: string;
  signal: AbortSignal;
  onEvent: (e: AgentEvent) => void;
  /** Lead with the fastest model (Gemini Flash-Lite): the first reply of
   * onboarding, where a quick answer matters more than a deep one. */
  quick?: boolean;
}): Promise<void> {
  const { goalId, text, signal, onEvent, quick } = opts;
  const prov = await getProvider();
  if (!prov) throw new Error('No provider configured. Open Settings.');
  const apiKey = await loadApiKey(prov.kind);
  if (!apiKey) throw new Error('No API key saved for this provider. Open Settings.');
  const model = makeModel(prov, apiKey);

  const rec = await db.goals.get(goalId);
  if (!rec) throw new Error('Goal not found');
  const read = await readRecord(rec);
  if (read.status !== 'ok') throw new Error(read.status === 'needs_app_update' ? 'This goal needs a newer app version.' : `Goal is unreadable: ${read.error}`);

  const chat: ChatRecord = (await db.chats.get(goalId)) ?? { goalId, model: [], display: [] };
  const snapshotId = await snapshot(goalId, 'turn');
  const before = read.data;

  chat.display.push({ id: uid(), role: 'user', text });
  await db.chats.put(chat);

  const store = await getSkillStore();
  const stable = `${PREAMBLE}\n\n${skillIndexText(store)}`;
  const skill = chat.activeSkill ? skillText(store, chat.activeSkill) : null;
  const skillBlock = skill ? `# Active skill: ${chat.activeSkill}\n${skill.text}` : '';
  const webSearch = prov.kind === 'anthropic' && !!prov.webSearch;
  const { messages: history, trimmed } = trimHistory(chat.model);
  const state = [
    `# Current goal state (id ${goalId}, today ${new Date().toISOString().slice(0, 10)})`,
    await goalStateJson(goalId),
    webSearch ? 'Web search tool: available.' : 'Web search tool: not available; label unverified claims as such.',
    trimmed ? 'Earlier conversation was trimmed; the goal state above is the durable record.' : '',
  ].filter(Boolean).join('\n');

  const system: ModelMessage[] = [
    { role: 'system', content: stable, providerOptions: CACHE },
    ...(skillBlock ? [{ role: 'system' as const, content: skillBlock, providerOptions: CACHE }] : []),
    { role: 'system', content: state },
  ];
  const userMsg: ModelMessage = { role: 'user', content: text };
  let activeSkill = chat.activeSkill;
  let skillLoads = 0;

  const tools = {
    ...makeTools({ goalId, onSkillLoaded: (n) => { activeSkill = n; skillLoads++; } }),
    ...(webSearch ? { web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }) } : {}),
  };

  let out = '';
  let reply: Reply | undefined;
  const entries: NonNullable<DisplayMsg['tools']> = [];
  const labels = new Map<string, string>();
  let error: string | undefined;
  let newMessages: ModelMessage[] = [];
  let usage = { input: 0, cached: 0, output: 0 };

  // A busy Gemini model (503) falls back to the other one quietly, as long
  // as nothing has streamed yet: the default then Flash-Lite, or the other
  // way round for a quick turn.
  const lite = () => makeModel({ ...prov, model: GOOGLE_FALLBACK_MODEL }, apiKey);
  const models = prov.kind !== 'google' || prov.model === GOOGLE_FALLBACK_MODEL
    ? [model]
    : quick ? [lite(), model] : [model, lite()];
  for (const [i, m] of models.entries()) {
    let raw: unknown;
    try {
      const result = streamText({
        model: m,
        messages: [...system, ...history, userMsg],
        tools: tools as ToolSet,
        // The reply call is the turn's last word: stop as soon as one lands.
        stopWhen: [stepCountIs(12), replied],
        abortSignal: signal,
        maxRetries: 1,
      });
      for await (const part of result.fullStream) {
        if (part.type === 'start-step' && out) out += '\n\n';
        else if (part.type === 'text-delta') { out += part.text; onEvent({ type: 'text', text: out }); }
        else if (part.type === 'tool-call' && part.toolName === 'reply') {
          // An invalid reply goes back to the model as an error, and it retries.
          if (!part.invalid) { reply = part.input as Reply; onEvent({ type: 'reply', reply }); }
        } else if (part.type === 'tool-result' && part.toolName === 'reply') {
          continue;
        } else if (part.type === 'tool-call') {
          const label = toolLabel(part.toolName, part.input);
          labels.set(part.toolCallId, label);
          onEvent({ type: 'tool', id: part.toolCallId, label });
        } else if (part.type === 'tool-result') {
          const ok = (part.output as { ok?: boolean } | undefined)?.ok !== false;
          entries.push({ name: part.toolName, label: labels.get(part.toolCallId) ?? part.toolName, ok });
          onEvent({ type: 'tool', id: part.toolCallId, label: labels.get(part.toolCallId) ?? part.toolName, ok });
        } else if (part.type === 'error') {
          raw = part.error;
        }
      }
      if (!raw) {
        newMessages = compactToolResults((await result.response).messages);
        const u = await result.totalUsage;
        usage = { input: u.inputTokens ?? 0, cached: u.cachedInputTokens ?? 0, output: u.outputTokens ?? 0 };
      }
    } catch (e) {
      raw = e;
    }
    if (!raw) { error = undefined; break; }
    error = signal.aborted ? 'Cancelled.' : errorText(raw, prov.kind);
    const busy = (raw as { statusCode?: number })?.statusCode === 503;
    if (!busy || signal.aborted || out || reply || entries.length || i === models.length - 1) break;
  }

  if (error) {
    newMessages = [{ role: 'assistant', content: `${out ? out + '\n\n' : ''}[Turn interrupted: ${error}]` }];
  }

  const afterRec = await db.goals.get(goalId);
  const after = afterRec ? await readRecord(afterRec) : null;
  const summary = after?.status === 'ok' ? summarizeChange(before, after.data) : [];

  const fresh = (await db.chats.get(goalId)) ?? chat;
  const displayId = uid();
  fresh.model = keepLastTurns([...chat.model, userMsg, ...newMessages]);
  fresh.activeSkill = activeSkill;
  const display: DisplayMsg[] = [
    ...fresh.display,
    { id: displayId, role: 'assistant', text: out, reply, tools: entries, summary, snapshotId: summary.length || error ? snapshotId : undefined, error },
  ];
  fresh.display = keepLastTurns(display);
  if (fresh.display.length < display.length) fresh.trimmed = true;
  await db.chats.put(fresh);

  if (after?.status === 'ok') {
    const lines = changedLines(before, after.data);
    session.setTurn(goalId, displayId, lines, changedKeys(before, after.data));
    for (const line of lines) {
      const node = pathValue(after.data as unknown as Record<string, unknown>, line.path);
      if (node && typeof node === 'object' && (node as { status?: string }).status === 'dropped') {
        session.markDropped(goalId, line.path);
      }
    }
  }

  if (usage.input || usage.output || usage.cached) {
    await db.usage.add({
      ts: Date.now(), goalId, model: prov.model, ...usage, skillLoads,
      parts: { system: stable.length, skill: skillBlock.length, state: state.length, history: JSON.stringify(history).length },
    });
  }
}

function pathValue(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').filter(Boolean).reduce<unknown>((node, key) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[key];
    return undefined;
  }, root);
}

export function errorText(e: unknown, kind?: ProviderKind): string {
  // A retried call wraps the provider's own error ("Failed after 2 attempts").
  const inner = (e as { lastError?: unknown })?.lastError;
  if (inner) e = inner;
  const err = e as { message?: string; statusCode?: number; responseBody?: string };
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return "You're offline. Your notebook is here, and messages will work when you're back online.";
  const google = kind === 'google';
  if (err?.statusCode === 401 || err?.statusCode === 403 || (google && err?.statusCode === 400 && /api key/i.test(err.message ?? '')))
    return 'The provider rejected your key. Check it under Model in settings, or paste a new one there.';
  if (err?.statusCode === 429)
    return google
      ? "You've used Google's free limit for now. To keep going, add credit to this key in AI Studio (aistudio.google.com) or switch to another provider under Model in settings. Your message is saved."
      : 'The provider is limiting requests right now. Your message is saved, so try again in a minute.';
  if (err?.statusCode === 503 || err?.statusCode === 529)
    return google
      ? "Google's models are busy right now. Your message is saved, so try again in a minute."
      : 'The provider is busy right now. Your message is saved, so try again in a minute.';
  return err?.message ?? String(e);
}

/** Restore the goal to before this turn. Applied writes in a failed turn are kept unless the user calls this. */
export async function undoTurn(goalId: string, displayId: string) {
  const chat = await db.chats.get(goalId);
  const msg = chat?.display.find((m) => m.id === displayId);
  if (!chat || !msg?.snapshotId) return;
  await restoreSnapshot(msg.snapshotId);
  msg.undone = true;
  session.clearLoop();
  session.clearFresh();
  chat.model.push(
    { role: 'user', content: '(System note: the user undid your previous turn; its goal changes were rolled back. The goal state in the system prompt is authoritative.)' },
    { role: 'assistant', content: 'Understood.' },
  );
  await db.chats.put(chat);
}

export async function clearChat(goalId: string) {
  await db.chats.delete(goalId);
}
