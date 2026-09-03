import { createServer } from 'node:http';
import { watch, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveGoalPath } from './resolve.mjs';
import { renderGoal } from './render.mjs';
import { renderPage } from './page.mjs';
import * as store from '../store/index.mjs';

const execFileAsync = promisify(execFile);
const OPEN_CMD = { darwin: 'open', win32: 'start', linux: 'xdg-open' }[process.platform] ?? 'xdg-open';

// Force-kills whatever process is already bound to `port` so a previous
// `visualize` run left running (e.g. after a crash or a lost SIGINT) never
// blocks the new one with EADDRINUSE.
export async function killExistingOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp']);
      const pids = new Set();
      for (const line of stdout.split('\n')) {
        if (line.includes(`:${port} `) && line.toUpperCase().includes('LISTENING')) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid) pids.add(pid);
        }
      }
      for (const pid of pids) {
        await execFileAsync('taskkill', ['/PID', pid, '/F']).catch(() => {});
      }
    } else {
      const { stdout } = await execFileAsync('lsof', ['-ti', `tcp:${port}`]).catch(() => ({ stdout: '' }));
      const pids = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
      for (const pid of pids) {
        await execFileAsync('kill', ['-9', pid]).catch(() => {});
      }
    }
  } catch {
    // best-effort — if we can't find/kill anything, let startServer surface the real error
  }
}

const EMPTY_GOAL = {
  deadline: null,
  deadlineWeeks: null,
  criteria: [],
  criteriaProgress: [],
  criteriaMet: 0,
  focus: null,
  posture: null,
  nextAction: null,
  groups: [],
};

// A goal switcher only makes sense when the active GOAL.json came from the
// store — a repo-local GOAL.json (cwd) always wins over the store's active
// pointer (see resolve.mjs's precedence rule), so there's nothing to switch
// to from there even if other store goals exist.
function switcherData(goalPath, cwd) {
  const cwdGoal = join(cwd, 'GOAL.json');
  if (goalPath === cwdGoal) return { canSwitch: false, goals: [], activeSlug: null };
  const activeSlug = store.resolveActive();
  const goals = store.list().map((g) => ({ slug: g.slug, title: g.title }));
  return { canSwitch: true, goals, activeSlug };
}

function currentPageHtml(goalPath, cwd) {
  const switcher = switcherData(goalPath, cwd);
  if (!goalPath || !existsSync(goalPath)) {
    return renderPage({ ...EMPTY_GOAL, title: 'No goal found', switcher });
  }
  const body = readFileSync(goalPath, 'utf8');
  try {
    return renderPage({ ...renderGoal(body), switcher });
  } catch (err) {
    return renderPage({
      ...EMPTY_GOAL,
      title: 'Invalid GOAL.json',
      switcher,
      groups: [
        {
          key: 'error',
          label: 'Schema error',
          cards: [
            {
              key: 'error',
              title: 'Schema error',
              hint: '',
              body: `<p class="empty">${goalPath} does not match the schema — fix it by hand and save.<br>${escapeForHtml(err.message)}</p>`,
            },
          ],
        },
      ],
    });
  }
}

function escapeForHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function startServer({ port = 4173, cwd = process.cwd(), open = true } = {}) {
  let goalPath = resolveGoalPath(cwd);
  if (!goalPath) {
    console.error('No GOAL.json found — nothing to visualize. Run onboard first.');
    process.exitCode = 1;
    return null;
  }

  console.log(`Watching ${goalPath}`);

  const clients = new Set();
  let watcher = null;
  let debounce = null;

  function notifyReload() {
    for (const client of clients) client.write('data: reload\n\n');
  }

  function watchGoalPath() {
    if (watcher) watcher.close();
    if (!goalPath || !existsSync(goalPath)) {
      watcher = null;
      return;
    }
    watcher = watch(goalPath, () => {
      clearTimeout(debounce);
      debounce = setTimeout(notifyReload, 150);
    });
  }

  watchGoalPath();

  const server = createServer((req, res) => {
    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (req.url === '/api/goals' && req.method === 'GET') {
      const body = JSON.stringify(switcherData(goalPath, cwd));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
      return;
    }

    const activateMatch = req.method === 'POST' && req.url.match(/^\/api\/goals\/([^/]+)\/activate$/);
    if (activateMatch) {
      const slug = decodeURIComponent(activateMatch[1]);
      try {
        store.setActive(slug);
        goalPath = resolveGoalPath(cwd);
        watchGoalPath();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(currentPageHtml(goalPath, cwd));
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Gambit visualize running at ${url}`);
    if (open) exec(`${OPEN_CMD} ${url}`);
  });

  server.on('close', () => { if (watcher) watcher.close(); });

  return server;
}
