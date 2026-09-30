// Paper and pencil for every .page (identity.md §05). Strokes are drawn with
// perfect-freehand so they taper with pressure, then grained by #graphite.
//   data-mark: highlight (the focus) · squiggle (a guess) · strike (dropped) ·
//              star (critical path) · question (open decision) · loop (just changed) ·
//              arrow:<id> (depends on)
//   data-box / data-box="done": a hand-drawn checkbox, ticked in ink when done
//   .textaction (not .link) and [data-circle]: pencil-circled on hover
// Load as a module: <script type="module" src="marks.js"></script>
import { getStroke } from "https://cdn.jsdelivr.net/npm/perfect-freehand@1.2.2/+esm";

const NS = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Graphite grain for pencil, a faint bleed for ink that soaked in
document.body.insertAdjacentHTML("afterbegin", `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <filter id="graphite" x="-5%" y="-20%" width="110%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.9 0 0 0 1.6" result="holes"/>
    <feComposite in="SourceGraphic" in2="holes" operator="in" result="grainy"/>
    <feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="1" seed="9" result="w"/>
    <feDisplacementMap in="grainy" in2="w" scale="1.1" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="bleed" x="-2%" y="-10%" width="104%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="2" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale=".9" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>`);

const node = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// Seeded randomness, so marks don't reshuffle on every resize
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const avg = (a, b) => (a + b) / 2;
function outline(points) {
  if (points.length < 4) return "";
  let [a, b, c] = points;
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2; i < points.length - 1; i++) {
    a = points[i]; b = points[i + 1];
    d += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `;
  }
  return d + "Z";
}

// Sample a curve f(t) -> [x, y] with a hand's slow wobble and a pressure arc
function hand(f, { n = 40, wobble = 0.6, seed = 1, press = [0.3, 0.55] } = {}) {
  const r = rng(seed), ph = r() * 6, ph2 = r() * 6;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, [x, y] = f(t);
    return [x + Math.sin(t * 5 + ph) * wobble, y + Math.sin(t * 7 + ph2) * wobble, press[0] + press[1] * Math.sin(Math.PI * t)];
  });
}

let masks = 0;

function drawPage(page, pageIndex) {
  const css = getComputedStyle(document.documentElement);
  const C = k => css.getPropertyValue(k).trim();
  const ink = C("--ink"), pencil = C("--graphite"), accent = C("--accent"), hi = C("--hi");

  page.querySelectorAll(":scope > .marks-under, :scope > .marks-over").forEach(n => n.remove());
  const under = node("svg", { class: "marks-under", "aria-hidden": "true" });
  const over = node("svg", { class: "marks-over", "aria-hidden": "true" });
  const defs = node("defs");
  over.append(defs);
  page.prepend(under, over);

  const P = page.getBoundingClientRect();
  const rel = r => ({ l: r.left - P.left, t: r.top - P.top, r: r.right - P.left, b: r.bottom - P.top, w: r.width, h: r.height });
  const marginX = parseFloat(getComputedStyle(page, "::before").left) / 2 || 17;

  const lineRects = el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = [];
    for (const r of [...range.getClientRects()].filter(r => r.width > 1).map(rel)) {
      const same = lines.find(x => Math.abs(x.b - r.b) < 4);
      if (same) { same.l = Math.min(same.l, r.l); same.r = Math.max(same.r, r.r); same.t = Math.min(same.t, r.t); same.w = same.r - same.l; }
      else lines.push({ ...r });
    }
    return lines;
  };
  const union = lines => {
    const b = { l: Math.min(...lines.map(l => l.l)), r: Math.max(...lines.map(l => l.r)), t: Math.min(...lines.map(l => l.t)), b: Math.max(...lines.map(l => l.b)) };
    return { ...b, w: b.r - b.l, h: b.b - b.t };
  };

  function stroke(pts, { color = pencil, size = 1.8, thinning = 0.6, grain = true, into = over, taper = true, opacity = 1 } = {}) {
    const g = node("g", grain ? { filter: "url(#graphite)" } : {});
    const p = node("path", {
      d: outline(getStroke(pts, {
        size, thinning, smoothing: 0.6, streamline: 0.35, simulatePressure: false,
        start: { taper: taper ? size * 6 : 0, cap: true }, end: { taper: taper ? size * 9 : 0, cap: true },
      })),
      fill: color, opacity,
    });
    g.append(p);
    into.append(g);
    return p;
  }

  // Draw a stroke in along its own centre line
  function drawIn(path, pts, { dur = 900, delay = 0, width = 16 } = {}) {
    const id = `reveal${masks++}`;
    const mask = node("mask", { id, maskUnits: "userSpaceOnUse", x: -50, y: -50, width: P.width + 100, height: P.height + 100 });
    const line = node("path", {
      d: "M" + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L"),
      fill: "none", stroke: "#fff", "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round",
      pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1,
    });
    mask.append(line);
    defs.append(mask);
    path.setAttribute("mask", `url(#${id})`);
    line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: dur, delay, easing: "cubic-bezier(.55,.1,.35,1)", fill: "forwards" });
  }

  const ellipse = (box, seed, turns = 1.12, pad = [10, 7]) => {
    const cx = (box.l + box.r) / 2, cy = (box.t + box.b) / 2;
    const rx = box.w / 2 + pad[0], ry = box.h / 2 + pad[1];
    const squash = 0.92 + rng(seed)() * 0.1;
    return hand(t => {
      const a = -2.5 + t * Math.PI * 2 * turns, shrink = 1 - t * 0.07;
      return [cx + Math.cos(a) * rx * shrink, cy + Math.sin(a) * ry * shrink * squash - t * 3];
    }, { n: 70, wobble: 0.9, seed, press: [0.35, 0.6] });
  };

  page.querySelectorAll("[data-mark]").forEach((el, i) => {
    const kind = el.dataset.mark, seed = 11 + i * 7 + pageIndex * 101;
    const lines = lineRects(el);
    if (!lines.length) return;

    if (kind === "highlight") {
      lines.forEach((L, j) => {
        const y = L.t + L.h * 0.6;
        stroke(hand(t => [L.l - 5 + t * (L.w + 10), y + 1.5 - t * 2.5], { n: 16, wobble: 0.8, seed: seed + j, press: [0.9, 0.1] }),
          { color: hi, size: L.h * 0.72, thinning: 0.05, grain: false, into: under, taper: false });
      });
    }

    if (kind === "squiggle") {
      lines.forEach((L, j) => {
        stroke(hand(t => [L.l + t * L.w, L.b + 1 + Math.sin(t * L.w / 3.2) * 1.8], { n: Math.round(L.w / 1.5), wobble: 0.3, seed: seed + j }),
          { size: 1.5, thinning: 0.5 });
      });
    }

    if (kind === "strike") {
      lines.forEach((L, j) => {
        const y = L.t + L.h * 0.56;
        stroke(hand(t => [L.l - 4 + t * (L.w + 8), y + 1.5 - t * 3], { n: 24, wobble: 0.5, seed: seed + j }), { size: 1.7 });
      });
    }

    if (kind === "star") {
      const L = lines[0], cx = marginX, cy = L.t + L.h / 2, R = 8;
      const tips = [0, 2, 4, 1, 3, 0].map(k => {
        const a = -Math.PI / 2 + k * 2 * Math.PI / 5;
        return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
      });
      const r = rng(seed), pts = [];
      for (let k = 0; k < tips.length - 1; k++)
        for (let s = 0; s < 6; s++) pts.push([tips[k][0] + (tips[k + 1][0] - tips[k][0]) * s / 6 + (r() - .5) * .8, tips[k][1] + (tips[k + 1][1] - tips[k][1]) * s / 6 + (r() - .5) * .8]);
      pts.push([...tips.at(-1)]);
      stroke(pts.map((p, k) => [p[0], p[1], .4 + .4 * Math.sin(Math.PI * k / pts.length)]), { size: 1.6, thinning: 0.4 });
    }

    if (kind === "question") {
      const L = lines[0];
      const t = node("text", { x: marginX, y: L.b - 3, "text-anchor": "middle", fill: pencil, filter: "url(#graphite)", "font-family": "Caveat, cursive", "font-size": 30, "font-weight": 600, transform: `rotate(-6 ${marginX} ${L.b})` });
      t.textContent = "?";
      over.append(t);
    }

    if (kind === "loop") {
      const pts = ellipse(union(lines), seed);
      const p = stroke(pts, { color: accent, size: 2.3, thinning: 0.55 });
      if (document.documentElement.hasAttribute("data-fresh") && !reduced) drawIn(p, pts, { dur: 1100, delay: 450, width: 14 });
    }

    if (kind.startsWith("arrow:")) {
      // Out through the margin and back in, never across text
      const target = document.getElementById(kind.slice(6));
      if (!target) return;
      const T = lineRects(target)[0], A = lines[0];
      const s = [A.l - 12, A.t + A.h / 2], e = [T.l - 8, T.t + T.h / 2];
      const c1 = [marginX - 4, s[1]], c2 = [marginX - 4, e[1]];
      const bez = t => {
        const u = 1 - t;
        return [0, 1].map(k => u * u * u * s[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * e[k]);
      };
      stroke(hand(bez, { n: 60, wobble: 0.8, seed }), { size: 1.5, thinning: 0.5 });
      const up = e[1] < s[1] ? 1 : -1;
      stroke(hand(t => [e[0] - 9 + t * 9, e[1] + 6 * up - t * 6 * up], { n: 8, wobble: 0.2, seed: seed + 1 }), { size: 1.5 });
      stroke(hand(t => [e[0] - 10 + t * 10, e[1] - 5 * up + t * 5 * up], { n: 8, wobble: 0.2, seed: seed + 2 }), { size: 1.5 });
    }
  });

  // Hand-drawn checkboxes, ticked in ink when done
  page.querySelectorAll("[data-box]").forEach((el, i) => {
    const b = rel(el.getBoundingClientRect()), seed = 200 + i * 13 + pageIndex * 101, r = rng(seed);
    const j = () => (r() - .5) * 1.6;
    const c = [[b.l + j(), b.t + j()], [b.r + j(), b.t + j()], [b.r + j(), b.b + j()], [b.l + j(), b.b + j()]];
    for (let s = 0; s < 4; s++) {
      const [a, z] = [c[s], c[(s + 1) % 4]], over2 = s === 3 ? 0.18 : 0.08;
      stroke(hand(t => [a[0] + (z[0] - a[0]) * (t * (1 + over2) - over2 / 2), a[1] + (z[1] - a[1]) * (t * (1 + over2) - over2 / 2)], { n: 10, wobble: 0.35, seed: seed + s }),
        { size: 1.5, thinning: 0.45, taper: false, grain: false, opacity: .85 });
    }
    if (el.dataset.box === "done") {
      const tick = [[b.l + 3, b.t + b.h * .5], [b.l + b.w * .42, b.b - 2], [b.r + 5, b.t - 6]], pts = [];
      for (let s = 0; s < 2; s++) for (let k = 0; k <= 10; k++) {
        const t = k / 10, [a, z] = [tick[s], tick[s + 1]];
        pts.push([a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t, s ? 0.8 - t * 0.5 : 0.4 + t * 0.4]);
      }
      stroke(pts, { color: ink, size: 2.6, thinning: 0.6, grain: false });
    }
  });

  // A pencil circles a text action while you hover or focus it
  page.querySelectorAll(".textaction:not(.link), [data-circle]").forEach((el, i) => {
    if (el.closest(".composer")) return;
    el.onmouseenter = el.onfocus = () => {
      el._circle?.remove();
      const lines = lineRects(el);
      if (!lines.length) return;
      const pts = ellipse(union(lines), 500 + i, 1.05, [9, 5]);
      const p = stroke(pts, { size: 1.5, thinning: 0.5 });
      el._circle = p.parentNode;
      if (!reduced) drawIn(p, pts, { dur: 380, width: 10 });
    };
    el.onmouseleave = el.onblur = () => {
      const g = el._circle; if (!g) return;
      el._circle = null;
      g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).onfinish = () => g.remove();
    };
  });
}

// Tear the top edge of slips and leaves
function tear(el, seed) {
  const w = el.offsetWidth, r = rng(seed), pts = [];
  for (let x = 0; x <= w; x += 3 + r() * 5) pts.push(`${x.toFixed(1)}px ${(1 + r() * 4 + (r() < .15 ? 2 : 0)).toFixed(1)}px`);
  pts.push(`${w}px 3px`, "100% 100%", "0 100%");
  el.style.setProperty("--torn", `polygon(${pts.join(",")})`);
}

function draw() {
  document.querySelectorAll(".page").forEach(drawPage);
  document.querySelectorAll(".composer .line-input, .layer .page, [data-torn]").forEach((el, i) => tear(el, 77 + i * 31));
}

let t;
const run = () => { clearTimeout(t); t = setTimeout(draw, 30); };
(document.fonts ? document.fonts.ready : Promise.resolve()).then(run);
addEventListener("resize", run);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", run);
