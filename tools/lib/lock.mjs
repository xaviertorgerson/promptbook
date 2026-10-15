import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import { registry as sharedRegistry } from './registry.mjs';

// toolkit.lock (schemas/toolkit-lock.schema.json): resolve each entry's ref to a commit and the git
// tree id of its pinned subdirectory, with git plumbing only.
//
//   local source   a path (/abs, ./rel, ../rel; relative to the lock file): read in place, no network.
//   remote source  https://, ssh://, git@, file: URLs: `git ls-remote` resolves the ref, then a
//                  blob-less, depth-1 fetch of the pinned commit into a cache yields the tree id.
//                  An unreachable remote is an error that says so; --offline skips remotes.
//
// lock:     fill commit, tree and version where missing; keep every existing pin (a pin moves only
//           with --update, which honours autoUpdate unless the entry is named). An untagged source
//           with no manifest is versioned by its commit, 0.0.0+<sha>, and that version follows the pin.
// --check:  verify, change nothing. Drift (errors): the pinned commit is gone, its tree is not the
//           recorded one, a tag now names another commit, a branch no longer contains the pin, the
//           version disagrees with the tag or the manifest, or a 0.0.0+<sha> names another commit
//           than the pin. A branch that moved ahead is an available update (warning).
//           A CI checkout (detached, or shallow) may hold no local branch: a branch ref also resolves
//           through refs/remotes/origin/<ref>, and when it resolves nowhere there, the pin is
//           verified by its commit and tree alone (a warning, ref-absent).

export const GENERATOR = 'promptbook/lock@1.0.0';
const KEY_ORDER = ['name', 'layer', 'kind', 'source', 'path', 'sets', 'ref', 'commit', 'tree', 'version', 'autoUpdate', 'mirrored'];
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const TAG_VERSION = /(?:^|[/-])v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/;
// The version of an untagged pin: 0.0.0 with the commit as build metadata (toolkit-lock contract).
const UNTAGGED = /^0\.0\.0\+([0-9a-f]{7,40})$/;

// 0.0.0+<sha> for a commit, as long an abbreviation as the version it replaces (7 by default).
export function untaggedVersion(commit, prior = null) {
  const n = prior?.match(UNTAGGED)?.[1].length ?? 7;
  return `0.0.0+${commit.slice(0, n)}`;
}

export const isRemote = (source) => /^(?:https:\/\/|ssh:\/\/|git@|file:)/.test(source);

export function git(cwd, args, { timeout = 30000, allowFail = false } = {}) {
  const r = spawnSync('git', cwd ? ['-C', cwd, ...args] : args, {
    encoding: 'utf8',
    timeout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo', SSH_ASKPASS: 'echo', GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? 'ssh -o BatchMode=yes' },
  });
  const out = { ok: r.status === 0 && !r.error, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() || (r.error ? r.error.message : ''), timedOut: r.error?.code === 'ETIMEDOUT' };
  if (!out.ok && !allowFail) throw new Error(`git ${args.join(' ')}: ${out.stderr.split('\n').at(-1)}`);
  return out;
}

export function versionFromRef(ref) {
  return ref.match(TAG_VERSION)?.[1] ?? null;
}

// [major, minor, patch, prerelease|null]; build metadata (+sha) is accepted and, as semver says,
// ignored for precedence.
const semver = (v) => v.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/)?.slice(1).map((x, i) => (i < 3 ? Number(x) : x ?? null));

function compareSemver(a, b) {
  const x = semver(a);
  const y = semver(b);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  if (x[3] === y[3]) return 0;
  if (x[3] === null) return 1;
  if (y[3] === null) return -1;
  return x[3] < y[3] ? -1 : 1;
}

// May an updater move from version a to b under autoUpdate? Prereleases are never picked automatically.
export function withinAutoUpdate(a, b, mode) {
  const x = semver(a);
  const y = semver(b);
  if (!x || !y || y[3] !== null || compareSemver(b, a) <= 0) return false;
  if (mode === 'major') return true;
  if (mode === 'minor') return x[0] === y[0];
  if (mode === 'patch') return x[0] === y[0] && x[1] === y[1];
  return false;
}

// ------------------------------------------------------------------------------------- sources

// The tree id of a directory at a commit ('' or '.' is the root), or null when it is not a directory.
function treeOf(repo, commit, dir) {
  const rel = path.posix.normalize(dir || '.').replace(/^\.\/?$/, '').replace(/\/$/, '');
  const r = git(repo, ['rev-parse', '--verify', '--quiet', rel ? `${commit}:${rel}` : `${commit}^{tree}`], { allowFail: true });
  if (!r.ok) return null;
  return git(repo, ['cat-file', '-t', r.stdout], { allowFail: true }).stdout === 'tree' ? r.stdout : null;
}

// A local source: the repository holding the path, and the path's prefix inside it.
class LocalSource {
  constructor(dir) {
    this.dir = dir;
    const top = git(dir, ['rev-parse', '--show-toplevel'], { allowFail: true });
    if (!top.ok) throw new SourceError('source-not-a-repo', `${dir} is not inside a git repository (${top.stderr.split('\n').at(-1)})`);
    this.prefix = git(dir, ['rev-parse', '--show-prefix']).stdout;
  }

  // ref -> { commit, kind: 'tag'|'branch'|'commit'|'other' }. A CI checkout often has the branch
  // only as origin's remote-tracking ref.
  resolve(ref) {
    if (SHA.test(ref)) return this.has(ref) ? { commit: ref, kind: 'commit' } : null;
    for (const [full, kind] of [[`refs/tags/${ref}`, 'tag'], [`refs/heads/${ref}`, 'branch'], [`refs/remotes/origin/${ref}`, 'branch'], [`refs/remotes/${ref}`, 'branch'], [ref, 'other']]) {
      const r = git(this.dir, ['rev-parse', '--verify', '--quiet', `${full}^{commit}`], { allowFail: true });
      if (r.ok && r.stdout) return { commit: r.stdout, kind };
    }
    return null;
  }

  has(commit) {
    return git(this.dir, ['cat-file', '-e', `${commit}^{commit}`], { allowFail: true }).ok;
  }

  tree(commit, sub) {
    return treeOf(this.dir, commit, path.posix.join(this.prefix, sub ?? ''));
  }

  // Containment needs history; a shallow clone cannot say.
  contains(ref, commit) {
    if (this.checkout().shallow) return null;
    return git(this.dir, ['merge-base', '--is-ancestor', commit, ref], { allowFail: true }).ok;
  }

  // A CI checkout: shallow history, or a detached HEAD with no branch of its own.
  checkout() {
    this.state ??= {
      shallow: git(this.dir, ['rev-parse', '--is-shallow-repository'], { allowFail: true }).stdout === 'true',
      detached: !git(this.dir, ['symbolic-ref', '-q', 'HEAD'], { allowFail: true }).ok,
    };
    return this.state;
  }

  show(commit, file) {
    const r = git(this.dir, ['show', `${commit}:${path.posix.join(this.prefix, file)}`], { allowFail: true });
    return r.ok ? r.stdout : null;
  }

  tags() {
    return git(this.dir, ['tag', '--list']).stdout.split('\n').filter(Boolean).map((t) => ({ ref: t, commit: this.resolve(t)?.commit }));
  }

  dirty(sub) {
    return git(this.dir, ['status', '--porcelain', '--', sub ?? '.'], { allowFail: true }).stdout !== '';
  }
}

export class SourceError extends Error {
  constructor(rule, message) {
    super(message);
    this.rule = rule;
  }
}

// A remote source: refs from ls-remote, objects from a blob-less, depth-1 fetch into a cache.
class RemoteSource {
  constructor(url, { cacheDir, timeout }) {
    this.url = url;
    this.timeout = timeout;
    const r = git(null, ['ls-remote', url], { allowFail: true, timeout });
    if (!r.ok) throw new SourceError('source-unreachable', `cannot reach ${url}${r.timedOut ? ` (no answer in ${timeout / 1000}s)` : ''}: ${r.stderr.split('\n').filter(Boolean).at(-1) ?? 'git ls-remote failed'}; check the URL and credentials, or pass --offline to skip remote entries`);
    this.refs = new Map(r.stdout.split('\n').filter(Boolean).map((l) => { const [sha, name] = l.split('\t'); return [name, sha]; }));
    this.cache = path.join(cacheDir, crypto.createHash('sha256').update(url).digest('hex').slice(0, 16));
    if (!fs.existsSync(path.join(this.cache, 'HEAD'))) {
      fs.mkdirSync(this.cache, { recursive: true });
      git(this.cache, ['init', '--bare', '--quiet']);
      git(this.cache, ['remote', 'add', 'origin', url]);
      // A partial clone: trees now, blobs on demand from origin (the manifest read in versionAt).
      git(this.cache, ['config', 'remote.origin.promisor', 'true']);
      git(this.cache, ['config', 'remote.origin.partialclonefilter', 'blob:none']);
      git(this.cache, ['config', 'extensions.partialClone', 'origin']);
    }
    this.prefix = '';
  }

  resolve(ref) {
    if (SHA.test(ref)) return { commit: ref, kind: 'commit' };
    const peeled = this.refs.get(`refs/tags/${ref}^{}`);
    if (peeled) return { commit: peeled, kind: 'tag' };
    for (const [full, kind] of [[`refs/tags/${ref}`, 'tag'], [`refs/heads/${ref}`, 'branch'], [ref, 'other']]) {
      if (this.refs.has(full)) return { commit: this.refs.get(full), kind };
    }
    return null;
  }

  fetch(commit) {
    if (git(this.cache, ['cat-file', '-e', `${commit}^{commit}`], { allowFail: true }).ok) return true;
    return git(this.cache, ['fetch', '--quiet', '--depth=1', '--filter=blob:none', '--no-tags', 'origin', commit], { allowFail: true, timeout: this.timeout * 4 }).ok;
  }

  has(commit) {
    return this.fetch(commit);
  }

  tree(commit, sub) {
    return this.fetch(commit) ? treeOf(this.cache, commit, sub ?? '') : null;
  }

  // Containment needs history; a shallow cache cannot say, so the check reports the branch moving.
  contains() {
    return null;
  }

  checkout() {
    return { shallow: false, detached: false };
  }

  show(commit, file) {
    if (!this.fetch(commit)) return null;
    // Blobs were filtered out; reading one fetches it on demand from the promisor remote.
    const r = git(this.cache, ['show', `${commit}:${file}`], { allowFail: true, timeout: this.timeout });
    return r.ok ? r.stdout : null;
  }

  tags() {
    return [...this.refs.keys()].filter((k) => k.startsWith('refs/tags/') && !k.endsWith('^{}')).map((k) => {
      const ref = k.slice('refs/tags/'.length);
      return { ref, commit: this.resolve(ref).commit };
    });
  }

  dirty() {
    return false;
  }
}

function openSource(entry, { lockDir, cacheDir, timeout }) {
  if (isRemote(entry.source)) return new RemoteSource(entry.source, { cacheDir, timeout });
  const dir = path.resolve(lockDir, entry.source);
  if (!fs.existsSync(dir)) throw new SourceError('source-missing', `${entry.source} does not exist (resolved to ${dir})`);
  return new LocalSource(dir);
}

// The version of the content at a commit: the ref's semver tag, else a manifest in the pinned path.
function versionAt(src, entry, commit, ref) {
  const fromRef = versionFromRef(ref);
  if (fromRef) return { version: fromRef, from: `ref ${ref}` };
  for (const file of ['package.json', '.claude-plugin/plugin.json', 'plugin.json']) {
    const text = src.show(commit, path.posix.join(entry.path ?? '', file));
    if (!text) continue;
    try {
      const v = JSON.parse(text).version;
      if (typeof v === 'string' && semver(v)) return { version: v, from: file };
    } catch { /* not JSON: try the next manifest */ }
  }
  return { version: null, from: null };
}

// ------------------------------------------------------------------------------------- lock

const REQUIRED_INPUT = ['name', 'layer', 'source', 'ref', 'autoUpdate'];

export function readLock(file) {
  const text = fs.readFileSync(file, 'utf8');
  const doc = parseDocument(text, { version: '1.2', uniqueKeys: true });
  if (doc.errors.length) throw new Error(`${file}: YAML: ${doc.errors[0].message.split('\n')[0]}`);
  return { doc, data: doc.toJS(), text };
}

// Whether the file pads its flow collections ([ a, b ]) or not ([a, b]): the first one it writes
// decides, so a rewrite keeps the file's style. A file with none gets the compact form.
export function flowPadding(text) {
  const m = text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n').match(/(?:^|[:,-])[ \t]*[[{]( ?)[^\s\]}]/m);
  return m?.[1] === ' ';
}

// The lock file's text after applyToDoc, in the style the file was written in.
export function serializeLock(lock) {
  return lock.doc.toString({ lineWidth: 0, flowCollectionPadding: flowPadding(lock.text ?? '') });
}

// The next tag an updater may move to under autoUpdate: same tag prefix, highest allowed version.
function nextTag(src, entry, current) {
  const prefix = entry.ref.slice(0, entry.ref.length - (entry.ref.match(TAG_VERSION)?.[0].replace(/^[/-]/, '').length ?? 0));
  const candidates = src.tags().filter((t) => t.ref.startsWith(prefix) && versionFromRef(t.ref) && t.ref.slice(prefix.length).match(/^v?\d/));
  const ok = candidates.filter((t) => withinAutoUpdate(current, versionFromRef(t.ref), entry.autoUpdate));
  ok.sort((a, b) => compareSemver(versionFromRef(b.ref), versionFromRef(a.ref)));
  return ok[0] ?? null;
}

// Resolve or verify every entry. mode: 'lock' | 'check'. update: true (autoUpdate entries) or a Set
// of names (forced). Returns { entries: [{ name, status, findings, before, after }], changed }.
export function processLock(data, { mode = 'check', lockDir = '.', update = null, offline = false, cacheDir = defaultCache(), timeout = 30000 } = {}) {
  const results = [];
  for (const [i, entry] of (data.entries ?? []).entries()) {
    const findings = [];
    const f = (severity, rule, message) => findings.push({ severity, rule, message });
    const r = { index: i, name: entry.name ?? `entries/${i}`, findings, before: { ...entry }, after: { ...entry } };
    results.push(r);
    const missing = REQUIRED_INPUT.filter((k) => entry[k] === undefined);
    if (missing.length) { f('error', 'entry-fields', `missing ${missing.join(', ')}`); continue; }
    if (offline && isRemote(entry.source)) { f('warning', 'skipped-offline', `remote ${entry.source} not checked (--offline)`); continue; }
    let src;
    try {
      src = openSource(entry, { lockDir, cacheDir, timeout });
    } catch (e) {
      if (e instanceof SourceError) { f('error', e.rule, e.message); continue; }
      throw e;
    }

    const now = src.resolve(entry.ref);
    const forced = update instanceof Set && update.has(entry.name);
    const pinned = entry.commit && SHA.test(entry.commit) ? entry.commit : null;

    // Where the pin should be after this run.
    let target = pinned;
    let ref = entry.ref;
    if (!now && !pinned) { f('error', 'ref-resolves', `ref "${entry.ref}" does not resolve in ${entry.source}`); continue; }
    if (!pinned) target = now.commit;
    if (mode === 'lock' && update && (forced || (update === true && entry.autoUpdate !== 'off'))) {
      if (now?.kind === 'tag' && versionFromRef(entry.ref)) {
        const policy = forced ? { ...entry, autoUpdate: 'major' } : entry;
        const next = nextTag(src, policy, versionFromRef(entry.ref));
        if (next) { ref = next.ref; target = next.commit; }
        else if (forced) target = now.commit;
      } else if (now && now.kind !== 'commit') target = now.commit;
    }

    if (!src.has(target)) {
      const why = isRemote(entry.source) ? ' (the remote would not serve it): history was rewritten or the pin is wrong'
        : src.checkout().shallow ? ', a shallow clone: fetch its full history (fetch-depth 0) to verify the pin'
          : ': history was rewritten or the pin is wrong';
      f('error', 'commit-exists', `${target.slice(0, 12)} is not in ${entry.source}${why}`);
      continue;
    }
    const tree = src.tree(target, entry.path);
    if (!tree) { f('error', 'path-exists', `${entry.path ?? '(root)'} does not exist at ${target.slice(0, 12)}`); continue; }

    if (mode === 'check' || target === pinned) {
      if (entry.tree && entry.tree !== tree) f('error', 'tree-matches', `${entry.path ?? '(root)'} at ${target.slice(0, 12)} has tree ${tree.slice(0, 12)}, the lock says ${entry.tree.slice(0, 12)}`);
      if (now && pinned && now.commit !== pinned) {
        if (now.kind === 'tag') f('error', 'tag-unmoved', `tag ${entry.ref} now names ${now.commit.slice(0, 12)}, the lock pins ${pinned.slice(0, 12)}: a rewritten tag`);
        else if (now.kind === 'branch') {
          const contained = src.contains(now.commit, pinned);
          if (contained === false) f('error', 'pin-on-ref', `${entry.ref} no longer contains ${pinned.slice(0, 12)}: the branch was rewritten (force-push)`);
          else f('warning', 'ref-advanced', `${entry.ref} moved to ${now.commit.slice(0, 12)}${contained === null ? ' (containment not checked: shallow history)' : ''}; \`promptbook lock --update ${entry.name}\` moves the pin`);
        }
      }
      const { shallow, detached } = src.checkout();
      if (!now && (shallow || detached)) f('warning', 'ref-absent', `ref "${entry.ref}" not present in this ${shallow ? 'shallow' : 'detached'} checkout of ${entry.source}; verified by commit ${target.slice(0, 12)} and its tree`);
      else if (!now) f('error', 'ref-resolves', `ref "${entry.ref}" no longer resolves in ${entry.source}`);
    }
    if (src.dirty(entry.path)) f('warning', 'source-clean', `${entry.source} has uncommitted changes under ${entry.path ?? '.'}; the pin covers committed content only`);

    // The version follows a pin that moves; otherwise (a check, a kept pin, a first pin of a
    // hand-written entry) the source must agree with what the lock says. With no semver tag and no
    // manifest, the commit is the version (0.0.0+<sha>), unless a human set another by hand.
    const moving = Boolean(pinned) && target !== pinned;
    const v = versionAt(src, entry, target, ref);
    if (v.version && entry.version && v.version !== entry.version && !moving) {
      f('error', 'version-matches', `${v.from} says ${v.version}, the lock says ${entry.version}`);
    }
    const bySha = !v.version && (!entry.version || UNTAGGED.test(entry.version));
    const named = entry.version?.match(UNTAGGED)?.[1];
    if (bySha && named && !target.startsWith(named) && !moving && mode === 'check') {
      f('error', 'version-matches', `version ${entry.version} names commit ${named}, the lock pins ${target.slice(0, 12)}; \`promptbook lock\` rewrites it from the pin`);
    }
    let version;
    if (bySha) version = mode === 'check' ? entry.version ?? untaggedVersion(target) : untaggedVersion(target, entry.version);
    else version = moving || !entry.version ? v.version ?? entry.version : entry.version;

    r.after = { ...entry, ref, commit: target, tree, version };
  }
  const changed = results.some((r) => ['ref', 'commit', 'tree', 'version'].some((k) => r.after[k] !== r.before[k]));
  return { entries: results, changed };
}

export function defaultCache() {
  return path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache'), 'promptbook', 'lock');
}

const keyName = (k) => String(isScalar(k) ? k.value : k);

// Write resolved values into the YAML document, keeping comments, and the schema's key order.
export function applyToDoc(doc, results, { now = new Date() } = {}) {
  const seq = doc.get('entries', true);
  if (!isSeq(seq)) return;
  results.forEach((r) => {
    const node = seq.items[r.index];
    if (!isMap(node)) return;
    for (const k of ['ref', 'commit', 'tree', 'version']) if (r.after[k] !== undefined && r.after[k] !== r.before[k]) node.set(k, r.after[k]);
    const rank = (k) => { const i = KEY_ORDER.indexOf(keyName(k)); return i === -1 ? KEY_ORDER.length : i; };
    node.items.sort((a, b) => rank(a.key) - rank(b.key));
  });
  doc.set('generated_at', now.toISOString().replace(/\.\d{3}Z$/, 'Z'));
  doc.set('generated_by', GENERATOR);
  const top = doc.contents;
  const order = ['lock_version', 'generated_at', 'generated_by', 'entries'];
  const at = (k) => { const i = order.indexOf(keyName(k)); return i === -1 ? order.length : i; };
  top.items.sort((a, b) => at(a.key) - at(b.key));
}

export function validateLock(data, reg = sharedRegistry()) {
  const v = reg.validator('toolkit-lock');
  return v(data) ? [] : v.errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
}
