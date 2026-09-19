// Minimal tar reader for npm tarballs (ustar + pax path records). Regular
// files only; everything is returned as UTF-8 text.

export async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const cstr = (b: Uint8Array, from: number, len: number) => {
  const s = b.subarray(from, from + len);
  const end = s.indexOf(0);
  return new TextDecoder().decode(end < 0 ? s : s.subarray(0, end));
};

export function untar(data: Uint8Array): Record<string, string> {
  const files: Record<string, string> = {};
  let off = 0;
  let paxPath: string | null = null;
  while (off + 512 <= data.length) {
    const h = data.subarray(off, off + 512);
    if (h.every((x) => x === 0)) break;
    const name = cstr(h, 0, 100);
    const size = parseInt(cstr(h, 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    const prefix = cstr(h, 345, 155);
    const body = data.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') {
      const m = /\d+ path=([^\n]*)\n/.exec(new TextDecoder().decode(body));
      paxPath = m ? m[1] : null;
    } else if (type === '0' || type === '\0') {
      const path = paxPath ?? (prefix ? `${prefix}/${name}` : name);
      paxPath = null;
      if (path.includes('..')) continue;
      files[path] = new TextDecoder().decode(body);
    } else {
      paxPath = null;
    }
  }
  return files;
}
