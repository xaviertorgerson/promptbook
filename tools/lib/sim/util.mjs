import { globToRegExp } from '../glob.mjs';

// Small, dependency-free pieces the simulator shares: a seeded PRNG, an event heap, and the glob
// overlap test that decides whether two tasks' `touches` can name the same file.

// mulberry32: a 32-bit seeded generator. Same seed, same stream, on every platform.
export function makeRng(seed) {
  let s = (Number(seed) >>> 0) ^ 0x9e3779b9;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: ([a, b]) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    hex: (n) => Array.from({ length: n }, () => Math.floor(next() * 16).toString(16)).join(''),
  };
}

// A binary min-heap of events ordered by time, then by insertion order, so ties are deterministic.
export class Heap {
  constructor() { this.items = []; }

  get size() { return this.items.length; }

  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (Heap.less(a[p], a[i])) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && Heap.less(a[l], a[m])) m = l;
        if (r < a.length && Heap.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }

  static less(x, y) { return x.at < y.at || (x.at === y.at && x.seq < y.seq); }
}

const WILD = /[*?[]/;
const normalize = (g) => {
  const s = g.replace(/^\.\//, '');
  return s.endsWith('/') ? `${s}**` : s;
};

// Can two glob segments (no "/") match a common string? Exact when either is literal or each has one
// wildcard run; otherwise it compares the literal prefix and suffix, which can only over-report.
function segmentsOverlap(a, b) {
  if (a === b) return true;
  const wa = WILD.test(a);
  const wb = WILD.test(b);
  if (!wa && !wb) return false;
  if (!wa) return globToRegExp(b).test(a);
  if (!wb) return globToRegExp(a).test(b);
  if (a.includes('[') || b.includes('[')) return true;
  const ends = (s) => {
    const first = s.search(WILD);
    let last = first;
    for (let i = s.length - 1; i >= 0; i -= 1) if (s[i] === '*' || s[i] === '?') { last = i; break; }
    return [s.slice(0, first), s.slice(last + 1)];
  };
  const [pa, sa] = ends(a);
  const [pb, sb] = ends(b);
  return (pa.startsWith(pb) || pb.startsWith(pa)) && (sa.endsWith(sb) || sb.endsWith(sa));
}

// Do two path globs match a common path? Segment by segment; ** spans any number of segments.
export function globsOverlap(x, y) {
  const A = normalize(x).split('/');
  const B = normalize(y).split('/');
  const memo = new Map();
  const go = (i, j) => {
    const key = i * 4096 + j;
    if (memo.has(key)) return memo.get(key);
    let r;
    if (i === A.length && j === B.length) r = true;
    else if (i < A.length && A[i] === '**') r = go(i + 1, j) || (j < B.length && go(i, j + 1));
    else if (j < B.length && B[j] === '**') r = go(i, j + 1) || (i < A.length && go(i + 1, j));
    else if (i === A.length || j === B.length) r = false;
    else r = segmentsOverlap(A[i], B[j]) && go(i + 1, j + 1);
    memo.set(key, r);
    return r;
  };
  return go(0, 0);
}

export const touchesOverlap = (a = [], b = []) => a.some((x) => b.some((y) => globsOverlap(x, y)));

export const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
