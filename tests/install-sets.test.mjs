import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

// `promptbook install-sets` against a real library repository at a pin: what it copies, what it
// records, and what --check catches with and without the library's checkout.
const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'cli.mjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'install-sets-'));
let project;
let lib;
const git = (cwd, ...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd, encoding: 'utf8' }).stdout.trim();
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const skill = (name, description, extra = '') => `---\nname: ${name}\ndescription: ${description}\n${extra}---\n\n# ${name}\n`;
const run = (...args) => spawnSync(process.execPath, [CLI, 'install-sets', ...args], { cwd: project, encoding: 'utf8', env: { ...process.env, SKILLDEX_HOME: '' } });
const record = () => JSON.parse(fs.readFileSync(path.join(project, '.claude/skills/VENDORED.json'), 'utf8')).libraries.skilldex;

const SETS = `budget: { limit: 8000, headroom: 0.1 }
sets:
  core: { scope: project, about: the two, skills: [alpha, beta], loaded_with: [mine] }
  mine: { scope: user, about: one beside, skills: [delta] }
`;
const lockFor = (sk) => [
  'lock_version: 1', 'entries:',
  '  - name: promptbook', '    layer: L3', '    kind: promptbook', '    source: https://example.invalid/promptbook', '    ref: main',
  `    commit: ${'0'.repeat(40)}`, `    tree: ${'0'.repeat(40)}`, '    version: 0.1.0', '    autoUpdate: patch',
  '  - name: skilldex', '    layer: L3', '    kind: skill-library', '    source: ../skilldex', '    path: skills', '    sets: [core]', '    ref: main',
  `    commit: ${sk.commit}`, `    tree: ${sk.tree}`, '    version: 0.0.0+abc', '    autoUpdate: "off"', '',
].join('\n');
const pinOf = (repo, sub) => ({ commit: git(repo, 'rev-parse', 'HEAD'), tree: git(repo, 'rev-parse', `HEAD:${sub}`) });

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(root, 'case-'));
  lib = path.join(dir, 'skilldex');
  project = path.join(dir, 'project');
  write(path.join(lib, 'skills/alpha/SKILL.md'), skill('alpha', 'Use when alpha. Do not use for beta (beta).'));
  write(path.join(lib, 'skills/alpha/references/notes.md'), 'notes\n');
  write(path.join(lib, 'skills/beta/SKILL.md'), skill('beta', 'Use when beta. Do not use for alpha (alpha).'));
  write(path.join(lib, 'skills/beta/evals/routing.jsonl'), '{"prompt":"x","expect":"no-trigger","kind":"near-miss","route_to":"elsewhere"}\n');
  write(path.join(lib, 'skills/gamma/SKILL.md'), skill('gamma', 'Use when gamma.'));
  write(path.join(lib, 'skills/delta/SKILL.md'), skill('delta', `Use when ${'d'.repeat(40)}.`));
  write(path.join(lib, 'skills/SETS.yaml'), SETS);
  git(lib, 'init', '-q'); git(lib, 'add', '.'); git(lib, 'commit', '-qm', 'pin');
  write(path.join(project, 'toolkit.lock'), lockFor(pinOf(lib, 'skills')));
  write(path.join(project, '.claude/skills/own/SKILL.md'), skill('own', 'Use when own.', 'origin: template\n'));
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

const DELTA = `Use when ${'d'.repeat(40)}.`.length;

test('install copies each skill of the pinned sets into both skill folders, at the pinned tree', () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  for (const d of ['.claude/skills', '.agents/skills']) {
    assert.ok(fs.existsSync(path.join(project, d, 'alpha/references/notes.md')), `${d}/alpha`);
    assert.ok(fs.existsSync(path.join(project, d, 'beta/SKILL.md')), `${d}/beta`);
    assert.ok(!fs.existsSync(path.join(project, d, 'gamma')), `${d}/gamma is in no pinned set`);
    assert.ok(!fs.existsSync(path.join(project, d, 'delta')), `${d}/delta is only loaded beside`);
  }
  const rec = record();
  assert.equal(rec.skills.alpha, git(lib, 'rev-parse', 'HEAD:skills/alpha'));
  assert.deepEqual(rec.library, ['alpha', 'beta', 'delta', 'gamma']);
  assert.deepEqual(rec.beside, ['elsewhere']);
  assert.deepEqual(rec.loaded_with, { mine: { chars: DELTA, skills: ['delta'] } });
  assert.equal(rec.budget, 7200);
});

test('--check passes with no library checkout, and says the pin was not re-read', () => {
  assert.equal(run().status, 0);
  fs.renameSync(lib, `${lib}-gone`);
  const r = run('--check');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /2 installed skill\(s\) match skilldex@/);
  assert.match(r.stdout, /pin not re-read \(no checkout\)/);
});

test('--check fails when an installed copy is edited', () => {
  assert.equal(run().status, 0);
  fs.appendFileSync(path.join(project, '.agents/skills/alpha/SKILL.md'), 'a local edit\n');
  const r = run('--check');
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /\.agents\/skills\/alpha hashes to [0-9a-f]{12}; skilldex pins/);
});

test('--check fails when a project skill takes an installed name', () => {
  assert.equal(run().status, 0);
  write(path.join(project, '.claude/skills/my-alpha/SKILL.md'), skill('alpha', 'Use when mine.', 'origin: project\n'));
  const r = run('--check');
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /\.claude\/skills\/my-alpha is the project's own skill named alpha/);
});

test('install refuses to overwrite a project skill that has an installed name', () => {
  const own = skill('beta', 'Use when the project means beta.', 'origin: project\n');
  write(path.join(project, '.claude/skills/beta/SKILL.md'), own);
  const r = run();
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /\.claude\/skills\/beta is the project's own skill named beta/);
  assert.equal(fs.readFileSync(path.join(project, '.claude/skills/beta/SKILL.md'), 'utf8'), own);
});

test('--check fails when toolkit.lock moves past the copies, until the install runs again', () => {
  assert.equal(run().status, 0);
  write(path.join(lib, 'skills/beta/SKILL.md'), skill('beta', 'Use when beta, newer. Do not use for alpha (alpha).'));
  git(lib, 'commit', '-qam', 'newer');
  write(path.join(project, 'toolkit.lock'), lockFor(pinOf(lib, 'skills')));
  const r = run('--check');
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /the copies are of [0-9a-f]{12} \(core\), toolkit\.lock pins/);
  assert.equal(run().status, 0);
  assert.equal(run('--check').status, 0);
  assert.match(fs.readFileSync(path.join(project, '.claude/skills/beta/SKILL.md'), 'utf8'), /newer/);
});

test('the budget counts what each engine lists: installed, what loads beside, and the own skills Claude Code lists', () => {
  write(path.join(project, '.claude/skills/quiet/SKILL.md'), skill('quiet', 'Use when only a person starts it.', 'disable-model-invocation: true\n'));
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  const installed = 'Use when alpha. Do not use for beta (beta).'.length + 'Use when beta. Do not use for alpha (alpha).'.length;
  assert.match(r.stdout, new RegExp(`claude ${installed + DELTA + 'Use when own.'.length}/7200, codex ${installed + DELTA}/7200`));
});

test('--check fails when the descriptions an engine lists exceed the budget, naming the way out', () => {
  assert.equal(run().status, 0);
  write(path.join(project, '.claude/skills/own/SKILL.md'), skill('own', `Use when ${'x'.repeat(7200)}.`, 'origin: template\n'));
  const r = run('--check');
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /claude loads \d+ characters of descriptions, over 7200 .*disable-model-invocation/);
  assert.doesNotMatch(r.stderr, /codex loads/);
});

test('--root and --lock point it at another project; the library is found beside that root or at $SKILLDEX_HOME', () => {
  const elsewhere = path.join(path.dirname(project), 'elsewhere');
  write(path.join(elsewhere, 'toolkit.lock'), fs.readFileSync(path.join(project, 'toolkit.lock'), 'utf8'));
  const r = spawnSync(process.execPath, [CLI, 'install-sets', '--root', elsewhere], { cwd: os.tmpdir(), encoding: 'utf8', env: { ...process.env, SKILLDEX_HOME: lib } });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(elsewhere, '.claude/skills/alpha/SKILL.md')));
});

test('--resolve prints the skills the named sets install and refuses the wrong scope', () => {
  const ok = run('--resolve', 'mine', '--sets', path.join(lib, 'skills/SETS.yaml'), '--scope', 'user');
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.trim(), 'delta');
  const bad = run('--resolve', 'core', '--sets', path.join(lib, 'skills/SETS.yaml'), '--scope', 'user');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /set core is project, not a user-scope set/);
  const none = run('--resolve', 'nope', '--sets', path.join(lib, 'skills/SETS.yaml'));
  assert.equal(none.status, 1);
  assert.match(none.stderr, /has no set nope/);
});

test('a lock with no skill library installs nothing and says so', () => {
  write(path.join(project, 'toolkit.lock'), lockFor(pinOf(lib, 'skills')).split('\n').slice(0, 10).join('\n') + '\n');
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /names no skill library with install sets/);
});
