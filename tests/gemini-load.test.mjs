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

// What compile-policy writes for Gemini, loaded by the real Gemini CLI: settings.json and the
// user-tier policies/harness.toml in a scratch GEMINI_CLI_HOME, read by `gemini mcp list`, which
// runs offline and loads both. A settings value the schema refuses prints "Invalid configuration
// in <file>"; a policy rule Gemini cannot use prints "Policy file error in <file>" and is dropped
// while the command still exits 0, so the output is read, not only the exit code. The CLI is
// GEMINI_BIN, else `gemini` on PATH; without either the suite is skipped.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const onPath = (cmd) => spawnSync(cmd, ['--version'], { encoding: 'utf8' }).status === 0;
const GEMINI = process.env.GEMINI_BIN || (onPath('gemini') ? 'gemini' : null);
const SKIP = GEMINI ? false : 'no Gemini CLI: set GEMINI_BIN=<path to gemini> or put gemini on PATH (npm install @google/gemini-cli) to load the compiled Gemini outputs';

const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-gemini-load-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const rel = (f) => path.relative(ROOT, f);
const REFUSED = /Invalid configuration in|Policy file (error|warning) in|Error parsing settings file|critical error/;

// One compiled file set as the user tier of a fresh home, read from a folder inside it.
function load({ settings, policy }) {
  const home = fs.mkdtempSync(path.join(TMP, 'home-'));
  fs.mkdirSync(path.join(home, '.gemini/policies'), { recursive: true });
  fs.mkdirSync(path.join(home, 'work'));
  fs.writeFileSync(path.join(home, '.gemini/settings.json'), settings);
  fs.writeFileSync(path.join(home, '.gemini/policies/harness.toml'), policy);
  const r = spawnSync(GEMINI, ['mcp', 'list'], { cwd: path.join(home, 'work'), env: { ...process.env, GEMINI_CLI_HOME: home, HOME: home }, encoding: 'utf8', input: '', timeout: 120_000 });
  fs.rmSync(home, { recursive: true, force: true });
  const out = r.error ? String(r.error) : `${r.stdout}${r.stderr}`;
  return { status: r.status, out, refused: r.status !== 0 || REFUSED.test(out) };
}

// Every committed Gemini output: a folder holding settings.json and policies/harness.toml.
const committed = [
  ...fs.readdirSync(path.join(ROOT, 'fixtures/compile-policy/golden/expected')).filter((d) => d.startsWith('gemini-')).map((d) => path.join(ROOT, 'fixtures/compile-policy/golden/expected', d)),
  ...walk(path.join(ROOT, 'examples/tally/_operator/compiled/gemini')).filter((f) => f.endsWith('/settings.json')).map((f) => path.dirname(f)),
].sort();
const readSet = (dir) => ({ settings: fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'), policy: fs.readFileSync(path.join(dir, 'policies/harness.toml'), 'utf8') });

// The fixture policies compiled fresh, as written and with every profile on Gemini and every Gemini
// gap accepted; identical file sets are loaded once.
const FIELDS = ['deny_read', 'forbid', 'ask', 'allow', 'egress', 'sandbox', 'budgets', 'tier'];
const acceptingAll = (p) => ({ ...p, profiles: Object.fromEntries(Object.entries(p.profiles).map(([n, x]) => [n, { ...x, engines: undefined }])), accept_gaps: FIELDS.map((field) => ({ engine: 'gemini', field, profiles: Object.keys(p.profiles), reason: 'the load test' })) });
const policyFiles = ['fixtures/compile-policy/golden/agent-policy.yaml', 'fixtures/compile-policy/dotfiles/agent-policy.yaml', 'examples/tally/_operator/agent-policy.yaml', ...fs.readdirSync(path.join(ROOT, 'fixtures/valid/policy')).map((f) => `fixtures/valid/policy/${f}`)];
const fresh = new Map();
for (const file of policyFiles) {
  const p = parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  for (const [variant, policy] of [['', p], [' (every gap accepted)', acceptingAll(p)]]) {
    for (const profile of Object.keys(policy.profiles)) {
      const r = compilePolicy(policy, { profile, engine: 'gemini' });
      for (const s of r.files.filter((f) => f.path.endsWith('settings.json'))) {
        const dir = path.dirname(s.path);
        const set = { settings: s.content, policy: r.files.find((f) => f.path === path.join(dir, 'policies/harness.toml')).content };
        const key = `${set.settings}\n${set.policy.replace(/^#.*\n/gm, '')}`;
        if (!fresh.has(key)) fresh.set(key, { ...set, name: `${file} ${profile}${variant}${dir === '.' ? '' : ` ${dir}`}` });
      }
    }
  }
}

describe('the real Gemini CLI loads what compile-policy writes', () => {
  if (SKIP) {
    it('loads every compiled Gemini settings.json and policy file', { skip: SKIP }, () => {});
    return;
  }

  it('the Gemini CLI runs, and reads the scratch home: a bad setting and a rule it drops are reported', (t) => {
    const v = spawnSync(GEMINI, ['--version'], { encoding: 'utf8' });
    assert.equal(v.status, 0, `${GEMINI} --version: ${v.stderr}`);
    t.diagnostic(`gemini ${v.stdout.trim()}`);
    const ok = load({ settings: '{}', policy: '' });
    assert.equal(ok.refused, false, ok.out);
    const badSetting = load({ settings: '{"general": {"defaultApprovalMode": "sometimes"}}', policy: '' });
    assert.match(badSetting.out, /Invalid configuration in .*settings\.json/);
    const droppedRule = load({ settings: '{}', policy: '[[rule]]\ntoolName = "read_file"\nargsPattern = "(?:[^\\"]*/)?\\\\.env"\ndecision = "deny"\npriority = 900\n' });
    assert.match(droppedRule.out, /Policy file error in harness\.toml:\s+Unsafe regex pattern \(potential ReDoS\)/);
    assert.equal(droppedRule.status, 0, 'the command still succeeds: only the output says the rule was dropped');
  });

  for (const dir of committed) {
    it(`gemini mcp list loads ${rel(dir)} with no refused setting or rule`, (t) => {
      const r = load(readSet(dir));
      assert.equal(r.refused, false, r.out);
      const notes = r.out.split('\n').filter((l) => /warning|deprecated/i.test(l));
      if (notes.length) t.diagnostic(notes.join('\n'));
    });
  }

  it('every settings.json and policy file compiled fresh from the fixture policies loads, roles included', (t) => {
    const failed = [];
    for (const set of fresh.values()) {
      const r = load(set);
      if (r.refused) failed.push(`${set.name}\n${r.out.slice(0, 2000)}`);
    }
    assert.deepEqual(failed, []);
    t.diagnostic(`${fresh.size} distinct file sets`);
    assert.ok(fresh.size >= 10, `${fresh.size} file sets`);
  });
});
