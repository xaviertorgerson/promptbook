import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { compilePolicy } from '../tools/lib/compile-policy.mjs';
import { walk } from '../tools/lib/glob.mjs';
import { toToml } from '../tools/lib/toml.mjs';

// What compile-policy writes for Codex, loaded by the real Codex CLI: every config.toml with
// `codex features list` in a scratch CODEX_HOME (a config Codex cannot load exits 1 with "failed to
// load configuration"), every rules file with `codex execpolicy check`, which parses it and checks
// each rule's match examples. The CLI is CODEX_BIN, else `codex` on PATH; without either the
// suite is skipped.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOTFILES_L1_POLICY = process.env.HARNESS_DOTFILES_L1_POLICY ?? '/home/claude/wt-dotfiles-l1/home/.chezmoidata/agent-policy.yaml';
// The dotfiles commit the compiled output beside the policy's data: home/.chezmoitemplates/agent-policy.
const DOTFILES_COMPILED = path.join(path.dirname(path.dirname(DOTFILES_L1_POLICY)), '.chezmoitemplates/agent-policy');

const onPath = (cmd) => spawnSync(cmd, ['--version'], { encoding: 'utf8' }).status === 0;
const CODEX = process.env.CODEX_BIN || (onPath('codex') ? 'codex' : null);
const SKIP = CODEX ? false : 'no Codex CLI: set CODEX_BIN=<path to codex> or put codex on PATH (npm install @openai/codex) to load the compiled Codex outputs';

const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-codex-load-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const rel = (f) => (f.startsWith(ROOT) ? path.relative(ROOT, f) : f);
const errorOf = (r) => (r.error ? String(r.error) : `${r.stderr}${r.stdout}`.split('\n').filter((l) => /error|caused by|^\s{2,}\S/i.test(l)).join('\n').slice(0, 2000));

// A config as the only file of a fresh CODEX_HOME, run from there so no project layer joins it.
function loadConfig(text) {
  const home = fs.mkdtempSync(path.join(TMP, 'home-'));
  fs.writeFileSync(path.join(home, 'config.toml'), text);
  const r = spawnSync(CODEX, ['features', 'list'], { cwd: home, env: { ...process.env, CODEX_HOME: home }, encoding: 'utf8', timeout: 60_000 });
  fs.rmSync(home, { recursive: true, force: true });
  return r;
}

function checkRules(file, argv) {
  const home = fs.mkdtempSync(path.join(TMP, 'home-'));
  const r = spawnSync(CODEX, ['execpolicy', 'check', '--rules', file, ...argv], { cwd: home, env: { ...process.env, CODEX_HOME: home }, encoding: 'utf8', timeout: 60_000 });
  fs.rmSync(home, { recursive: true, force: true });
  return r;
}

const committedRoots = [
  ...fs.readdirSync(path.join(ROOT, 'fixtures/compile-policy/golden/expected')).filter((d) => d.startsWith('codex-')).map((d) => path.join(ROOT, 'fixtures/compile-policy/golden/expected', d)),
  path.join(ROOT, 'examples/tally/_operator/compiled/codex'),
  ...(fs.existsSync(DOTFILES_COMPILED) ? fs.readdirSync(DOTFILES_COMPILED).filter((d) => d.startsWith('codex-')).map((d) => path.join(DOTFILES_COMPILED, d)) : []),
];
const committed = committedRoots.flatMap((d) => walk(d)).sort();
const configs = committed.filter((f) => f.endsWith('config.toml'));
const rulesFiles = committed.filter((f) => f.endsWith('.rules'));

// Every policy the fixtures hold, compiled fresh for Codex: each profile and role that compiles,
// as written and with every profile on Codex and every Codex gap accepted, so the mappings a policy
// refuses as written (an allow rule outside the sandbox, a degraded tier) are loaded too.
const load = (f) => parse(fs.readFileSync(f, 'utf8'));
const FIELDS = ['deny_read', 'forbid', 'ask', 'allow', 'egress', 'sandbox', 'budgets', 'tier'];
const acceptingAll = (policy) => ({
  ...policy,
  profiles: Object.fromEntries(Object.entries(policy.profiles).map(([n, p]) => [n, { ...p, engines: undefined }])),
  accept_gaps: FIELDS.map((field) => ({ engine: 'codex', field, profiles: Object.keys(policy.profiles), reason: 'the load test' })),
});
const policyFiles = [
  path.join(ROOT, 'fixtures/compile-policy/golden/agent-policy.yaml'),
  path.join(ROOT, 'fixtures/compile-policy/dotfiles/agent-policy.yaml'),
  path.join(ROOT, 'examples/tally/_operator/agent-policy.yaml'),
  ...fs.readdirSync(path.join(ROOT, 'fixtures/valid/policy')).map((f) => path.join(ROOT, 'fixtures/valid/policy', f)),
  ...(fs.existsSync(DOTFILES_L1_POLICY) ? [DOTFILES_L1_POLICY] : []),
];
const fresh = policyFiles.flatMap((file) => [['', load(file)], [' (every gap accepted)', acceptingAll(load(file))]].flatMap(([variant, policy]) => Object.keys(policy.profiles).flatMap((profile) => {
  const r = compilePolicy(policy, { profile, engine: 'codex' });
  const compile = `${rel(file)} ${profile}${variant}`;
  return r.files.map((f) => ({ ...f, compile, name: `${compile}: ${f.path}` }));
})));

describe('the real Codex CLI loads what compile-policy writes', () => {
  if (SKIP) {
    it('loads every compiled Codex config and rules file', { skip: SKIP }, () => {});
    return;
  }

  it('the Codex CLI runs', (t) => {
    const r = spawnSync(CODEX, ['--version'], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${CODEX} --version: ${errorOf(r)}`);
    t.diagnostic(r.stdout.trim());
    assert.ok(configs.length >= 7 && rulesFiles.length >= 7, `${configs.length} configs, ${rulesFiles.length} rules files committed`);
  });

  for (const f of configs) {
    it(`codex features list loads ${rel(f)}`, () => {
      const r = loadConfig(fs.readFileSync(f, 'utf8'));
      assert.equal(r.status, 0, errorOf(r));
    });
  }

  for (const f of rulesFiles) {
    it(`codex execpolicy check loads ${rel(f)} and forbids a force-push`, () => {
      const r = checkRules(f, ['git', 'push', '--force', 'origin', 'main']);
      assert.equal(r.status, 0, errorOf(r));
      assert.equal(JSON.parse(r.stdout).decision, 'forbidden', r.stdout);
    });
  }

  it('every config.toml and rules file compiled fresh from the fixture policies loads, roles included', (t) => {
    const failed = [];
    let n = 0;
    for (const f of fresh.filter((x) => x.path.endsWith('config.toml'))) {
      n += 1;
      const r = loadConfig(f.content);
      if (r.status !== 0) failed.push(`${f.name}\n${errorOf(r)}`);
    }
    for (const f of fresh.filter((x) => x.path.endsWith('.rules'))) {
      n += 1;
      const file = path.join(TMP, 'fresh.rules');
      fs.writeFileSync(file, f.content);
      const r = checkRules(file, ['true']);
      if (r.status !== 0) failed.push(`${f.name}\n${errorOf(r)}`);
    }
    assert.deepEqual(failed, []);
    t.diagnostic(`${n} files from ${new Set(fresh.map((f) => f.compile)).size} compiles`);
    assert.ok(n >= 40, `${n} files loaded`);
  });

  it('mcp-restrictions.toml merged into a config that defines its servers loads; config.toml never holds the table', (t) => {
    const withMcp = fresh.filter((f) => f.path.endsWith('mcp-restrictions.toml'));
    assert.ok(withMcp.length >= 5, `${withMcp.length} fragments`);
    for (const frag of withMcp) {
      const cfg = fresh.find((f) => f.compile === frag.compile && path.dirname(f.path) === path.dirname(frag.path) && f.path.endsWith('config.toml'));
      assert.ok(cfg, frag.name);
      assert.equal(cfg.data.mcp_servers, undefined, cfg.name);
      // What the merge step makes: the operator's server entry, with the fragment's keys folded in.
      const servers = Object.fromEntries(Object.entries(frag.data.mcp_servers).map(([id, keys]) => [id, { command: 'true', ...keys }]));
      const r = loadConfig(toToml({ ...cfg.data, mcp_servers: servers }));
      assert.equal(r.status, 0, `${frag.name}: ${errorOf(r)}`);
    }
    const alone = loadConfig(withMcp[0].content);
    t.diagnostic(`the fragment alone as config.toml: exit ${alone.status}${alone.status ? `, ${errorOf(alone).split('\n').find((l) => /invalid|error/i.test(l)) ?? ''}` : ''}`);
  });
});
