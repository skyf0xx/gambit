import { createServer } from 'node:http';
import { watch, readFileSync, existsSync } from 'node:fs';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveGoalPath } from './resolve.mjs';
import { renderGoal } from './render.mjs';
import { renderPage } from './page.mjs';

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

function currentPageHtml(goalPath) {
  if (!goalPath || !existsSync(goalPath)) {
    return renderPage({ title: 'No goal found', shortTitle: 'No goal found', deadline: null, criteria: [], focus: null, cards: [] });
  }
  const body = readFileSync(goalPath, 'utf8');
  return renderPage(renderGoal(body));
}

export function startServer({ port = 4173, cwd = process.cwd(), open = true } = {}) {
  const goalPath = resolveGoalPath(cwd);
  if (!goalPath) {
    console.error('No GOAL.md found — nothing to visualize. Run onboard first.');
    process.exitCode = 1;
    return null;
  }

  console.log(`Watching ${goalPath}`);

  const clients = new Set();

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

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(currentPageHtml(goalPath));
  });

  let debounce = null;
  const watcher = watch(goalPath, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      for (const client of clients) client.write('data: reload\n\n');
    }, 150);
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Gambit visualize running at ${url}`);
    if (open) exec(`${OPEN_CMD} ${url}`);
  });

  server.on('close', () => watcher.close());

  return server;
}
