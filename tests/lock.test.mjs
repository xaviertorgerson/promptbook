import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { processLock, versionFromRef, withinAutoUpdate } from '../tools/lib/lock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-lock-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com', GIT_CONFIG_NOSYSTEM: '1', HOME: TMP };
const git = (cwd, ...a) => {
  const r = spawnSync('git', ['-C', cwd, ...a], { encoding: 'utf8', env: ENV });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (f, text) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const cli = (cwd, ...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/lock.mjs'), '--cache', path.join(TMP, 'cache'), ...a], { encoding: 'utf8', cwd, env: ENV });

// A pack repository: v1.0.0, v1.1.0 and v2.0.0 tags, a pack under packs/web with its own manifest.
let pack;
const commits = {};
before(() => {
  pack = path.join(TMP, 'pack');
  fs.mkdirSync(pack);
  git(pack, 'init', '-q', '-b', 'main');
  write(path.join(pack, 'README.md'), 'pack\n');
  write(path.join(pack, 'packs/web/package.json'), '{ "name": "web", "version": "0.3.0" }\n');
  write(path.join(pack, 'packs/web/SKILL.md'), 'one\n');
  git(pack, 'add', '.');
  git(pack, 'commit', '-q', '-m', 'one');
  git(pack, 'tag', 'v1.0.0');
  commits.v1 = git(pack, 'rev-parse', 'HEAD');
  write(path.join(pack, 'packs/web/SKILL.md'), 'two\n');
  git(pack, 'commit', '-q', '-am', 'two');
  git(pack, 'tag', 'v1.1.0');
  commits.v11 = git(pack, 'rev-parse', 'HEAD');
  write(path.join(pack, 'packs/web/SKILL.md'), 'three\n');
  git(pack, 'commit', '-q', '-am', 'three');
  git(pack, 'tag', 'v2.0.0');
  commits.v2 = git(pack, 'rev-parse', 'HEAD');
});

// A project that pins the pack as a local path, the harness entry being the pack's root.
function project(name, entries) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  write(path.join(dir, 'toolkit.lock'), `# pinned toolkit\n${stringify({ lock_version: 1, entries })}`);
  return dir;
}
const harnessEntry = (over = {}) => ({ name: 'harness', layer: 'L3', kind: 'harness', source: '../pack', ref: 'v1.0.0', autoUpdate: 'minor', ...over });
const webEntry = (over = {}) => ({ name: 'web-pack', layer: 'L4', kind: 'stack-pack', source: '../pack', path: 'packs/web', ref: 'main', autoUpdate: 'off', ...over });
const lockOf = (dir) => parse(fs.readFileSync(path.join(dir, 'toolkit.lock'), 'utf8'));
const rules = (r) => r.entries.flatMap((e) => e.findings.map((f) => `${f.severity}:${f.rule}`));

describe('lock', () => {
  it('pins commit, subdirectory tree and version from local git, with no network, and keeps comments', () => {
    const dir = project('pin', [harnessEntry(), webEntry()]);
    const r = cli(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const text = fs.readFileSync(path.join(dir, 'toolkit.lock'), 'utf8');
    assert.match(text, /^# pinned toolkit/);
    const l = lockOf(dir);
    assert.equal(l.entries[0].commit, commits.v1);
    assert.equal(l.entries[0].tree, git(pack, 'rev-parse', 'v1.0.0^{tree}'));
    assert.equal(l.entries[0].version, '1.0.0', 'from the tag');
    assert.equal(l.entries[1].commit, commits.v2);
    assert.equal(l.entries[1].tree, git(pack, 'rev-parse', `${commits.v2}:packs/web`), 'the pinned subdirectory, not the root');
    assert.equal(l.entries[1].version, '0.3.0', 'from the pack manifest');
    assert.equal(l.generated_by, 'harness/lock@1.0.0');
    assert.deepEqual(Object.keys(l.entries[1]), ['name', 'layer', 'kind', 'source', 'path', 'ref', 'commit', 'tree', 'version', 'autoUpdate']);
    const v = spawnSync(process.execPath, [path.join(ROOT, 'tools/validate.mjs'), path.join(dir, 'toolkit.lock')], { encoding: 'utf8' });
    assert.equal(v.status, 0, v.stdout);
    assert.equal(cli(dir, '--check').status, 0);
  });

  it('--check exits 1 on a tree that changed (a rewritten mirror), naming the entry', () => {
    const dir = project('tree', [harnessEntry(), webEntry()]);
    cli(dir);
    const l = lockOf(dir);
    l.entries[1].tree = git(pack, 'rev-parse', `${commits.v1}:packs/web`);
    write(path.join(dir, 'toolkit.lock'), stringify(l));
    const r = cli(dir, '--check');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^DRIFT web-pack/m);
    assert.match(r.stdout, /error {3}tree-matches: packs\/web at /);
  });

  it('--check exits 1 on a moved tag and on a pinned commit that no longer exists', () => {
    const dir = project('tag', [harnessEntry({ ref: 'v1.1.0' }), webEntry({ commit: 'f'.repeat(40), tree: 'e'.repeat(40), version: '0.3.0' })]);
    cli(dir);
    const l = lockOf(dir);
    l.entries[0].commit = commits.v1;
    l.entries[0].tree = git(pack, 'rev-parse', 'v1.0.0^{tree}');
    l.entries[0].version = '1.1.0';
    write(path.join(dir, 'toolkit.lock'), stringify(l));
    const r = processLock(lockOf(dir), { mode: 'check', lockDir: dir });
    assert.ok(rules(r).includes('error:tag-unmoved'), rules(r).join());
    assert.ok(rules(r).includes('error:commit-exists'), rules(r).join());
    assert.equal(cli(dir, '--check').status, 1);
  });

  it('a branch that moved ahead is a warning; one rewritten past the pin is drift', () => {
    const branch = path.join(TMP, 'branchy');
    fs.cpSync(pack, branch, { recursive: true });
    git(branch, 'checkout', '-q', '-b', 'release', 'v1.0.0');
    git(branch, 'commit', '-q', '--allow-empty', '-m', 'pinned');
    const dir = project('branch', [harnessEntry({ source: '../branchy', ref: 'release', version: '1.0.0' })]);
    assert.equal(cli(dir).status, 0);
    write(path.join(branch, 'NEW.md'), 'x\n');
    git(branch, 'add', '.');
    git(branch, 'commit', '-q', '-m', 'ahead');
    let r = processLock(lockOf(dir), { mode: 'check', lockDir: dir });
    assert.deepEqual(rules(r), ['warning:ref-advanced']);
    git(branch, 'reset', '-q', '--hard', 'v1.0.0');
    git(branch, 'commit', '-q', '--allow-empty', '-m', 'rewritten');
    r = processLock(lockOf(dir), { mode: 'check', lockDir: dir });
    assert.ok(rules(r).includes('error:pin-on-ref'), rules(r).join());
  });

  it('--update moves within autoUpdate (minor stays below 2.0.0); a named entry moves to the newest tag', () => {
    const dir = project('update', [harnessEntry(), webEntry()]);
    cli(dir);
    let r = cli(dir, '--update');
    assert.equal(r.status, 0, r.stdout);
    assert.equal(lockOf(dir).entries[0].ref, 'v1.1.0');
    assert.equal(lockOf(dir).entries[0].commit, commits.v11);
    assert.equal(lockOf(dir).entries[0].version, '1.1.0');
    r = cli(dir, '--update', 'harness');
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /^MOVED harness v2\.0\.0 /m);
    assert.equal(lockOf(dir).entries[0].version, '2.0.0');
    assert.equal(cli(dir, '--check').status, 0);
  });

  it('a version that disagrees with the tag is drift', () => {
    const dir = project('version', [harnessEntry({ version: '9.9.9' })]);
    const r = processLock(lockOf(dir), { mode: 'lock', lockDir: dir });
    assert.ok(rules(r).includes('error:version-matches'), rules(r).join());
  });

  it('remote sources: ls-remote + a blob-less fetch (file: URL); an unreachable remote fails clearly', () => {
    const bare = path.join(TMP, 'remote.git');
    spawnSync('git', ['clone', '-q', '--bare', pack, bare], { env: ENV });
    git(bare, 'config', 'uploadpack.allowFilter', 'true');
    git(bare, 'config', 'uploadpack.allowAnySHA1InWant', 'true');
    const dir = project('remote', [harnessEntry({ source: `file://${bare}`, ref: 'v1.1.0' }), webEntry({ source: `file://${bare}` })]);
    const r = cli(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const l = lockOf(dir);
    assert.equal(l.entries[0].commit, commits.v11);
    assert.equal(l.entries[0].tree, git(pack, 'rev-parse', 'v1.1.0^{tree}'));
    assert.equal(l.entries[1].tree, git(pack, 'rev-parse', `${commits.v2}:packs/web`));
    assert.equal(l.entries[1].version, '0.3.0', 'manifest read through the partial clone');
    assert.equal(cli(dir, '--check').status, 0);

    const gone = project('gone', [harnessEntry({ source: `file://${path.join(TMP, 'nope.git')}` })]);
    const g = cli(gone);
    assert.equal(g.status, 1);
    assert.match(g.stdout, /error {3}source-unreachable: cannot reach file:\/\/.*nope\.git/);
    const off = cli(gone, '--offline');
    assert.equal(off.status, 0);
    assert.match(off.stdout, /warning skipped-offline/);
  });

  it('a lock that breaks the contract fails --check before any git call; usage errors exit 2', () => {
    const dir = project('contract', [webEntry()]);
    const r = cli(dir, '--check');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /does not satisfy the toolkit-lock contract/);
    assert.equal(cli(dir, '--check', '--update').status, 2);
    assert.equal(cli(dir, '--update', 'nobody').status, 2);
    assert.equal(cli(path.join(TMP, 'pack', 'packs')).status, 2, 'no toolkit.lock there');
  });

  it('helpers: versions from refs, autoUpdate ranges', () => {
    assert.equal(versionFromRef('v1.2.3'), '1.2.3');
    assert.equal(versionFromRef('template/v1.3.0'), '1.3.0');
    assert.equal(versionFromRef('main'), null);
    assert.ok(withinAutoUpdate('1.2.3', '1.2.9', 'patch'));
    assert.ok(!withinAutoUpdate('1.2.3', '1.3.0', 'patch'));
    assert.ok(withinAutoUpdate('1.2.3', '1.9.0', 'minor'));
    assert.ok(!withinAutoUpdate('1.2.3', '2.0.0', 'minor'));
    assert.ok(!withinAutoUpdate('1.2.3', '1.2.4-rc.1', 'major'), 'never a prerelease');
    assert.ok(!withinAutoUpdate('1.2.3', '9.0.0', 'off'));
  });
});
