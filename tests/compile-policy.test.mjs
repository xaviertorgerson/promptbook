import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { forbidHit } from '../tools/guards/forbid-guard.mjs';
import { codexReadKey, codexTakesAccess, commandMatches, compilePolicy, coversInterpreter, diffClaudeSettings, ENGINES, expandCommand, geminiDropsPattern, globArgsPattern, parseSettingsTemplate, renderDiff, renderReport, unsafeKeys } from '../tools/lib/compile-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'fixtures/compile-policy');
const GOLDEN = path.join(FIX, 'golden');
const UPDATE = process.env.UPDATE_GOLDEN === '1';
const DOTFILES = process.env.PROMPTBOOK_DOTFILES ?? '/home/claude/dotfiles';
// The dotfiles' L1 branch, whose policy raises the workstation to Claude's auto mode with x-claude.
const DOTFILES_L1_POLICY = process.env.PROMPTBOOK_DOTFILES_L1_POLICY ?? '/home/claude/wt-dotfiles-l1/home/.chezmoidata/agent-policy.yaml';
const STAGEHAND = process.env.PROMPTBOOK_STAGEHAND ?? '/home/claude/stagehand';
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'promptbook-policy-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const load = (f) => parse(fs.readFileSync(f, 'utf8'));
const golden = load(path.join(GOLDEN, 'agent-policy.yaml'));
const git = (cwd, ...a) => spawnSync('git', ['-c', 'safe.directory=*', '-C', cwd, ...a], { encoding: 'utf8' });

describe('compile-policy goldens', () => {
  for (const engine of ENGINES) {
    for (const profile of Object.keys(golden.profiles)) {
      it(`${engine} × ${profile} (tier ${golden.profiles[profile].tier}) matches its golden files`, () => {
        const r = compilePolicy(golden, { profile, engine });
        assert.equal(r.ok, true, JSON.stringify(r.errors, null, 2));
        const dir = path.join(GOLDEN, 'expected', `${engine}-${profile}`);
        const files = [...r.files, { path: 'report.json', content: renderReport(r) }];
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
          assert.deepEqual(unsafeKeys(r.files, { tier: p.profiles[profile].tier }), [], `${engine}/${profile}`);
        }
      }
    }
    assert.ok(compiled >= 30, `compiled ${compiled} files`);
    const settings = (data) => [{ path: 'settings.json', kind: 'settings-fragment', data }];
    assert.match(unsafeKeys(settings({ disableAllHooks: true }), { tier: 'autonomous' }).join(), /disableAllHooks/);
    assert.match(unsafeKeys(settings({ permissions: { defaultMode: 'bypassPermissions' } }), { tier: 'ask' }).join(), /bypass mode outside/);
    assert.match(unsafeKeys(settings({ hooksConfig: { enabled: false } }), { tier: 'ask' }).join(), /hooksConfig\.enabled false/);
    assert.match(unsafeKeys([{ path: 'config.toml', kind: 'settings-fragment', data: { permissions: { promptbook: { extends: ':danger-full-access' } } } }], { tier: 'ask' }).join(), /full-access/);
    assert.match(unsafeKeys([{ path: 'runner.json', kind: 'runner', data: { args: ['--approval-mode=yolo'] } }], { tier: 'unattended' }).join(), /bypass flag outside/);
    assert.deepEqual(unsafeKeys([{ path: 'runner.json', kind: 'runner', data: { args: ['--approval-mode=yolo'] } }], { tier: 'autonomous' }), []);
  });

  it('a forbid that names a full-access or bypass flag is data, not a key: it compiles on every engine (finding 11)', () => {
    const p = load(path.join(ROOT, 'fixtures/valid/policy/forbid-full-access-flags.yaml'));
    for (const engine of ENGINES) {
      const r = compilePolicy(p, { profile: 'laptop', engine });
      assert.equal(r.ok, true, `${engine}: ${JSON.stringify(r.errors)}`);
    }
    const claude = JSON.parse(compilePolicy(p, { profile: 'laptop', engine: 'claude' }).files[0].content);
    assert.ok(claude.permissions.deny.includes('Bash(claude --dangerously-skip-permissions *)'));
    assert.ok(compilePolicy(p, { profile: 'laptop', engine: 'codex' }).files.find((f) => f.path === 'rules/promptbook.rules').content.includes('"--yolo"'));
  });

  it('an unsafe key in the output is a compile error through the normal channel, never a thrown stack trace', () => {
    const p = load(path.join(FIX, 'refuse/never-disable-hooks.yaml'));
    const r = compilePolicy({ ...p, 'x-claude-extra': undefined, profiles: { laptop: { tier: 'ask', engines: ['claude'] } } }, { profile: 'laptop', engine: 'claude', emit: { claude: (ctx) => [{ path: 'settings.json', kind: 'settings-fragment', content: '{}', data: { disableAllHooks: true } }] } });
    assert.equal(r.ok, false);
    assert.deepEqual(r.files, []);
    assert.ok(r.errors.some((e) => e.rule === 'walls-only' && /settings\.json: disableAllHooks/.test(e.message)), JSON.stringify(r.errors));
  });

  const refusals = {
    'bypass-preconditions': { profile: 'laptop', engine: 'claude', match: /sandbox\.enabled: true, sandbox\.fail_if_unavailable: true, egress\.default: deny/ },
    'bypass-requires': { profile: 'devbox', engine: 'claude', match: /names no preconditions; set requires: \[prod-unreachable-from-this-host/ },
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

  it('a bypass tier isolated outside the policy compiles once the gap is accepted by name; requires reaches the launcher', () => {
    const p = load(path.join(ROOT, 'fixtures/valid/policy/bypass-container.yaml'));
    const r = compilePolicy(p, { profile: 'devbox', engine: 'claude' });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.ok(r.accepted.some((a) => a.field === 'sandbox' && /rootless container/.test(a.reason)));
    assert.deepEqual(JSON.parse(r.files.find((f) => f.path === 'runner.json').content).requires, ['prod-unreachable-from-this-host', 'non-root-container']);
    assert.ok(r.notes.some((n) => /requires: prod-unreachable-from-this-host, non-root-container/.test(n)));
    const unaccepted = compilePolicy({ ...p, accept_gaps: p.accept_gaps.filter((g) => g.field !== 'sandbox') }, { profile: 'devbox', engine: 'claude' });
    assert.ok(unaccepted.errors.some((e) => e.rule === 'bypass-preconditions'), 'without the accepted gap the sandbox is required');
    const unnamed = compilePolicy({ ...p, profiles: { devbox: { ...p.profiles.devbox, requires: undefined } } }, { profile: 'devbox', engine: 'claude' });
    assert.ok(unnamed.errors.some((e) => e.rule === 'bypass-requires'), 'requires is never waived');
  });

  it('fails closed on an unrepresentable deny until accept_gaps names it, and prints the stanza', () => {
    for (const engine of ['codex', 'gemini']) {
      const without = { ...golden, accept_gaps: golden.accept_gaps.filter((g) => g.engine !== engine) };
      const r = compilePolicy(without, { profile: 'laptop', engine });
      assert.equal(r.ok, false, engine);
      for (const e of r.errors) {
        assert.equal(e.rule, 'unrepresentable');
        assert.match(e.stanza, new RegExp(`engine: ${engine}, field: ${e.field}, profiles: \\[laptop\\], reason: `));
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
    const codex = compilePolicy(golden, { profile: 'ci', engine: 'codex' }).files.find((f) => f.path === 'rules/promptbook.rules').content;
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
      const text = compilePolicy(golden, { profile, engine: 'codex' }).files.find((f) => f.path === 'rules/promptbook.rules').content;
      const blocks = [...text.matchAll(/pattern = (\[.*\]),\n[\s\S]*?match = (\[.*\]),/g)];
      assert.ok(blocks.length >= 4, `${profile}: ${blocks.length} rules`);
      for (const [, pat, ex] of blocks) for (const e of JSON.parse(ex)) assert.ok(commandMatches(JSON.parse(pat), e.split(' ')), `${e} vs ${pat}`);
    }
  });

  it('Codex: the stagehand herdr rules round-trip through the policy (adapters/herdr)', { skip: !fs.existsSync(STAGEHAND) }, () => {
    const src = git(STAGEHAND, 'show', 'HEAD:.codex/rules/herdr.rules');
    assert.equal(src.status, 0, src.stderr);
    const rules = [...src.stdout.matchAll(/pattern = (\[[\s\S]*?\]),\n\s*decision = "(\w+)"/g)].map(([, pat, decision]) => ({ command: JSON.parse(pat), decision }));
    assert.ok(rules.length >= 15, `${rules.length} rules parsed`);
    const list = { allow: 'allow', prompt: 'ask', forbidden: 'forbid' };
    const policy = { policy_version: 1, profiles: { box: { tier: 'ask' } }, deny_read: ['**/.env'], forbid: [], ask: [], allow: [], accept_gaps: [{ engine: 'codex', field: 'allow', reason: 'herdr talks to its own server outside the sandbox' }] };
    for (const r of rules) policy[list[r.decision]].push({ command: r.command });
    const out = compilePolicy(policy, { profile: 'box', engine: 'codex' }).files.find((f) => f.path === 'rules/promptbook.rules').content;
    for (const r of rules) assert.ok(out.includes(`pattern = ${JSON.stringify(r.command).replace(/","/g, '", "').replace(/\["/g, '["').replace(/,\[/g, ', [')},\n    decision = "${r.decision}"`), `${JSON.stringify(r.command)} → ${r.decision}`);
  });

  describe('policy 1.3.0: the auto tier, per-profile sandbox and egress, strict sandbox under bypass, credential masks', () => {
    const settings = (r) => JSON.parse(r.files.find((f) => f.path === 'settings.json').content);
    const desk = (engine, p = golden) => compilePolicy(p, { profile: 'desk', engine });

    it('auto is Claude\'s auto mode, and the closest stricter mode, with a warning, where an engine has no classifier', () => {
      const c = desk('claude');
      assert.equal(c.ok, true, JSON.stringify(c.errors));
      assert.equal(settings(c).permissions.defaultMode, 'auto');
      assert.equal(settings(c).skipDangerousModePermissionPrompt, undefined, 'auto is not bypass');
      const codex = desk('codex');
      assert.match(codex.files[0].content, /approval_policy = "on-request"/);
      assert.ok(codex.warnings.some((w) => w.rule === 'degraded' && /classifier/.test(w.message)));
      const gem = desk('gemini');
      assert.equal(settings(gem).general.defaultApprovalMode, 'auto_edit');
      assert.ok(gem.warnings.some((w) => w.rule === 'degraded' && /classifier/.test(w.message)));
    });

    it('auto with a deny egress default fails closed on Claude: WebFetch outside the list is left to the classifier', () => {
      const p = { ...golden, profiles: { ...golden.profiles, desk: { ...golden.profiles.desk, egress: undefined } }, accept_gaps: golden.accept_gaps.filter((g) => !(g.engine === 'claude' && g.field === 'egress')) };
      const r = desk('claude', JSON.parse(JSON.stringify(p)));
      assert.equal(r.ok, false);
      assert.ok(r.errors.some((e) => e.rule === 'unrepresentable' && e.field === 'egress' && /auto-mode classifier/.test(e.message)), JSON.stringify(r.errors));
    });

    it('a profile\'s sandbox and egress override the top-level ones key by key', () => {
      const d = settings(desk('claude'));
      const l = settings(compilePolicy(golden, { profile: 'laptop', engine: 'claude' }));
      assert.deepEqual([d.sandbox.failIfUnavailable, l.sandbox.failIfUnavailable], [false, true]);
      assert.equal(d.sandbox.network.strictAllowlist, undefined, 'the desk\'s egress default is allow');
      assert.equal(l.sandbox.network.strictAllowlist, true);
      assert.deepEqual(d.sandbox.network.allowedDomains, l.sandbox.network.allowedDomains, 'keys the profile does not set come from the top level');
      assert.deepEqual(d.sandbox.filesystem.allowWrite, ['~/.cache/pnpm']);
      const noDefault = { policy_version: 1, profiles: { box: { tier: 'ask', egress: { allow_domains: ['example.com'] } } }, deny_read: ['**/.env'], forbid: [] };
      const r = compilePolicy(noDefault, { profile: 'box', engine: 'claude' });
      assert.ok(r.errors.some((e) => e.rule === 'egress-effective'), JSON.stringify(r.errors));
    });

    it('a bypass tier that relies on the sandbox stops sandbox-blocked commands from retrying unsandboxed; one isolated otherwise does not', () => {
      assert.equal(settings(compilePolicy(golden, { profile: 'devbox', engine: 'claude' })).sandbox.allowUnsandboxedCommands, false);
      for (const profile of ['laptop', 'desk', 'ci']) assert.equal(settings(compilePolicy(golden, { profile, engine: 'claude' })).sandbox.allowUnsandboxedCommands, undefined, profile);
      const container = compilePolicy(load(path.join(ROOT, 'fixtures/valid/policy/bypass-container.yaml')), { profile: 'devbox', engine: 'claude' });
      assert.equal(settings(container).sandbox?.allowUnsandboxedCommands, undefined, 'the sandbox gap is accepted: the container is the isolation');
    });

    it('credential masks compile to sandbox.credentials with TLS termination on Claude, and fail closed elsewhere until accepted', () => {
      const c = desk('claude');
      const s = settings(c).sandbox;
      assert.deepEqual(s.credentials.files, [{ path: '~/.config/gh/hosts.yml', mode: 'mask', extract: 'oauth_token:\\s*(\\S+)', injectHosts: ['api.github.com'] }]);
      assert.deepEqual(s.credentials.envVars, [{ name: 'NPM_TOKEN', mode: 'mask', injectHosts: ['registry.npmjs.org'] }]);
      assert.deepEqual(s.network.tlsTerminate, {});
      assert.ok(c.warnings.some((w) => w.rule === 'mask-not-a-read-deny' && /hosts\.yml/.test(w.message)), 'a mask is not a read deny for the file tools');
      assert.ok(!c.warnings.some((w) => w.rule === 'credential-host-unlisted'), 'both inject hosts are in the allow list');
      const unlisted = JSON.parse(JSON.stringify(golden));
      unlisted.profiles.desk.sandbox.credentials[1].inject_hosts = ['npm.example.org'];
      assert.ok(desk('claude', unlisted).warnings.some((w) => w.rule === 'credential-host-unlisted' && /npm\.example\.org/.test(w.message)));
      for (const engine of ['codex', 'gemini']) {
        const strict = { ...golden, accept_gaps: golden.accept_gaps.filter((g) => !(g.engine === engine && g.field === 'sandbox')) };
        const r = desk(engine, strict);
        assert.ok(r.errors.some((e) => e.field === 'sandbox' && /credential masks/.test(e.message)), `${engine}: ${JSON.stringify(r.errors)}`);
      }
    });

    it('the dotfiles\' x-claude workaround is unnecessary: tier auto gives Claude auto mode and Codex what auto-edit gave it', { skip: !fs.existsSync(DOTFILES_L1_POLICY) }, () => {
      const real = load(DOTFILES_L1_POLICY);
      const { 'x-claude': xClaude, ...rest } = real;
      if (!xClaude?.default_mode?.workstation) {
        assert.equal(real.profiles.workstation.tier, 'auto', 'the migrated dotfiles use the auto tier');
        const c = compilePolicy(real, { profile: 'workstation', engine: 'claude' });
        assert.equal(c.ok, true, JSON.stringify(c.errors));
        assert.equal(settings(c).permissions.defaultMode, 'auto');
        return;
      }
      const workaround = xClaude;
      const migrated = { ...rest, profiles: { ...rest.profiles, workstation: { ...rest.profiles.workstation, tier: 'auto' } } };
      const c = compilePolicy(migrated, { profile: 'workstation', engine: 'claude' });
      assert.equal(c.ok, true, JSON.stringify(c.errors));
      assert.equal(settings(c).permissions.defaultMode, workaround.default_mode.workstation);
      const before = compilePolicy(real, { profile: 'workstation', engine: 'codex' });
      const after = compilePolicy(migrated, { profile: 'workstation', engine: 'codex' });
      const strip = (r) => r.files.filter((f) => f.path !== 'runner.json').map((f) => f.content.replace(/tier [a-z-]+/g, 'tier X'));
      assert.deepEqual(strip(after), strip(before), 'Codex gets the same config and rules');
    });
  });

  // Gemini 0.64.0 matches argsPattern against stableStringify(args): keys sorted, each top-level
  // pair between NUL characters.
  const geminiArgs = (args) => `{${Object.keys(args).sort().map((k) => `\0${JSON.stringify(k)}:${JSON.stringify(args[k])}\0`).join(',')}}`;

  it('Gemini: read denies match path arguments, single or listed, and nothing else', () => {
    const re = new RegExp(globArgsPattern('**/.env'));
    for (const ser of [JSON.stringify, geminiArgs]) {
      assert.ok(re.test(ser({ file_path: '/w/app/.env' })));
      assert.ok(re.test(ser({ file_path: '.env' })));
      assert.ok(re.test(ser({ paths: ['/w/a.ts', '/w/.env'] })));
      assert.ok(re.test(ser({ paths: ['/w/a]b.ts', 'x:y', '/w/.env'] })), 'no earlier entry hides a later one');
      assert.ok(!re.test(ser({ file_path: '/w/.envrc' })));
      assert.ok(!re.test(ser({ file_path: '/w/x.env' })));
    }
    const home = new RegExp(globArgsPattern('~/.ssh/**'));
    assert.ok(home.test(geminiArgs({ absolute_path: '/home/u/.ssh/id_ed25519' })));
    const hooks = new RegExp(globArgsPattern('**/.git/hooks/**'));
    assert.ok(hooks.test(geminiArgs({ content: 'x', file_path: '/w/.git/hooks/pre-commit' })));
    assert.ok(!hooks.test(geminiArgs({ file_path: '/w/README.md', new_string: 'run ".git/hooks/pre-commit" by hand', old_string: 'x' })), 'a later field in its own pair is not a path');
    assert.deepEqual(expandCommand(['git', 'push', ['--force', '-f']]), [['git', 'push', '--force'], ['git', 'push', '-f']]);
  });

  it('Gemini: no argsPattern the compiler writes is one Gemini drops as a potential ReDoS', () => {
    for (const re of ['(?:[^"]*/)?\\.env', '\\[?(?:"[^"]*",)*"x"', 'https?://(?:[^/"]*\\.)?example\\.com']) assert.ok(geminiDropsPattern(re), re);
    for (const re of [globArgsPattern('**/.env'), globArgsPattern('src/**/gen/*.ts'), 'https?://(?:[^/"]*\\.|)example\\.com(?:[:/"]|$)']) assert.ok(!geminiDropsPattern(re), re);
    const policies = [golden, load(path.join(ROOT, 'examples/tally/_operator/agent-policy.yaml')), load(path.join(FIX, 'dotfiles/agent-policy.yaml'))];
    let n = 0;
    for (const p of policies) {
      for (const profile of Object.keys(p.profiles)) {
        for (const f of compilePolicy(p, { profile, engine: 'gemini' }).files.filter((x) => x.path.endsWith('promptbook.toml'))) {
          for (const r of f.data.filter((x) => x.argsPattern)) {
            n += 1;
            assert.ok(!geminiDropsPattern(r.argsPattern), `${profile}/${f.path}: ${r.argsPattern}`);
          }
        }
      }
    }
    assert.ok(n >= 20, `${n} patterns checked`);
    const domain = compilePolicy(golden, { profile: 'laptop', engine: 'gemini' }).files.find((f) => f.path.endsWith('promptbook.toml')).data.find((r) => r.toolName === 'web_fetch' && r.decision === 'deny');
    const fetch = new RegExp(domain.argsPattern);
    for (const url of ['https://internal.example.com/x', 'https://a.b.internal.example.com']) assert.ok(fetch.test(geminiArgs({ prompt: `read ${url}` })), url);
    assert.ok(!fetch.test(geminiArgs({ prompt: 'read https://notinternal.example.com.evil.org' })));
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
    assert.ok(fs.existsSync(path.join(out, 'rules/promptbook.rules')) && fs.existsSync(path.join(out, 'ci.config.toml')));
    const bad = path.join(TMP, 'bad');
    const no = cli('fixtures/compile-policy/refuse/bypass-preconditions.yaml', '--profile', 'laptop', '--engine', 'claude', '--out', bad);
    assert.equal(no.status, 1);
    assert.match(no.stderr, /REFUSED claude for profile laptop/);
    assert.ok(!fs.existsSync(bad));
  });

  it('--out writes report.json beside the files: the golden\'s warnings, accepted gaps with what each degrades, notes', () => {
    for (const [engine, profile] of [['codex', 'ci'], ['claude', 'devbox'], ['gemini', 'laptop']]) {
      const out = path.join(TMP, `report-${engine}-${profile}`);
      const r = cli('fixtures/compile-policy/golden/agent-policy.yaml', '--profile', profile, '--engine', engine, '--out', out);
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /report\.json \(report\)/);
      const written = fs.readFileSync(path.join(out, 'report.json'), 'utf8');
      assert.equal(written, fs.readFileSync(path.join(GOLDEN, 'expected', `${engine}-${profile}`, 'report.json'), 'utf8'), `${engine}-${profile}`);
      const rep = JSON.parse(written);
      assert.ok(rep.accepted.length && rep.accepted.every((a) => a.field && a.message && a.reason), `${engine}-${profile}: each accepted gap says what it degrades and why`);
    }
  });

  it('validates the policy first, and exits 2 on usage errors', () => {
    const bad = cli('fixtures/invalid/policy/one-matcher-per-rule.yaml', '--profile', 'personal', '--engine', 'claude');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /not a valid policy/);
    assert.equal(cli('fixtures/compile-policy/golden/agent-policy.yaml', '--profile', 'ci', '--engine', 'vim').status, 2);
    assert.equal(cli('fixtures/compile-policy/golden/agent-policy.yaml', '--engine', 'claude').status, 2);
  });
});

describe('review findings: the compiler never loosens a wall silently', () => {
  const REVIEW = path.join(FIX, 'review');
  const review = (f) => load(path.join(REVIEW, f));
  const settingsOf = (r) => JSON.parse(r.files.find((f) => f.path === 'settings.json').content);

  it('finding 2: a gap accepted without profiles never waives the bypass tier\'s preconditions, nor lends it another profile\'s reason', () => {
    const p = review('gap-scope-egress.yaml');
    const box2 = compilePolicy(p, { profile: 'box2', engine: 'claude' });
    assert.equal(box2.ok, false, 'box2 runs bypass with open egress on desk\'s acceptance');
    assert.ok(box2.errors.some((e) => e.rule === 'bypass-preconditions' && /egress\.default: deny/.test(e.message) && /profiles: \[box2\]/.test(e.message)), JSON.stringify(box2.errors));
    assert.equal(compilePolicy(p, { profile: 'desk', engine: 'claude' }).ok, true, 'desk keeps its own acceptance');
    const scoped = { ...p, accept_gaps: [...p.accept_gaps, { engine: 'claude', field: 'egress', profiles: ['box2'], reason: 'box2 sits behind an egress proxy' }] };
    const ok = compilePolicy(scoped, { profile: 'box2', engine: 'claude' });
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    assert.ok(ok.accepted.every((a) => a.reason === 'box2 sits behind an egress proxy'), JSON.stringify(ok.accepted));
  });

  it('finding 2: a profile\'s strict sandbox key follows its own isolation, not another profile\'s accepted gap', () => {
    const p = review('gap-scope-sandbox.yaml');
    const unscoped = compilePolicy(p, { profile: 'container', engine: 'claude' });
    assert.ok(unscoped.errors.some((e) => e.rule === 'bypass-preconditions'), 'an unscoped gap does not reach a bypass profile');
    const scoped = { ...p, accept_gaps: [...p.accept_gaps.map((g) => ({ ...g, profiles: ['container'] })), { engine: 'claude', field: 'egress', profiles: ['container'], reason: 'the container network allows the registry only' }] };
    const container = compilePolicy(scoped, { profile: 'container', engine: 'claude' });
    assert.equal(container.ok, true, JSON.stringify(container.errors));
    assert.equal(settingsOf(container).sandbox?.allowUnsandboxedCommands, undefined, 'no sandbox to keep strict');
    const devbox = compilePolicy(scoped, { profile: 'devbox', engine: 'claude' });
    assert.equal(devbox.ok, true, JSON.stringify(devbox.errors));
    assert.equal(settingsOf(devbox).sandbox.allowUnsandboxedCommands, false, 'the devbox relies on its sandbox');
    assert.deepEqual(devbox.accepted, []);
  });

  it('finding 2: accept_gaps names only profiles the policy has', () => {
    const p = review('gap-scope-sandbox.yaml');
    const r = compilePolicy({ ...p, accept_gaps: [{ ...p.accept_gaps[0], profiles: ['contianer'] }] }, { profile: 'devbox', engine: 'claude' });
    assert.ok(r.errors.some((e) => e.rule === 'gap-profiles-exist' && /contianer/.test(e.message)), JSON.stringify(r.errors));
  });
});

describe('review finding 1: a Codex allow rule runs outside the sandbox', () => {
  const { roles, ...tally } = load(path.join(ROOT, 'examples/tally/_operator/agent-policy.yaml'));
  const codexRules = (r) => r.files.find((f) => f.path === 'rules/promptbook.rules').content;

  it('an interpreter allow is never emitted, accepted gap or not: it would void deny_read and egress for any script', () => {
    for (const p of [tally, { ...tally, accept_gaps: [...tally.accept_gaps, { engine: 'codex', field: 'allow', reason: 'test' }] }]) {
      const r = compilePolicy(p, { profile: 'ci', engine: 'codex' });
      assert.equal(r.ok, true, JSON.stringify(r.errors));
      const text = codexRules(r);
      assert.doesNotMatch(text, /pattern = \["node"\]/);
      assert.doesNotMatch(text, /pattern = \["pnpm"\]/, '[pnpm] covers pnpm exec');
      for (const cmd of ['node', 'pnpm']) assert.ok(r.warnings.some((w) => w.rule === 'allow-interpreter' && w.message.includes(`["${cmd}"]`)), cmd);
    }
  });

  it('any other command allow is dropped, so the command runs sandboxed, unless the allow gap is accepted for the profile', () => {
    const r = compilePolicy(tally, { profile: 'ci', engine: 'codex' });
    assert.doesNotMatch(codexRules(r), /decision = "allow"/);
    assert.ok(r.warnings.some((w) => w.rule === 'allow-unsandboxed' && /"gh", "pr"/.test(w.message)), JSON.stringify(r.warnings));
    const accepted = compilePolicy({ ...tally, accept_gaps: [...tally.accept_gaps, { engine: 'codex', field: 'allow', profiles: ['ci'], reason: 'git and gh need the forge credential outside the sandbox' }] }, { profile: 'ci', engine: 'codex' });
    assert.match(codexRules(accepted), /pattern = \["gh", "pr", \["create", "view", "ready", "comment"\]\],\n {4}decision = "allow"/);
    assert.ok(accepted.accepted.some((a) => a.field === 'allow' && /outside the sandbox/.test(a.message) && /forge credential/.test(a.reason)), JSON.stringify(accepted.accepted));
  });

  it('interpreters: shells, language runtimes, package runners and the package managers that cover them', () => {
    for (const c of [['sh'], ['bash'], ['zsh'], ['node'], ['python3'], ['python3.12'], ['ruby'], ['perl'], ['npx'], ['deno'], ['bun'], ['pnpm'], ['npm'], ['pnpm', 'exec'], ['npm', 'exec'], ['pnpm', 'dlx'], ['/usr/bin/env'], [['node', 'git']]]) assert.ok(coversInterpreter(c), JSON.stringify(c));
    for (const c of [['git', 'status'], ['gh', 'pr'], ['pnpm', 'test'], ['npm', 'ci'], ['make']]) assert.ok(!coversInterpreter(c), JSON.stringify(c));
  });
});

describe('review finding 6: Claude\'s read and write denies without the sandbox', () => {
  const p = load(path.join(FIX, 'review/claude-no-sandbox.yaml'));

  it('deny_read and a write forbid without sandbox.enabled are a sandbox gap: Bash scripts read past Read() denies', () => {
    const r = compilePolicy(p, { profile: 'ci', engine: 'claude' });
    assert.equal(r.ok, false);
    const e = r.errors.find((x) => x.rule === 'unrepresentable' && x.field === 'sandbox');
    assert.ok(e && /deny_read and forbid write/.test(e.message) && /\["bash"\]/.test(e.message), JSON.stringify(r.errors));
    const accepted = compilePolicy({ ...p, accept_gaps: [{ engine: 'claude', field: 'sandbox', profiles: ['ci'], reason: 'the ci container mounts no secrets' }] }, { profile: 'ci', engine: 'claude' });
    assert.equal(accepted.ok, true, JSON.stringify(accepted.errors));
    assert.ok(accepted.accepted.some((a) => a.field === 'sandbox'));
    const s = JSON.parse(accepted.files.find((f) => f.path === 'settings.json').content);
    assert.ok(s.permissions.deny.includes('Read(~/.ssh/**)'), 'the file-tool deny is still emitted');
    assert.equal(s.sandbox, undefined, 'no inert sandbox.filesystem.denyRead without a sandbox');
  });

  it('a sandbox that may fall back to unsandboxed is a warning that says what then reads past the denies', () => {
    const r = compilePolicy(golden, { profile: 'desk', engine: 'claude' });
    assert.ok(r.warnings.some((w) => w.rule === 'sandbox-may-fall-back' && /deny_read/.test(w.message)), JSON.stringify(r.warnings));
    assert.ok(!compilePolicy(golden, { profile: 'laptop', engine: 'claude' }).warnings.some((w) => w.rule === 'sandbox-may-fall-back'));
  });
});

describe('review finding 7: unattended, an ask Codex cannot represent is a denial, never dropped', () => {
  const { roles, ...tally } = load(path.join(ROOT, 'examples/tally/_operator/agent-policy.yaml'));
  const config = (r) => r.files.find((f) => f.path.endsWith('config.toml')).content;
  const noAskGap = { ...tally, accept_gaps: tally.accept_gaps.filter((g) => !(g.engine === 'codex' && g.field === 'ask')) };

  it('an ask on writes fails closed until accepted, then downgrades the path to read', () => {
    const refused = compilePolicy(noAskGap, { profile: 'ci', engine: 'codex' });
    assert.equal(refused.ok, false, 'the deploy/** ask was dropped, so the workspace "." = "write" let it through');
    assert.ok(refused.errors.some((e) => e.field === 'ask' && /deploy\/\*\*/.test(e.message) && /denial/.test(e.message)), JSON.stringify(refused.errors));
    const r = compilePolicy({ ...noAskGap, accept_gaps: [...noAskGap.accept_gaps, { engine: 'codex', field: 'ask', profiles: ['ci'], reason: 'apply_patch into deploy/ is refused by the product hook' }] }, { profile: 'ci', engine: 'codex' });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.match(config(r), /"deploy\/\*\*" = "read"/);
    assert.ok(!r.warnings.some((w) => w.rule === 'dropped' && /^ask/.test(w.message)), JSON.stringify(r.warnings));
  });

  it('an ask on a tool with a Codex key becomes its deny; one without fails closed', () => {
    const p = { policy_version: 1, profiles: { ci: { tier: 'unattended' } }, deny_read: ['~/.ssh/**'], forbid: [], ask: [{ tool: 'web-fetch', domain: 'docs.example.com' }, { tool: 'mcp:db:query' }, { tool: 'web-search' }], budgets: { unattended: { max_turns: 5, max_usd: 1, max_minutes: 10 } }, sandbox: { enabled: true } };
    const r = compilePolicy(p, { profile: 'ci', engine: 'codex' });
    assert.ok(r.errors.some((e) => e.field === 'ask' && /web-search/.test(e.message)), JSON.stringify(r.errors));
    assert.ok(r.errors.some((e) => e.field === 'ask' && /mcp:db:query: Codex loads an mcp_servers entry only with its transport/.test(e.message)), 'config.toml cannot carry the MCP deny: an ask gap');
    const ok = compilePolicy({ ...p, ask: p.ask.slice(0, 2), accept_gaps: [{ engine: 'codex', field: 'ask', profiles: ['ci'], reason: 'the launcher merges mcp-restrictions.toml into the db entry' }] }, { profile: 'ci', engine: 'codex' });
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    assert.match(config(ok), /"docs\.example\.com" = "deny"/);
    assert.doesNotMatch(config(ok), /mcp_servers/);
    assert.match(ok.files.find((f) => f.path === 'mcp-restrictions.toml').content, /\[mcp_servers\.db\]\ndisabled_tools = \["query"\]/);
    const interactive = compilePolicy({ ...p, profiles: { ci: { tier: 'ask' } } }, { profile: 'ci', engine: 'codex' });
    assert.ok(interactive.warnings.some((w) => w.rule === 'dropped' && /web-search/.test(w.message)), 'an interactive ask is still a convenience');
  });
});

describe('review finding 12: unattended caps are never waived; runner.json carries them for promptbook run', () => {
  const { roles, ...tally } = load(path.join(ROOT, 'examples/tally/_operator/agent-policy.yaml'));
  const runner = (r) => JSON.parse(r.files.find((f) => f.path === 'runner.json').content);

  it('every runner.json carries caps and says who enforces each', () => {
    const want = {
      claude: { max_turns: 'engine', max_budget_usd: 'engine', timeout_seconds: 'promptbook-run' },
      codex: { max_turns: 'promptbook-run', max_budget_usd: 'none', timeout_seconds: 'promptbook-run' },
      gemini: { max_turns: 'engine', max_budget_usd: 'none', timeout_seconds: 'promptbook-run' },
    };
    for (const engine of ENGINES) {
      const r = compilePolicy(tally, { profile: 'ci', engine });
      assert.equal(r.ok, true, `${engine}: ${JSON.stringify(r.errors)}`);
      assert.deepEqual(runner(r).caps, { max_turns: 120, max_budget_usd: 4, timeout_seconds: 5400 }, engine);
      assert.deepEqual(runner(r).enforcement, want[engine], engine);
      assert.ok(!r.accepted.some((a) => a.field === 'budgets'), `${engine}: a budgets gap waived an unattended cap`);
    }
    assert.ok(runner(compilePolicy(tally, { profile: 'ci', engine: 'codex' })).args.includes('--json'), 'promptbook run counts Codex tool actions from --json');
    const gem = compilePolicy(tally, { profile: 'ci', engine: 'gemini' });
    assert.equal(JSON.parse(gem.files.find((f) => f.path === 'settings.json').content).model.maxSessionTurns, 120);
    for (const engine of ['codex', 'gemini']) assert.ok(compilePolicy(tally, { profile: 'ci', engine }).warnings.some((w) => w.rule === 'spend-unmetered'), engine);
    assert.deepEqual(runner(compilePolicy(tally, { profile: 'workstation', engine: 'claude' })).caps, { max_turns: null, max_budget_usd: null, timeout_seconds: null });
  });

  it('unattended on an engine with no spend flag needs max_minutes, whatever accept_gaps says', () => {
    const { max_minutes, ...noClock } = tally.budgets.unattended;
    const p = { ...tally, budgets: { ...tally.budgets, unattended: noClock }, accept_gaps: [...tally.accept_gaps, { engine: 'codex', field: 'budgets', reason: 'trust me' }, { engine: 'gemini', field: 'budgets', reason: 'trust me' }] };
    for (const engine of ['codex', 'gemini']) {
      const r = compilePolicy(p, { profile: 'ci', engine });
      assert.ok(r.errors.some((e) => e.rule === 'unattended-caps' && /max_minutes/.test(e.message)), `${engine}: ${JSON.stringify(r.errors)}`);
    }
    assert.equal(compilePolicy(p, { profile: 'ci', engine: 'claude' }).ok, true, 'Claude caps turns and spend itself');
  });
});

describe('review finding 14: a forbid that matches its flags anywhere in the command', () => {
  // Claude Code's Bash rule matching as the permissions page states it: compound commands are split
  // and each part matched, a leading VAR=value and the fixed wrappers are stripped, * stands for any
  // text, and a trailing " *" that is the rule's only wildcard also matches the bare command.
  const CLAUDE_WRAPPERS = /^(?:(?:timeout\s+\S+|time|nice|nohup|stdbuf(?:\s+-\S+)*|command|builtin|noglob|xargs)\s+)+/;
  const claudeDenies = (rule, cmd) => {
    const m = /^Bash\((.*)\)$/.exec(rule);
    if (!m) return false;
    const pat = m[1];
    const stars = (pat.match(/\*/g) ?? []).length;
    const body = pat.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    const re = new RegExp(`^${stars === 1 && pat.endsWith(' *') ? `${body.slice(0, -3)}(?: .*)?` : body}$`);
    return cmd.split(/&&|\|\||[;|&\n]/).map((x) => x.trim().replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '').replace(CLAUDE_WRAPPERS, '')).some((part) => re.test(part));
  };
  const EVASIONS = ['git push origin main --force', 'git push -u -f origin main', 'git push origin +main', 'git -C . push -f', 'env git push -f', 'docker compose -f x.yml down -v', 'docker-compose down -v'];
  const LEGIT = ['git push origin feat/settle-up', 'git push --follow-tags', 'git push origin feat/fix-flaky', 'git push --force-with-lease origin feat/x', 'docker compose down', 'docker compose -f x.yml down', 'docker compose up -d'];
  const deny = (engine, profile = 'laptop', p = golden) => compilePolicy(p, { profile, engine });

  it('the engine-neutral matcher denies the reviewer\'s evasions and leaves ordinary pushes alone', () => {
    const rules = golden.forbid.filter((r) => r.command);
    for (const c of EVASIONS) assert.ok(forbidHit(rules, c), c);
    for (const c of LEGIT) assert.equal(forbidHit(rules, c), null, c);
    assert.ok(forbidHit(rules, 'bash -lc "cd app && git push -f"') && forbidHit(rules, 'FOO=1 nice -n 5 git push --mirror') && forbidHit(rules, ['bash', '-lc', 'git push -f']), 'compound, wrapped and argv forms');
  });

  it('Claude: prefix and anywhere rules that its matcher applies to every evasion', () => {
    const r = deny('claude');
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    const denyRules = JSON.parse(r.files.find((f) => f.path === 'settings.json').content).permissions.deny;
    for (const rule of ['Bash(git push --force *)', 'Bash(*git* push* --force)', 'Bash(*git* push* --force *)', 'Bash(git push +*)', 'Bash(*git* push* +*)', 'Bash(*docker* compose* down* -v *)']) assert.ok(denyRules.includes(rule), rule);
    for (const c of EVASIONS) assert.ok(denyRules.some((x) => claudeDenies(x, c)), `claude lets through: ${c}`);
    for (const c of LEGIT) assert.ok(!denyRules.some((x) => claudeDenies(x, c)), `claude denies: ${c} (${denyRules.filter((x) => claudeDenies(x, c))})`);
  });

  it('Codex and Gemini keep the prefix forms; the rest is a forbid gap, or the guard hook on Codex', () => {
    const noGuard = { ...golden, hooks: undefined };
    const codex = deny('codex', 'laptop', { ...noGuard, accept_gaps: noGuard.accept_gaps.filter((g) => !(g.engine === 'codex' && g.field === 'forbid')) });
    assert.ok(codex.errors.some((e) => e.field === 'forbid' && /anywhere/.test(e.message) && /\["git","push"\]/.test(e.message)), JSON.stringify(codex.errors));
    const guarded = deny('codex');
    assert.equal(guarded.ok, true, JSON.stringify(guarded.errors));
    assert.match(guarded.files.find((f) => f.path === 'rules/promptbook.rules').content, /pattern = \["git", "push", \["--force", "-f", "--mirror"\]\],\n {4}decision = "forbidden"/);
    assert.ok(!guarded.accepted.some((a) => /anywhere/.test(a.message)), 'the guard covers it');
    assert.ok(guarded.warnings.some((w) => w.rule === 'hook-trust'), 'Codex skips a hook until it is trusted');
    const gemini = deny('gemini');
    assert.ok(gemini.accepted.some((a) => a.field === 'forbid' && /anywhere/.test(a.message)), JSON.stringify(gemini.accepted));
    assert.ok(gemini.warnings.some((w) => w.rule === 'hooks-not-emitted'));
  });

  it('hooks.forbid_guard emits the guard and its rule list and registers it for the shell tool; the copy denies the evasions', () => {
    for (const [engine, home] of [['claude', '$HOME/.claude/hooks/promptbook'], ['codex', '$HOME/.codex/hooks/promptbook']]) {
      const r = deny(engine, 'ci');
      const file = (p) => r.files.find((f) => f.path === p);
      const reg = engine === 'claude' ? JSON.parse(file('settings.json').content).hooks : JSON.parse(file('hooks.json').content).hooks;
      assert.deepEqual(reg.PreToolUse[0].matcher, 'Bash');
      assert.equal(reg.PreToolUse[0].hooks[0].command, `node "${home}/forbid-guard.mjs" "${home}/forbid.json"`);
      assert.equal(file('hooks/forbid-guard.mjs').content, fs.readFileSync(path.join(ROOT, 'tools/guards/forbid-guard.mjs'), 'utf8'));
      const rules = JSON.parse(file('hooks/forbid.json').content).rules;
      assert.ok(rules.some((x) => x.command[0] === 'psql'), 'unattended, the ask is a denial the guard enforces too');
      const dir = path.join(TMP, `guard-${engine}`);
      for (const f of r.files.filter((x) => x.path.startsWith('hooks/'))) {
        fs.mkdirSync(path.dirname(path.join(dir, f.path)), { recursive: true });
        fs.writeFileSync(path.join(dir, f.path), f.content);
      }
      const hook = (input) => spawnSync(process.execPath, [path.join(dir, 'hooks/forbid-guard.mjs'), path.join(dir, 'hooks/forbid.json')], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8' });
      for (const c of EVASIONS) {
        const h = hook({ tool_name: 'Bash', tool_input: { command: c } });
        assert.equal(h.status, 2, `${engine}: ${c}`);
        assert.match(h.stderr, /forbidden by the operator's policy/);
      }
      for (const c of LEGIT) assert.equal(hook({ tool_name: 'Bash', tool_input: { command: c } }).status, 0, `${engine}: ${c}`);
      assert.equal(hook({ tool_name: 'Read', tool_input: { file_path: 'x' } }).status, 0);
      assert.equal(hook('not json').status, 2, 'fail closed');
    }
    assert.equal(deny('claude', 'laptop', { ...golden, hooks: undefined }).files.find((f) => f.path === 'hooks/forbid.json'), undefined);
  });

  it('an example of a flags-anywhere rule is checked with the anywhere matcher', () => {
    const p = { ...golden, forbid: [{ command: ['git', 'push'], flags_anywhere: ['-f'], examples: ['git push origin main -f', 'git push origin main'] }] };
    const r = compilePolicy(p, { profile: 'laptop', engine: 'claude' });
    assert.ok(r.errors.some((e) => e.rule === 'example-matches' && /"git push origin main"/.test(e.message)), JSON.stringify(r.errors));
    assert.ok(!r.errors.some((e) => e.rule === 'example-matches' && /-f"/.test(e.message)));
  });
});

describe('review finding 15: roles narrow a profile\'s allowlist and egress per run', () => {
  const tally = load(path.join(ROOT, 'examples/tally/_operator/agent-policy.yaml'));
  const file = (r, p) => r.files.find((f) => f.path === p);
  const json = (r, p) => JSON.parse(file(r, p).content);

  it('the Tally evaluator (Gemini) is read-only: no write, push, PR or interpreter allow, and its write tools are denied', () => {
    const r = compilePolicy(tally, { profile: 'ci', engine: 'gemini' });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    const policy = file(r, 'roles/evaluator/policies/promptbook.toml').content;
    const allows = policy.split('[[rule]]').filter((b) => /decision = "allow"/.test(b));
    assert.ok(allows.length > 0);
    for (const b of allows) assert.doesNotMatch(b, /write_file|replace|git push|gh pr|"node"|"pnpm"\n/, b);
    assert.match(policy, /toolName = \["write_file", "replace"\]\ndecision = "deny"/);
    assert.deepEqual(json(r, 'roles/evaluator/settings.json').tools.allowed.filter((t) => /push|gh pr|node/.test(t)), []);
    assert.equal(json(r, 'roles/evaluator/runner.json').role, 'evaluator');
    assert.ok(r.accepted.filter((a) => a.role === 'evaluator').every((a) => !/never writes/.test(a.reason)), 'no accepted gap leans on a claim the output contradicts');
  });

  it('the Tally reader is read-only on Claude (the runner\'s allowlist and an Edit deny) and on Codex (the read-only sandbox)', () => {
    const c = compilePolicy(tally, { profile: 'ci', engine: 'claude' });
    assert.equal(c.ok, true, JSON.stringify(c.errors));
    for (const role of ['author', 'reader']) assert.equal(json(c, `roles/${role}/settings.json`).permissions.allow, undefined, 'unattended, the allowlist is the runner\'s, so a role can narrow it');
    assert.ok(!c.files.some((f) => f.path === 'settings.json' || f.path === 'roles/evaluator/runner.json'), 'every unattended run is a role; the evaluator runs on Gemini');
    const args = json(c, 'roles/reader/runner.json').args;
    const allowed = args[args.indexOf('--allowedTools') + 1].split(',');
    assert.ok(allowed.includes('Bash(git log *)') && !allowed.some((t) => /git push|gh pr|Edit|node|pnpm/.test(t)), allowed.join());
    assert.ok(args[args.indexOf('--disallowedTools') + 1].split(',').includes('Edit(**)'));
    assert.ok(json(c, 'roles/author/runner.json').args.join(' ').includes('Bash(git push *)'), 'the author keeps the profile\'s allowlist');
    const x = compilePolicy(tally, { profile: 'ci', engine: 'codex' });
    assert.equal(x.ok, true, JSON.stringify(x.errors));
    const cfg = file(x, 'roles/reader/ci.config.toml').content;
    assert.match(cfg, /extends = ":read-only"/);
    assert.doesNotMatch(cfg, /"\." = "write"/);
    assert.equal(file(x, 'roles/evaluator/ci.config.toml'), undefined, 'the evaluator runs on Gemini only');
  });

  it('a role only narrows: an allow or a domain the profile does not grant is an error, and so is a write in a read-only role', () => {
    const roles = (role) => ({ ...tally, roles: { r: role } });
    const wider = compilePolicy(roles({ allow: [{ command: ['curl'] }] }), { profile: 'ci', engine: 'claude' });
    assert.ok(wider.errors.some((e) => e.rule === 'role-narrows' && /curl/.test(e.message)), JSON.stringify(wider.errors));
    const domain = compilePolicy(roles({ egress: { allow_domains: ['pastebin.com'] } }), { profile: 'ci', engine: 'claude' });
    assert.ok(domain.errors.some((e) => e.rule === 'role-narrows' && /pastebin/.test(e.message)), JSON.stringify(domain.errors));
    const narrower = compilePolicy(roles({ allow: [{ command: ['git', 'log'] }, { command: ['gh', 'pr', 'view'] }], egress: { allow_domains: ['api.github.com'] } }), { profile: 'ci', engine: 'claude' });
    assert.equal(narrower.ok, true, JSON.stringify(narrower.errors));
    assert.ok(json(narrower, 'roles/r/runner.json').args.includes('Bash(git log *),Bash(gh pr view *),WebFetch(domain:api.github.com)'));
    const ro = compilePolicy(roles({ read_only: true, allow: [{ write: 'docs/**' }] }), { profile: 'ci', engine: 'claude' });
    assert.ok(ro.errors.some((e) => e.rule === 'role-read-only'), JSON.stringify(ro.errors));
    const codexEscape = compilePolicy({ ...roles({ read_only: true, engines: ['codex'] }), accept_gaps: [...tally.accept_gaps, { engine: 'codex', field: 'allow', reason: 'test' }] }, { profile: 'ci', engine: 'codex' });
    assert.ok(codexEscape.errors.some((e) => e.rule === 'role-read-only' && /outside the sandbox/.test(e.message)), JSON.stringify(codexEscape.errors));
  });

  it('roles compile for the unattended tier only, and a role names only roles the policy has', () => {
    const w = compilePolicy(tally, { profile: 'workstation', engine: 'claude' });
    assert.ok(!w.files.some((f) => f.path.startsWith('roles/')));
    assert.ok(w.notes.some((n) => /roles compile for the unattended tier/.test(n)));
  });
});

describe('Codex filesystem entries: a glob takes deny only (Codex 0.162.1 refuses to load anything else)', () => {
  const base = { policy_version: 1, profiles: { box: { tier: 'ask' }, ci: { tier: 'unattended' } }, deny_read: ['**/.env'], forbid: [], budgets: { unattended: { max_turns: 5, max_usd: 1, max_minutes: 10 } }, accept_gaps: [{ engine: 'codex', field: 'forbid', reason: 'apply_patch is refused by the project hook' }] };
  const codex = (p, profile = 'box') => compilePolicy({ ...base, ...p }, { profile, engine: 'codex' });
  const roots = (r) => r.files.find((f) => f.path.endsWith('config.toml')).data.permissions.promptbook.filesystem?.[':workspace_roots'] ?? {};
  // Every filesystem entry an output holds: [path, access].
  const entries = (data) => Object.values(data.permissions ?? {}).flatMap((prof) => Object.entries(prof.filesystem ?? {}).flatMap(([k, v]) => (typeof v === 'object' ? Object.entries(v) : [[k, v]])));

  it('an exact path, or a single trailing /** on a literal path, takes read and write; any other wildcard is a glob', () => {
    for (const g of ['deploy/**', 'Makefile', '.git/hooks/**', '~/.cache/pnpm', '~/**', '/etc/**', '.']) assert.ok(codexTakesAccess(g), g);
    for (const g of ['**', '**/.git/hooks/**', '**/.env', 'src/*/gen/**', '*.pem', 'docs/**/x', '~/.ssh/*_rsa', 'a/**/**', 'logs/?.txt', 'src/{a,b}/**']) assert.ok(!codexTakesAccess(g), g);
    assert.deepEqual(codexReadKey('**/.git/hooks/**'), { key: '.git/hooks/**', topOnly: true });
    assert.deepEqual(codexReadKey('**/package.json'), { key: 'package.json', topOnly: true });
    assert.deepEqual(codexReadKey('**'), { key: '.' });
    assert.deepEqual(codexReadKey('deploy/**'), { key: 'deploy/**' });
    for (const g of ['**/*.pem', '**/a/**/b', 'src/**/gen', '~/**/.git/hooks/**']) assert.equal(codexReadKey(g), null, g);
  });

  it('a write forbid on **/<literal>/** or **/<literal> downgrades the literal at each workspace root, and warns that a deeper copy stays writable', () => {
    const r = codex({ forbid: [{ write: '**/.git/hooks/**' }, { write: '**/package.json' }, { write: 'deploy/**' }], allow: [{ write: '**' }] });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.deepEqual(roots(r), { '**/.env': 'deny', '.git/hooks/**': 'read', 'package.json': 'read', 'deploy/**': 'read', '.': 'write' });
    const top = r.warnings.filter((w) => w.rule === 'glob-top-level-only').map((w) => w.message);
    assert.equal(top.length, 2, top.join('\n'));
    assert.match(top[0], /^forbid write \*\*\/\.git\/hooks\/\*\*: .*"\.git\/hooks\/\*\*" at each workspace root; a copy deeper down \(<dir>\/\.git\/hooks\) stays writable/);
    assert.ok(r.accepted.every((a) => a.field === 'forbid' && /apply_patch/.test(a.message)), JSON.stringify(r.accepted));
  });

  it('a write forbid on ** makes the whole workspace read-only, over the workspace write', () => {
    const r = codex({ forbid: [{ write: '**' }], allow: [{ write: '**' }] });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.deepEqual(roots(r), { '**/.env': 'deny', '.': 'read' });
    assert.ok(!r.warnings.some((w) => w.rule === 'glob-top-level-only'), 'the workspace root is the whole of **');
  });

  it('a write forbid on any other glob is a forbid gap: refused until accepted, and then nothing invalid is emitted for it', () => {
    const p = { forbid: [{ write: 'src/**/generated/**' }, { write: '**/*.pem' }], accept_gaps: [] };
    const refused = codex(p);
    assert.equal(refused.ok, false);
    assert.deepEqual(refused.files, []);
    for (const g of ['src/**/generated/**', '**/*.pem']) assert.ok(refused.errors.some((e) => e.field === 'forbid' && e.message.includes(`write ${g}: Codex takes a glob only for deny`) && /nothing is emitted/.test(e.message)), `${g}: ${JSON.stringify(refused.errors)}`);
    const accepted = codex({ ...p, accept_gaps: base.accept_gaps });
    assert.equal(accepted.ok, true, JSON.stringify(accepted.errors));
    assert.deepEqual(roots(accepted), { '**/.env': 'deny' });
    assert.equal(accepted.accepted.filter((a) => /nothing is emitted/.test(a.message)).length, 2, JSON.stringify(accepted.accepted));
  });

  it('unattended, a write ask on a glob is the same denial under the ask gap', () => {
    const ask = { ask: [{ write: '**/infra/**' }, { write: 'ops/*/secrets' }] };
    const refused = codex(ask, 'ci');
    assert.ok(refused.errors.some((e) => e.field === 'ask' && /ops\/\*\/secrets: Codex takes a glob only for deny/.test(e.message)), JSON.stringify(refused.errors));
    const r = codex({ ...ask, accept_gaps: [{ engine: 'codex', field: 'ask', profiles: ['ci'], reason: 'the project hook refuses both' }] }, 'ci');
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.deepEqual(roots(r), { '**/.env': 'deny', 'infra/**': 'read' });
    assert.ok(r.warnings.some((w) => w.rule === 'glob-top-level-only' && /^ask write \*\*\/infra\/\*\*/.test(w.message)), JSON.stringify(r.warnings));
  });

  it('an allow write or a writable root Codex cannot take is dropped with a warning; one it takes is emitted', () => {
    const r = codex({ allow: [{ write: 'docs/**' }, { write: 'src/**/*.ts' }], sandbox: { enabled: true, writable_roots: ['~/.cache/pnpm', '~/.cache/*/tmp'] } });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(roots(r)['docs/**'], 'write');
    const fsys = r.files[0].data.permissions.promptbook.filesystem;
    assert.equal(fsys['~/.cache/pnpm'], 'write');
    assert.equal(fsys['~/.cache/*/tmp'], undefined);
    assert.equal(roots(r)['src/**/*.ts'], undefined);
    const dropped = r.warnings.filter((w) => w.rule === 'dropped').map((w) => w.message);
    assert.ok(dropped.some((m) => m.startsWith('allow write src/**/*.ts')) && dropped.some((m) => m.startsWith('sandbox.writable_roots write ~/.cache/*/tmp')), dropped.join('\n'));
  });

  it('no compiled Codex output holds a glob with an access other than deny, on any fixture policy, profile or role', () => {
    const policies = [golden, load(path.join(FIX, 'dotfiles/agent-policy.yaml')), load(path.join(ROOT, 'examples/tally/_operator/agent-policy.yaml')), ...fs.readdirSync(path.join(ROOT, 'fixtures/valid/policy')).map((f) => load(path.join(ROOT, 'fixtures/valid/policy', f)))];
    let checked = 0;
    for (const p of policies) {
      for (const profile of Object.keys(p.profiles)) {
        for (const f of compilePolicy(p, { profile, engine: 'codex' }).files.filter((x) => x.path.endsWith('config.toml'))) {
          for (const [g, access] of entries(f.data)) {
            checked += 1;
            assert.ok(access === 'deny' || codexTakesAccess(g), `${profile}/${f.path}: "${g}" = "${access}"`);
          }
        }
      }
    }
    assert.ok(checked > 40, `${checked} entries checked`);
  });
});

describe('Codex MCP tool denies: config.toml loads standalone, and the deny is never dropped', () => {
  const base = { policy_version: 1, profiles: { box: { tier: 'ask' }, ci: { tier: 'unattended' } }, deny_read: ['**/.env'], forbid: [{ tool: 'mcp:prod-db:execute' }, { tool: 'mcp:prod-db:drop' }, { tool: 'mcp:docs:write' }], budgets: { unattended: { max_turns: 5, max_usd: 1, max_minutes: 10 } } };
  const accept = (field = 'forbid') => ({ accept_gaps: [{ engine: 'codex', field, reason: 'the dotfiles merge mcp-restrictions.toml into each server entry they define' }] });
  const codex = (p, profile = 'box') => compilePolicy({ ...base, ...p }, { profile, engine: 'codex' });
  const file = (r, p) => r.files.find((f) => f.path === p);

  it('an MCP tool forbid is a forbid gap: Codex refuses an mcp_servers entry without its transport, which the policy does not hold', () => {
    const r = codex({});
    assert.equal(r.ok, false);
    assert.deepEqual(r.files, []);
    const e = r.errors.filter((x) => x.field === 'forbid');
    assert.equal(e.length, 3, JSON.stringify(r.errors));
    assert.match(e[0].message, /tool mcp:prod-db:execute: Codex loads an mcp_servers entry only with its transport \(command or url\)/);
    assert.match(e[0].stanza, /engine: codex, field: forbid, profiles: \[box\]/);
  });

  it('accepted, the denies go to mcp-restrictions.toml per server, config.toml holds no mcp_servers table, and a note says how to merge', () => {
    const r = codex(accept());
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    const cfg = r.files.find((f) => f.path === 'config.toml');
    assert.equal(cfg.data.mcp_servers, undefined);
    assert.doesNotMatch(cfg.content, /mcp_servers/);
    const frag = file(r, 'mcp-restrictions.toml');
    assert.equal(frag.kind, 'mcp-fragment');
    assert.deepEqual(frag.data, { mcp_servers: { 'prod-db': { disabled_tools: ['execute', 'drop'] }, docs: { disabled_tools: ['write'] } } });
    assert.match(frag.content, /^# Not a config\.toml/m);
    assert.equal(r.accepted.filter((a) => a.field === 'forbid' && /holds only once merged into the entry that defines (prod-db|docs)/.test(a.message)).length, 3, JSON.stringify(r.accepted));
    assert.ok(r.notes.some((n) => /^mcp-restrictions\.toml: merge each mcp_servers\.<id>\.disabled_tools \(prod-db, docs\)/.test(n)), JSON.stringify(r.notes));
    assert.ok(!r.warnings.some((w) => w.rule === 'merge-mcp'));
  });

  it('unattended, an MCP tool ask is the same deny under the ask gap; interactive, it is dropped with a warning', () => {
    const p = { forbid: [], ask: [{ tool: 'mcp:db:query' }] };
    assert.ok(codex(p, 'ci').errors.some((e) => e.field === 'ask' && /mcp:db:query/.test(e.message)));
    const r = codex({ ...p, ...accept('ask') }, 'ci');
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.deepEqual(file(r, 'mcp-restrictions.toml').data, { mcp_servers: { db: { disabled_tools: ['query'] } } });
    const interactive = codex(p);
    assert.equal(interactive.ok, true, JSON.stringify(interactive.errors));
    assert.equal(file(interactive, 'mcp-restrictions.toml'), undefined);
    assert.ok(interactive.warnings.some((w) => w.rule === 'dropped' && /mcp:db:query/.test(w.message)));
  });

  it('a role\'s MCP denies are the role\'s own fragment, beside its config', () => {
    const p = { ...base, ...accept(), profiles: { ci: { tier: 'unattended' } }, roles: { reader: { read_only: true, engines: ['codex'] } } };
    const r = compilePolicy(p, { profile: 'ci', engine: 'codex' });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.ok(file(r, 'roles/reader/mcp-restrictions.toml') && !file(r, 'mcp-restrictions.toml'));
    assert.equal(file(r, 'roles/reader/ci.config.toml').data.mcp_servers, undefined);
  });
});
