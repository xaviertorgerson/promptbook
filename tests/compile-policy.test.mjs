import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { commandMatches, compilePolicy, coversInterpreter, diffClaudeSettings, ENGINES, expandCommand, globArgsPattern, parseSettingsTemplate, renderDiff, renderReport, unsafeKeys } from '../tools/lib/compile-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'fixtures/compile-policy');
const GOLDEN = path.join(FIX, 'golden');
const UPDATE = process.env.UPDATE_GOLDEN === '1';
const DOTFILES = process.env.HARNESS_DOTFILES ?? '/home/claude/dotfiles';
// The dotfiles' L1 branch, whose policy raises the workstation to Claude's auto mode with x-claude.
const DOTFILES_L1_POLICY = process.env.HARNESS_DOTFILES_L1_POLICY ?? '/home/claude/wt-dotfiles-l1/home/.chezmoidata/agent-policy.yaml';
const STAGEHAND = process.env.HARNESS_STAGEHAND ?? '/tmp/claude-0/-home-claude/4cb75181-a255-5446-ad02-7fa332a70b56/scratchpad/repos_sh/stagehand';
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-policy-'));
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
    assert.match(unsafeKeys([{ path: 'config.toml', kind: 'settings-fragment', data: { permissions: { harness: { extends: ':danger-full-access' } } } }], { tier: 'ask' }).join(), /full-access/);
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
    assert.ok(compilePolicy(p, { profile: 'laptop', engine: 'codex' }).files.find((f) => f.path === 'rules/harness.rules').content.includes('"--yolo"'));
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
    const out = compilePolicy(policy, { profile: 'box', engine: 'codex' }).files.find((f) => f.path === 'rules/harness.rules').content;
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
      const { 'x-claude': workaround, ...rest } = real;
      assert.ok(workaround?.default_mode?.workstation, 'the dotfiles still carry the workaround');
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
  const tally = load(path.join(ROOT, 'examples/tally/_operator/agent-policy.yaml'));
  const codexRules = (r) => r.files.find((f) => f.path === 'rules/harness.rules').content;

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
  const tally = load(path.join(ROOT, 'examples/tally/_operator/agent-policy.yaml'));
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
    const ok = compilePolicy({ ...p, ask: p.ask.slice(0, 2) }, { profile: 'ci', engine: 'codex' });
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    assert.match(config(ok), /"docs\.example\.com" = "deny"/);
    assert.match(config(ok), /disabled_tools = \["query"\]/);
    const interactive = compilePolicy({ ...p, profiles: { ci: { tier: 'ask' } } }, { profile: 'ci', engine: 'codex' });
    assert.ok(interactive.warnings.some((w) => w.rule === 'dropped' && /web-search/.test(w.message)), 'an interactive ask is still a convenience');
  });
});

describe('review finding 12: unattended caps are never waived; runner.json carries them for harness run', () => {
  const tally = load(path.join(ROOT, 'examples/tally/_operator/agent-policy.yaml'));
  const runner = (r) => JSON.parse(r.files.find((f) => f.path === 'runner.json').content);

  it('every runner.json carries caps and says who enforces each', () => {
    const want = {
      claude: { max_turns: 'engine', max_budget_usd: 'engine', timeout_seconds: 'harness-run' },
      codex: { max_turns: 'harness-run', max_budget_usd: 'none', timeout_seconds: 'harness-run' },
      gemini: { max_turns: 'engine', max_budget_usd: 'none', timeout_seconds: 'harness-run' },
    };
    for (const engine of ENGINES) {
      const r = compilePolicy(tally, { profile: 'ci', engine });
      assert.equal(r.ok, true, `${engine}: ${JSON.stringify(r.errors)}`);
      assert.deepEqual(runner(r).caps, { max_turns: 120, max_budget_usd: 4, timeout_seconds: 5400 }, engine);
      assert.deepEqual(runner(r).enforcement, want[engine], engine);
      assert.ok(!r.accepted.some((a) => a.field === 'budgets'), `${engine}: a budgets gap waived an unattended cap`);
    }
    assert.ok(runner(compilePolicy(tally, { profile: 'ci', engine: 'codex' })).args.includes('--json'), 'harness run counts Codex tool actions from --json');
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
