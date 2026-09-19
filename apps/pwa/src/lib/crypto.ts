import { db } from './db';

// AES-GCM with a non-extractable key held in IndexedDB. This protects against
// something reading the storage file off disk or an extension enumerating
// storage. It does NOT protect against script injection in the page (injected
// script can call decrypt); the CSP and absence of third-party scripts do that.

async function masterKey(): Promise<CryptoKey> {
  const existing = await db.secrets.get('master');
  if (existing) return existing.value as CryptoKey;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await db.secrets.put({ id: 'master', value: key });
  return key;
}

export async function saveApiKey(provider: string, apiKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await masterKey(), new TextEncoder().encode(apiKey));
  await db.secrets.put({ id: `key:${provider}`, value: { iv, ct } });
}

export async function loadApiKey(provider: string): Promise<string | null> {
  const rec = await db.secrets.get(`key:${provider}`);
  if (!rec) return null;
  const { iv, ct } = rec.value as { iv: Uint8Array<ArrayBuffer>; ct: ArrayBuffer };
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await masterKey(), ct));
  } catch {
    return null;
  }
}

export const hasApiKey = async (provider: string) => !!(await db.secrets.get(`key:${provider}`));
export const clearApiKey = (provider: string) => db.secrets.delete(`key:${provider}`);
