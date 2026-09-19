// Declarative migration rules: data, never executable code. A migration that
// needs new logic ships in an app release, gated by `appVersionMin`.
//
// Rule shapes (paths are dotted; `[]` fans out over every array element):
//   { op: 'setDefault', path: 'plan.linesOfOperation[].status', value: 'on_schedule' }
//   { op: 'rename', from: 'a.b', to: 'a.c' }
//   { op: 'remove', path: 'a.b' }

const isObj = (v) => v !== null && typeof v === 'object';

function walk(node, segs, fn) {
  if (!isObj(node) || segs.length === 0) return;
  const [head, ...rest] = segs;
  const fan = head.endsWith('[]');
  const key = fan ? head.slice(0, -2) : head;
  if (rest.length === 0 && !fan) { fn(node, key); return; }
  const child = node[key];
  if (fan) {
    if (Array.isArray(child)) for (const el of child) rest.length ? walk(el, rest, fn) : fn(child, child.indexOf(el));
  } else {
    walk(child, rest, fn);
  }
}

const segs = (p) => String(p).split('.').filter(Boolean);

export function applyRules(doc, rules) {
  const out = structuredClone(doc);
  for (const r of rules) {
    if (r.op === 'setDefault') {
      walk(out, segs(r.path), (o, k) => { if (o[k] === undefined) o[k] = structuredClone(r.value); });
    } else if (r.op === 'remove') {
      walk(out, segs(r.path), (o, k) => { delete o[k]; });
    } else if (r.op === 'rename') {
      const from = segs(r.from);
      const to = segs(r.to);
      const parentFrom = from.slice(0, -1);
      const last = from[from.length - 1];
      const target = to[to.length - 1];
      const visit = (o) => { if (isObj(o) && last in o) { o[target] = o[last]; delete o[last]; } };
      if (parentFrom.length === 0) visit(out);
      else walk(out, [...parentFrom, '__self__'], (o) => visit(o));
    } else {
      throw new Error(`unknown migration op "${r.op}"`);
    }
  }
  return out;
}

/** Turn a manifest's declarative migration list into readGoal() migrations. */
export function migrationsFromRules(list) {
  return list.map((m) => ({ from: m.from, to: m.to, transform: (doc) => applyRules(doc, m.rules ?? []) }));
}
