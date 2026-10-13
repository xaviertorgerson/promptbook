import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { assertNoUnsafeKeys, commandMatches, compilePolicy, diffClaudeSettings, ENGINES, expandCommand, globArgsPattern, parseSettingsTemplate, renderDiff } from '../tools/lib/compile-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'fixtures/compile-policy');
const GOLDEN = path.join(FIX, 'golden');
const UPDATE = process.env.UPDATE_GOLDEN === '1';
const DOTFILES = process.env.HARNESS_DOTFILES ?? '/home/claude/dotfiles';
const STAGEHAND = process.env.HARNESS_STAGEHAND ?? '/tmp/claude-0/-home-claude/4cb75181-a255-5446-ad02-7fa332a70b56/scratchpad/repos_sh/stagehand';
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-policy-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const load = (f) => parse(fs.readFileSync(f, 'utf8'));
const golden = load(path.join(GOLDEN, 'agent-policy.yaml'));
const report = (r) => `${JSON.stringify({ tier: r.tier, warnings: r.warnings, accepted: r.accepted.map(({ field, reason }) => ({ field, reason })), notes: r.notes }, null, 2)}\n`;
const git = (cwd, ...a) => spawnSync('git', ['-c', 'safe.directory=*', '-C', cwd, ...a], { encoding: 'utf8' });

describe('compile-policy goldens', () => {
  for (const engine of ENGINES) {
    for (const profile of Object.keys(golden.profiles)) {
      it(`${engine} × ${profile} (tier ${golden.profiles[profile].tier}) matches its golden files`, () => {
        const r = compilePolicy(golden, { profile, engine });
        assert.equal(r.ok, true, JSON.stringify(r.errors, null, 2));
        const dir = path.join(GOLDEN, 'expected', `${engine}-${profile}`);
        const files = [...r.files, { path: 'report.json', content: report(r) }];
        if (UPDATE) {
          fs.rmSync(dir, { recursive: true, force: true });
          for (const f of files) {
            fs.mkdirSync(path.dirname(path.join(dir, f.path)), { recursive: true });
            fs.writeFileSync(path.join(dir, f.path), f.content);
          }
        }
        for (const f of files) {
          const want = path.join(dir, f.path);
          assert.ok(fs.existsSync(want), `missing golden ${path.relative(ROOT, want)} (run UPDATE_GOLDEN=1 node --test tests/compile-policy.test.mjs)`);
          assert.equal(f.content, fs.readFileSync(want, 'utf8'), `${engine}-${profile}/${f.path} differs from its golden`);
        }
      });
    }
  }
});

describe('compile-policy contract', () => {
  it('never emits a key that removes a wall, on any engine, tier or fixture', () => {
    const policies = [golden, load(path.join(FIX, 'dotfiles/agent-policy.yaml')), load(path.join(ROOT, 'fixtures/valid/policy/agent-policy.yaml'))];
    let compiled = 0;
    for (const p of policies) {
      for (const engine of ENGINES) {
        for (const profile of Object.keys(p.profiles)) {
          const r = compilePolicy(p, { profile, engine });
          for (const f of r.files) {
            compiled += 1;
            assert.doesNotMatch(f.content, /disableAllHooks|hooksConfig|disableYoloMode|danger-full-access|dangerously-skip-permissions/, `${engine}/${profile}/${f.path}`);
            if (p.profiles[profile].tier !== 'autonomous') assert.doesNotMatch(f.content, /bypassPermissions|skipDangerousModePermissionPrompt|yolo/, `${engine}/${profile}/${f.path}`);
          }
        }
      }
    }
    assert.ok(compiled >= 30, `compiled ${compiled} files`);
    assert.throws(() => assertNoUnsafeKeys([{ path: 'settings.json', content: '{"disableAllHooks": true}' }], { engine: 'claude', tier: 'autonomous' }), /removes a wall/);
    assert.throws(() => assertNoUnsafeKeys([{ path: 'settings.json', content: '{"permissions":{"defaultMode":"bypassPermissions"}}' }], { engine: 'claude', tier: 'ask' }), /bypass key outside/);
  });

  const refusals = {
    'bypass-preconditions': { profile: 'laptop', engine: 'claude', match: /sandbox\.enabled: true, sandbox\.fail_if_unavailable: true, egress\.default: deny/ },
    unrepresentable: { profile: 'laptop', engine: 'codex', match: /codex cannot represent forbid/ },
    'never-disable-hooks': { profile: 'laptop', engine: 'claude', match: /never disables hooks/ },
    'example-matches': { profile: 'laptop', engine: 'codex', match: /does not match/ },
    'unattended-caps': { profile: 'ci', engine: 'claude', match: /max_turns, max_usd/ },
  };
  for (const [rule, c] of Object.entries(refusals)) {
    it(`refuses: ${rule}, and writes nothing`, () => {
      const r = compilePolicy(load(path.join(FIX, 'refuse', `${rule}.yaml`)), { profile: c.profile, engine: c.engine });
      assert.equal(r.ok, false);
      assert.deepEqual(r.files, []);
      const e = r.errors.find((x) => x.rule === rule);
      assert.ok(e, `expected ${rule}, got ${r.errors.map((x) => x.rule)}`);
      assert.match(e.message, c.match);
    });
  }

  it('fails closed on an unrepresentable deny until accept_gaps names it, and prints the stanza', () => {
    for (const engine of ['codex', 'gemini']) {
      const without = { ...golden, accept_gaps: golden.accept_gaps.filter((g) => g.engine !== engine) };
      const r = compilePolicy(without, { profile: 'laptop', engine });
      assert.equal(r.ok, false, engine);
      for (const e of r.errors) {
        assert.equal(e.rule, 'unrepresentable');
        assert.match(e.stanza, new RegExp(`engine: ${engine}, field: ${e.field}, reason: `));
      }
      const fields = new Set(r.errors.map((e) => e.field));
      assert.ok(fields.has(engine === 'codex' ? 'forbid' : 'deny_read'), [...fields].join());
    }
  });

  it('drops an unrepresentable ask with a warning, never an error', () => {
    const r = compilePolicy(golden, { profile: 'laptop', engine: 'codex' });
    assert.equal(r.ok, true);
    const dropped = r.warnings.filter((w) => w.rule === 'dropped').map((w) => w.message);
    assert.ok(dropped.some((m) => /^ask write infra\/\*\*/.test(m)), dropped.join('\n'));
    assert.ok(dropped.some((m) => /^ask tool web-search/.test(m)), dropped.join('\n'));
  });

  it('an ask in the unattended tier compiles to a denial, never to a prompt', () => {
    const codex = compilePolicy(golden, { profile: 'ci', engine: 'codex' }).files.find((f) => f.path === 'rules/harness.rules').content;
    assert.match(codex, /pattern = \["psql"\],\n {4}decision = "forbidden"/);
    assert.doesNotMatch(codex, /"prompt"/);
    const claude = JSON.parse(compilePolicy(golden, { profile: 'ci', engine: 'claude' }).files.find((f) => f.path === 'runner.json').content);
    assert.deepEqual(claude.args.slice(0, 2), ['--permission-mode', 'dontAsk']);
    assert.ok(claude.args.includes('--max-turns') && claude.args.includes('--max-budget-usd'));
  });

  it('Claude: one deny per alternative, absolute paths as //, **.host as apex and subdomains', () => {
    const s = JSON.parse(compilePolicy(golden, { profile: 'laptop', engine: 'claude' }).files[0].content);
    for (const rule of ['Bash(git push --force *)', 'Bash(git push -f *)', 'Read(//etc/shadow)', 'Read(~/.ssh/**)', 'WebFetch(domain:internal.example.com)', 'WebFetch(domain:*.internal.example.com)', 'mcp__prod-db__execute', 'Edit(**/.git/hooks/**)']) {
      assert.ok(s.permissions.deny.includes(rule), rule);
    }
    assert.equal(s.permissions.defaultMode, 'acceptEdits');
    assert.equal(s.sandbox.network.strictAllowlist, true);
  });

  it('Codex: every rule\'s match examples match its own pattern', () => {
    for (const profile of Object.keys(golden.profiles)) {
      const text = compilePolicy(golden, { profile, engine: 'codex' }).files.find((f) => f.path === 'rules/harness.rules').content;
      const blocks = [...text.matchAll(/pattern = (\[.*\]),\n[\s\S]*?match = (\[.*\]),/g)];
      assert.ok(blocks.length >= 5);
      for (const [, pat, ex] of blocks) for (const e of JSON.parse(ex)) assert.ok(commandMatches(JSON.parse(pat), e.split(' ')), `${e} vs ${pat}`);
    }
  });

  it('Codex: the stagehand herdr rules round-trip through the policy (adapters/herdr)', { skip: !fs.existsSync(STAGEHAND) }, () => {
    const src = git(STAGEHAND, 'show', 'HEAD:.codex/rules/herdr.rules');
    assert.equal(src.status, 0, src.stderr);
    const rules = [...src.stdout.matchAll(/pattern = (\[[\s\S]*?\]),\n\s*decision = "(\w+)"/g)].map(([, pat, decision]) => ({ command: JSON.parse(pat), decision }));
    assert.ok(rules.length >= 15, `${rules.length} rules parsed`);
    const list = { allow: 'allow', prompt: 'ask', forbidden: 'forbid' };
    const policy = { policy_version: 1, profiles: { box: { tier: 'ask' } }, deny_read: ['**/.env'], forbid: [], ask: [], allow: [] };
    for (const r of rules) policy[list[r.decision]].push({ command: r.command });
    const out = compilePolicy(policy, { profile: 'box', engine: 'codex' }).files.find((f) => f.path === 'rules/harness.rules').content;
    for (const r of rules) assert.ok(out.includes(`pattern = ${JSON.stringify(r.command).replace(/","/g, '", "').replace(/\["/g, '["').replace(/,\[/g, ', [')},\n    decision = "${r.decision}"`), `${JSON.stringify(r.command)} → ${r.decision}`);
  });

  it('Gemini: read denies match path arguments, single or listed, and nothing else', () => {
    const re = new RegExp(globArgsPattern('**/.env'));
    assert.ok(re.test(JSON.stringify({ file_path: '/w/app/.env' })));
    assert.ok(re.test(JSON.stringify({ paths: ['/w/a.ts', '/w/.env'] })));
    assert.ok(!re.test(JSON.stringify({ file_path: '/w/.envrc' })));
    const home = new RegExp(globArgsPattern('~/.ssh/**'));
    assert.ok(home.test(JSON.stringify({ absolute_path: '/home/u/.ssh/id_ed25519' })));
    assert.deepEqual(expandCommand(['git', 'push', ['--force', '-f']]), [['git', 'push', '--force'], ['git', 'push', '-f']]);
  });
});

describe('compile-policy against the real dotfiles settings', () => {
  const tmpl = path.join(DOTFILES, 'home/dot_claude/settings.json.tmpl');
  const policy = load(path.join(FIX, 'dotfiles/agent-policy.yaml'));

  for (const ref of ['fix/agent-setup', 'main']) {
    it(`reports the differences from settings.json.tmpl on ${ref}, and never loosens a hand-written wall`, { skip: !fs.existsSync(tmpl) }, (t) => {
      const shown = git(DOTFILES, 'show', `${ref}:home/dot_claude/settings.json.tmpl`);
      if (shown.status !== 0) return t.skip(`no ${ref} in ${DOTFILES}`);
      const hand = parseSettingsTemplate(shown.stdout);
      const r = compilePolicy(policy, { profile: 'workstation', engine: 'claude', source: 'agent-policy.yaml' });
      assert.equal(r.ok, true, JSON.stringify(r.errors));
      const compiled = JSON.parse(r.files[0].content);
      const d = diffClaudeSettings(compiled, hand);
      t.diagnostic(`dotfiles ${ref}:\n${renderDiff(d)}`);
      assert.deepEqual(d.lists['permissions.deny'].onlyHandwritten, [], 'every hand-written deny is compiled');
      assert.equal(d.scalars['permissions.defaultMode'].same, true);
      assert.equal(d.scalars.skipDangerousModePermissionPrompt.same, true);
      assert.ok(d.lists['permissions.deny'].onlyCompiled.includes('Bash(terraform apply *)'), 'the soft_deny prose became a wall');
      assert.ok(d.lists['permissions.allow'].onlyHandwritten.includes('Write(*)'), 'Write(*) is never consulted by Claude Code');
      assert.equal(d.sandbox.handwritten, null, 'the hand-written file has no sandbox');
      assert.ok(d.outsidePolicy.includes('autoMode') && d.outsidePolicy.includes('hooks'));
    });
  }

  it('the CLI prints the diff and exits 0', { skip: !fs.existsSync(tmpl) }, () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/compile-policy.mjs'), path.join(FIX, 'dotfiles/agent-policy.yaml'), '--profile', 'workstation', '--engine', 'claude', '--diff', tmpl], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^diff: compiled claude settings vs .* — different$/m);
    assert.match(r.stdout, /^ {4}- Write\(\*\) {3}\(hand-written only\)$/m);
  });
});

describe('compile-policy CLI', () => {
  const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/compile-policy.mjs'), ...a], { encoding: 'utf8', cwd: ROOT });

  it('writes the files with --out and exits 0; refuses with 1 and writes nothing', () => {
    const out = path.join(TMP, 'ok');
    const ok = cli('fixtures/compile-policy/golden/agent-policy.yaml', '--profile', 'ci', '--engine', 'codex', '--out', out);
    assert.equal(ok.status, 0, ok.stderr);
    assert.ok(fs.existsSync(path.join(out, 'rules/harness.rules')) && fs.existsSync(path.join(out, 'ci.config.toml')));
    const bad = path.join(TMP, 'bad');
    const no = cli('fixtures/compile-policy/refuse/bypass-preconditions.yaml', '--profile', 'laptop', '--engine', 'claude', '--out', bad);
    assert.equal(no.status, 1);
    assert.match(no.stderr, /REFUSED claude for profile laptop/);
    assert.ok(!fs.existsSync(bad));
  });

  it('validates the policy first, and exits 2 on usage errors', () => {
    const bad = cli('fixtures/invalid/policy/one-matcher-per-rule.yaml', '--profile', 'personal', '--engine', 'claude');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /not a valid policy/);
    assert.equal(cli('fixtures/compile-policy/golden/agent-policy.yaml', '--profile', 'ci', '--engine', 'vim').status, 2);
    assert.equal(cli('fixtures/compile-policy/golden/agent-policy.yaml', '--engine', 'claude').status, 2);
  });
});
