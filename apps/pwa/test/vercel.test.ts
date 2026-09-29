import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { csp } from '../vite.config';

// vercel.json's CSP response header is hand-maintained (Vercel's config is
// static JSON, not generated at build time), so this pins it to the same
// value vite.config.ts computes for the build-time meta tag. If they drift,
// this fails and says so — the fix is to copy csp(true)'s value into
// vercel.json's Content-Security-Policy header.
//
// This only holds when no VITE_EXTRA_CONNECT_SRC is set at test time: that
// env var extends connect-src for a self-hosted proxy origin and must be
// reflected in vercel.json by hand too. The test is skipped rather than
// failed in that case, since it can't know what a deployment intends to
// add.
const root = resolve(__dirname, '../../..');

describe('vercel.json CSP', () => {
  const skip = !!process.env.VITE_EXTRA_CONNECT_SRC;
  it.skipIf(skip)('matches the build-time CSP with frame-ancestors set', () => {
    const vercelConfig = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
    const headerBlock = vercelConfig.headers.find((h: { source: string }) => h.source === '/(.*)');
    const cspHeader = headerBlock.headers.find((h: { key: string }) => h.key === 'Content-Security-Policy');
    expect(cspHeader.value).toBe(csp(true));
  });
});
