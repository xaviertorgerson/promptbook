import { globsOverlap } from '../glob.mjs';

export { globsOverlap };

// Small, dependency-free pieces the simulator shares: a seeded PRNG, an event heap, and the lane test
// (two tasks' `touches` can name the same file; globsOverlap lives in ../glob.mjs).

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

export const touchesOverlap = (a = [], b = []) => a.some((x) => b.some((y) => globsOverlap(x, y)));

export const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
