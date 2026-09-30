import { streamText, stepCountIs, type ModelMessage, type ToolSet } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { summarizeChange } from '@gambit/core';
import { db, type ChatRecord, type DisplayMsg } from './db';
import { loadApiKey } from './crypto';
import { getProvider, makeModel } from './providers';
import { PREAMBLE, getSkillStore, skillIndexText, skillText } from './skills';
import { makeTools, goalStateJson, toolLabel } from './tools';
import { readRecord, restoreSnapshot, snapshot } from './goals';
import { changedLines } from './changes';
import { session } from './session';

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; id: string; label: string; ok?: boolean };

const HISTORY_CHAR_BUDGET = 80_000;
const STUBBED = new Set(['load_skill', 'read_skill_file', 'get_goal']);
const CACHE = { anthropic: { cacheControl: { type: 'ephemeral' as const } } };
const uid = () => Math.random().toString(36).slice(2, 10);

/** Newest messages within a character budget, always starting on a user message so tool pairs stay whole. */
export function trimHistory(messages: ModelMessage[], budget = HISTORY_CHAR_BUDGET): { messages: ModelMessage[]; trimmed: boolean } {
  let total = 0;
  let start = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    total += JSON.stringify(messages[i]).length;
    if (total > budget) break;
    start = i;
  }
  while (start < messages.length && messages[start].role !== 'user') start++;
  return { messages: messages.slice(start), trimmed: start > 0 };
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
}): Promise<void> {
  const { goalId, text, signal, onEvent } = opts;
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
  const entries: NonNullable<DisplayMsg['tools']> = [];
  const labels = new Map<string, string>();
  let error: string | undefined;
  let newMessages: ModelMessage[] = [];
  let usage = { input: 0, cached: 0, output: 0 };

  try {
    const result = streamText({
      model,
      messages: [...system, ...history, userMsg],
      tools: tools as ToolSet,
      stopWhen: stepCountIs(12),
      abortSignal: signal,
      maxRetries: 1,
    });
    for await (const part of result.fullStream) {
      if (part.type === 'start-step' && out) out += '\n\n';
      else if (part.type === 'text-delta') { out += part.text; onEvent({ type: 'text', text: out }); }
      else if (part.type === 'tool-call') {
        const label = toolLabel(part.toolName, part.input);
        labels.set(part.toolCallId, label);
        onEvent({ type: 'tool', id: part.toolCallId, label });
      } else if (part.type === 'tool-result') {
        const ok = (part.output as { ok?: boolean } | undefined)?.ok !== false;
        entries.push({ name: part.toolName, label: labels.get(part.toolCallId) ?? part.toolName, ok });
        onEvent({ type: 'tool', id: part.toolCallId, label: labels.get(part.toolCallId) ?? part.toolName, ok });
      } else if (part.type === 'error') {
        error = errorText(part.error);
      }
    }
    if (!error) {
      newMessages = compactToolResults((await result.response).messages);
      const u = await result.totalUsage;
      usage = { input: u.inputTokens ?? 0, cached: u.cachedInputTokens ?? 0, output: u.outputTokens ?? 0 };
    }
  } catch (e) {
    error = signal.aborted ? 'Cancelled.' : errorText(e);
  }

  if (error) {
    newMessages = [{ role: 'assistant', content: `${out ? out + '\n\n' : ''}[Turn interrupted: ${error}]` }];
  }

  const afterRec = await db.goals.get(goalId);
  const after = afterRec ? await readRecord(afterRec) : null;
  const summary = after?.status === 'ok' ? summarizeChange(before, after.data) : [];

  const fresh = (await db.chats.get(goalId)) ?? chat;
  const displayId = uid();
  fresh.model = [...chat.model, userMsg, ...newMessages];
  fresh.activeSkill = activeSkill;
  fresh.display = [
    ...fresh.display,
    { id: displayId, role: 'assistant', text: out, tools: entries, summary, snapshotId: summary.length || error ? snapshotId : undefined, error },
  ];
  await db.chats.put(fresh);

  if (after?.status === 'ok') {
    const lines = changedLines(before, after.data);
    session.setTurn(goalId, displayId, lines);
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

function errorText(e: unknown): string {
  const err = e as { message?: string; statusCode?: number; responseBody?: string };
  if (err?.statusCode === 401 || err?.statusCode === 403) return 'The provider rejected the API key.';
  if (err?.statusCode === 429) return 'Rate limited by the provider. Try again shortly.';
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
  chat.model.push(
    { role: 'user', content: '(System note: the user undid your previous turn; its goal changes were rolled back. The goal state in the system prompt is authoritative.)' },
    { role: 'assistant', content: 'Understood.' },
  );
  await db.chats.put(chat);
}

export async function clearChat(goalId: string) {
  await db.chats.delete(goalId);
}
