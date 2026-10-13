import fs from 'node:fs';
import path from 'node:path';

// Minimal globbing with no dependency: `*` matches within one path segment and is captured (so a
// contract can bind specs/*/tasks/*.md captures to frontmatter fields), `**` matches any depth.

export const SKIP_DIRS = new Set(['node_modules', '.git', 'worktrees', 'dist', 'build', 'coverage', 'playwright-report', 'test-results', '.sim-out']);

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '([^/]*)';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export const toPosix = (p) => p.split(path.sep).join('/');

// Match a glob against the path or any trailing run of its segments, so specs/*/tasks/*.md matches
// /abs/project/specs/x/tasks/X-1.md. Returns the captures, or null. A suffix directly under a
// dot-directory does not match unless the glob names it: .claude/skills/x/SKILL.md is an engine's
// skill, not an L3 skills/*/SKILL.md.
export function matchSuffix(file, glob) {
  const re = globToRegExp(glob);
  const segs = toPosix(file).split('/').filter(Boolean);
  for (let i = 0; i < segs.length; i += 1) {
    if (i > 0 && segs[i - 1].startsWith('.')) continue;
    const m = re.exec(segs.slice(i).join('/'));
    if (m) return { captures: m.slice(1), matched: segs.slice(i).join('/') };
  }
  return null;
}

export function walk(root, { skip = SKIP_DIRS } = {}) {
  const out = [];
  const visit = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (skip.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visit(p);
      else if (e.isFile()) out.push(p);
    }
  };
  if (fs.statSync(root).isDirectory()) visit(root);
  else out.push(root);
  return out;
}

// Files under root whose root-relative path matches any of the globs.
export function findFiles(root, globs, opts) {
  const res = globs.map(globToRegExp);
  return walk(root, opts).filter((f) => {
    const rel = toPosix(path.relative(root, f));
    return res.some((re) => re.test(rel));
  });
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
