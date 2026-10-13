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
