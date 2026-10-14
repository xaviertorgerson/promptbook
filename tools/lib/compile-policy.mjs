import fs from 'node:fs';
import { forbidHit } from '../guards/forbid-guard.mjs';
import { PROBES } from './requires.mjs';
import { toToml } from './toml.mjs';

// The L1 policy compiler: agent-policy.yaml (schemas/policy.schema.json) -> one engine's settings,
// for one machine profile. Every mapping is the table in adapters/<engine>/README.md; this file is
// the executable half. The rules every engine shares:
//
//   fail closed   a deny the engine cannot represent (deny_read, forbid, egress, sandbox, budgets,
//                 tier) is an error unless accept_gaps names {engine, field} with a reason; an ask or
//                 allow it cannot represent is dropped with a warning, since dropping one never
//                 loosens a wall, except where it would: unattended an ask is a denial and is never
//                 dropped, and an allow that would run outside the sandbox (Codex) is emitted only
//                 where its gap is accepted. An accept_gaps entry covers the profiles it names, or,
//                 naming none, every profile but a bypass-tier one: the bypass tier's gaps are
//                 accepted for it by name. On any error nothing is written.
//   walls only    the compiler never emits a key that removes walls: disableAllHooks,
//                 hooksConfig.enabled false, security.disableYoloMode overrides, tools.exclude,
//                 :danger-full-access, a bypass mode or its prompt skip outside the bypass tier
//                 (unsafeKeys, on the parsed output of every compile; a hit is a compile error).
//   preconditions the bypass tier (autonomous) names what keeps it safe outside the policy
//                 (profile `requires`, never waivable) and is isolated by the policy's own sandbox
//                 and egress deny, or by an accept_gaps entry for that field with a reason (HAR-4);
//                 the unattended tier has the caps HAR-3 states, which accept_gaps cannot waive:
//                 runner.json carries them for `harness run`, which enforces what the engine does
//                 not, and an engine with no spend flag needs max_minutes for a hard kill.

export const ENGINES = ['claude', 'codex', 'gemini'];
export const BYPASS_TIER = 'autonomous';
export const GENERATOR = 'harness compile-policy';

// Gemini tool names. The policy-engine page names read_file, glob, write_file, replace and
// run_shell_command; the others are the installed CLI's names and unverified (adapters/gemini).
const GEMINI_READ_TOOLS = ['read_file', 'read_many_files', 'glob', 'search_file_content'];
const GEMINI_WRITE_TOOLS = ['write_file', 'replace'];
const GEMINI_FETCH = 'web_fetch';
const GEMINI_SEARCH = 'google_web_search';
const PRIORITY = { deny: 900, ask_user: 500, allow: 100 };

const isWindowsPath = (g) => /^[A-Za-z]:[\\/]|\\/.test(g);
const isHome = (g) => g === '~' || g.startsWith('~/');
const isAbsolute = (g) => g.startsWith('/');
const hasGlob = (g) => /[*?[\]{}]/.test(g);

// Every argv the rule names: alternatives at a position expand to one prefix each.
export function expandCommand(command) {
  return command.reduce((acc, tok) => acc.flatMap((pre) => [].concat(tok).map((t) => [...pre, t])), [[]]);
}

// **.host covers the apex and subdomains; *.host subdomains only (policy schema, domain).
const domainForms = (d) => (d.startsWith('**.') ? [d.slice(3), `*.${d.slice(3)}`] : [d]);

// A command token with a glob character: Claude Code reads it as a wildcard, Codex and Gemini as a
// literal, so a forbid using one would block less on those engines than it says.
const globToken = (r) => Boolean(r.command?.flat().some((t) => /[*?]/.test(t)));

const describeRule = (r) => (r.command ? `command ${JSON.stringify(r.command)}${r.flags_anywhere ? ` with ${r.flags_anywhere.join(' | ')} anywhere` : ''}` : r.write ? `write ${r.write}` : `tool ${r.tool}${r.domain ? ` domain ${r.domain}` : ''}`);

// A flags-anywhere rule's flags an exact-token matcher can carry (one ending in * is a prefix).
const literalFlags = (r) => r.flags_anywhere.filter((f) => !f.endsWith('*'));
// The prefix form of a flags-anywhere rule: its words, then one of its literal flags.
const prefixForm = (r) => {
  const flags = literalFlags(r);
  return flags.length ? [...r.command, flags.length > 1 ? flags : flags[0]] : null;
};

// The guard hook (hooks.forbid_guard): tools/guards/forbid-guard.mjs, copied beside the settings
// with the compiled rule list and registered for the shell tool from the engine's home.
const GUARD_SOURCE = new URL('../guards/forbid-guard.mjs', import.meta.url);
const GUARD_HOME = { claude: '$HOME/.claude/hooks/harness', codex: '$HOME/.codex/hooks/harness' };

// The command rules the guard denies: every command forbid, and unattended every command ask (a
// denial there).
function guardFiles(ctx) {
  const lists = [...ctx.policy.forbid, ...(ctx.tier === 'unattended' ? ctx.policy.ask ?? [] : [])];
  const rules = lists.filter((r) => r.command).map(({ command, flags_anywhere: f, reason }) => ({ command, ...(f ? { flags_anywhere: f } : {}), ...(reason ? { reason } : {}) }));
  const list = { generated_by: GENERATOR, source: ctx.source, profile: ctx.profileName, tier: ctx.tier, rules };
  return [
    { path: 'hooks/forbid-guard.mjs', content: fs.readFileSync(GUARD_SOURCE, 'utf8'), kind: 'hook' },
    jsonFile('hooks/forbid.json', list, 'rules'),
  ];
}

const guardRegistration = (engine) => {
  const home = GUARD_HOME[engine];
  return { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: `node "${home}/forbid-guard.mjs" "${home}/forbid.json"`, ...(engine === 'codex' ? { statusMessage: 'harness forbid guard' } : {}) }] }] };
};

class Context {
  constructor(policy, profileName, engine, source) {
    this.policy = policy;
    this.profileName = profileName;
    this.engine = engine;
    this.source = source;
    this.profile = policy.profiles?.[profileName];
    this.tier = this.profile?.tier;
    this.role = null; // the role an unattended compile narrows to (roles/<role>/), if any
    this.readOnly = false;
    this.errors = [];
    this.warnings = [];
    this.accepted = [];
    this.notes = [];
  }

  error(rule, message, extra = {}) {
    this.errors.push({ rule, message, ...extra });
  }

  warn(rule, message) {
    this.warnings.push({ rule, message });
  }

  // The operator's acceptance of a gap in this field for this engine and profile: an entry naming the
  // profile, or one naming no profiles when the profile is not the bypass tier (a bypass profile's
  // isolation is too specific to inherit from a policy-wide entry, HAR-4).
  acceptedGap(field) {
    return (this.policy.accept_gaps ?? []).find((g) => g.engine === this.engine && g.field === field && (g.profiles ? g.profiles.includes(this.profileName) : this.tier !== BYPASS_TIER));
  }

  stanza(field) {
    return `accept_gaps:\n  - { engine: ${this.engine}, field: ${field}, profiles: [${this.profileName}], reason: "<why this degradation is acceptable>" }`;
  }

  // A deny-side field the engine cannot represent (or only partly). true when the operator accepted
  // the gap, so the caller may emit its best effort; false (and an error) otherwise.
  gap(field, message) {
    const acc = this.acceptedGap(field);
    if (acc) {
      this.accepted.push({ field, message, reason: acc.reason });
      return true;
    }
    this.error('unrepresentable', `${this.engine} cannot represent ${field}: ${message}`, { field, stanza: this.stanza(field) });
    return false;
  }

  // An ask or allow the engine cannot represent: dropped, never an error.
  drop(list, rule, why) {
    this.warn('dropped', `${list} ${describeRule(rule)} dropped on ${this.engine}: ${why}`);
  }
}

// ------------------------------------------------------------------------------------- preflight

// An argv the rule's command prefix matches, token by token (alternatives at a position).
export function commandMatches(command, argv) {
  return command.length <= argv.length && command.every((tok, i) => [].concat(tok).includes(argv[i]));
}

// A key anywhere in an x- extension that would switch hooks off (HAR-2): the compiler refuses the
// policy rather than carry it to an engine.
const HOOKS_OFF = (v) => v && typeof v === 'object' && Object.entries(v).some(([k, x]) => k === 'disableAllHooks' || (k === 'hooksConfig' && x?.enabled === false) || HOOKS_OFF(x));

function preflight(ctx) {
  const { policy: p } = ctx;
  for (const [k, v] of Object.entries(p).filter(([key]) => key.startsWith('x-'))) {
    if (HOOKS_OFF(v)) ctx.error('never-disable-hooks', `${k} switches hooks off; the personal layer never disables hooks (HAR-2)`);
  }
  for (const list of ['forbid', 'ask', 'allow']) {
    (p[list] ?? []).forEach((r, i) => {
      for (const ex of r.examples ?? []) {
        const hit = r.flags_anywhere ? forbidHit([r], ex) : r.command && commandMatches(r.command, ex.trim().split(/\s+/));
        if (!hit) ctx.error('example-matches', `${list}/${i}: example "${ex}" does not match ${describeRule(r)}`);
      }
    });
  }
  (p.accept_gaps ?? []).forEach((g, i) => {
    const unknown = (g.profiles ?? []).filter((n) => !p.profiles?.[n]);
    if (unknown.length) ctx.error('gap-profiles-exist', `accept_gaps/${i} names ${unknown.join(', ')}, which ${unknown.length > 1 ? 'are not profiles' : 'is not a profile'} (profiles: ${Object.keys(p.profiles ?? {}).join(', ')})`);
  });
  if (!ctx.profile) {
    ctx.error('profile-exists', `no profile "${ctx.profileName}" (profiles: ${Object.keys(p.profiles ?? {}).join(', ')})`);
    return;
  }
  // A profile's egress merged over the top-level one is held to the same rules as either alone.
  if (p.egress && !p.egress.default) ctx.error('egress-effective', `profile "${ctx.profileName}": egress has no default (neither the profile nor the top level sets one)`);
  if (p.egress?.default === 'deny' && !p.egress.allow_domains) ctx.error('egress-effective', `profile "${ctx.profileName}": egress default deny lists no allow_domains`);
  if (ctx.profile.engines && !ctx.profile.engines.includes(ctx.engine)) {
    ctx.error('engine-installed', `profile "${ctx.profileName}" lists engines ${ctx.profile.engines.join(', ')}; it does not install ${ctx.engine}`);
  }
  if (ctx.tier === BYPASS_TIER) {
    // HAR-4: bypass only where the agent is sandboxed (non-root, never falling back to running
    // unsandboxed) and production is unreachable at the network level. The policy's own isolation is
    // the sandbox and egress.default deny; an operator who isolates the host another way (a
    // container, a network ACL) accepts that field's gap for this profile by name, with a reason.
    // What keeps the host safe outside the policy is named in the profile's requires, which nothing
    // waives.
    const accepted = (field) => ctx.acceptedGap(field);
    const missing = [];
    const sandboxed = p.sandbox?.enabled === true && p.sandbox?.fail_if_unavailable === true;
    const sandboxGap = accepted('sandbox');
    if (!sandboxed && !sandboxGap) {
      if (p.sandbox?.enabled !== true) missing.push('sandbox.enabled: true');
      if (p.sandbox?.fail_if_unavailable !== true) missing.push('sandbox.fail_if_unavailable: true');
    } else if (!sandboxed) ctx.accepted.push({ field: 'sandbox', message: `the bypass tier runs without the policy's sandbox (HAR-4)`, reason: sandboxGap.reason });
    const egressGap = accepted('egress');
    if (p.egress?.default !== 'deny' && !egressGap) missing.push('egress.default: deny (with allow_domains)');
    else if (p.egress?.default !== 'deny') ctx.accepted.push({ field: 'egress', message: 'the bypass tier runs with open egress (HAR-4)', reason: egressGap.reason });
    if (missing.length) {
      ctx.error('bypass-preconditions', `profile "${ctx.profileName}" is the bypass tier (${BYPASS_TIER}) without its preconditions (HAR-4: sandboxed, non-root, production unreachable): set ${missing.join(', ')}, or accept the gap for this profile by name (accept_gaps: { engine: ${ctx.engine}, field: sandbox|egress, profiles: [${ctx.profileName}], reason })`);
    }
    const req = ctx.profile.requires ?? [];
    if (!req.length) ctx.error('bypass-requires', `profile "${ctx.profileName}" is the bypass tier (${BYPASS_TIER}) and names no preconditions; set requires: [prod-unreachable-from-this-host, ...] (HAR-4). The compiler cannot see a network ACL or a container, so it will not assume one`);
    else ctx.notes.push(`bypass tier ${ctx.profileName} requires: ${req.join(', ')} (harness check-requires probes each on the host; harness run refuses the profile's runs until they pass)`);
  }
  for (const name of ctx.profile.requires ?? []) {
    if (!PROBES[name]) ctx.warn('requires-unknown', `requires ${name} has no probe (${Object.keys(PROBES).join(', ')}): harness check-requires and harness run fail closed on it`);
  }
  if ((ctx.profile.requires ?? []).includes('prod-unreachable-from-this-host') && !p.requires_config?.prod_hosts?.length) {
    ctx.warn('requires-unprobed', 'requires prod-unreachable-from-this-host and requires_config.prod_hosts lists no production host: harness check-requires and harness run fail closed until it does');
  }
  if (ctx.tier === 'unattended') {
    const b = p.budgets?.unattended ?? {};
    const missing = ['max_turns', 'max_usd'].filter((k) => b[k] === undefined);
    if (missing.length) ctx.error('unattended-caps', `the unattended tier runs with turn and spend caps (HAR-3): budgets.unattended lacks ${missing.join(', ')}`);
    else if (ENFORCES[ctx.engine].max_budget_usd === 'none' && b.max_minutes === undefined) {
      ctx.error('unattended-caps', `${ctx.engine} has no spend flag, so harness run bounds an unattended run's spend by a hard kill at budgets.unattended.max_minutes, which is not set (HAR-3; accept_gaps cannot waive it)`);
    }
  }
}

// ------------------------------------------------------------------------------------- claude

const CLAUDE_MODE = { 'read-only': 'plan', ask: 'default', 'auto-edit': 'acceptEdits', auto: 'auto', autonomous: 'bypassPermissions' };

// Does an egress pattern (host, *.host, **.host) admit a plain host?
const domainAdmits = (pattern, host) => (pattern.startsWith('**.') ? host === pattern.slice(3) || host.endsWith(`.${pattern.slice(3)}`) : pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) : host === pattern);

// Read/Edit rule paths: gitignore syntax anchored at the settings source; // is the filesystem root.
// A Windows path has no POSIX anchor: a gap for a deny, a drop for an ask or allow.
function claudePath(ctx, glob, list) {
  if (isWindowsPath(glob)) {
    const why = `"${glob}" is a Windows path; Claude Code rules match POSIX paths (//c/... form) only`;
    if (list === 'forbid' || list === 'deny_read') ctx.gap(list, why);
    else ctx.drop(list, { write: glob }, why);
    return null;
  }
  return isAbsolute(glob) ? `/${glob}` : glob;
}

// A flags-anywhere forbid on Claude: per expansion and flag, the prefix form (the flag right after
// the words, as a plain rule compiles) and the anywhere form, a * after each word so options,
// wrappers and a path can sit before or between them; an exact flag ends the command or is
// followed by a space, a flag ending in * is a prefix.
function claudeAnywhere(rule) {
  const out = [];
  for (const words of expandCommand(rule.command)) {
    const anywhere = `*${words.join('* ')}*`;
    for (const f of rule.flags_anywhere) {
      if (f.endsWith('*')) out.push(`Bash(${words.join(' ')} ${f})`, `Bash(${anywhere} ${f})`);
      else out.push(`Bash(${words.join(' ')} ${f} *)`, `Bash(${anywhere} ${f})`, `Bash(${anywhere} ${f} *)`);
    }
  }
  return out;
}

function claudeRules(ctx, rule, list) {
  if (rule.flags_anywhere) return claudeAnywhere(rule);
  if (rule.command) {
    const hasStar = globToken(rule);
    if (hasStar && list === 'allow') {
      ctx.drop('allow', rule, 'Claude Code reads * in a Bash rule as a wildcard, so the allow would cover more than the literal token');
      return [];
    }
    if (hasStar) ctx.warn('wildcard-token', `${list} ${describeRule(rule)}: Claude Code reads * as a wildcard (wider than the literal token; Codex matches it literally)`);
    return expandCommand(rule.command).map((argv) => `Bash(${argv.join(' ')}${argv.at(-1).endsWith('*') ? '' : ' *'})`);
  }
  if (rule.write) {
    const p = claudePath(ctx, rule.write, list);
    return p ? [`Edit(${p})`] : [];
  }
  if (rule.tool === 'web-fetch') return rule.domain ? domainForms(rule.domain).map((d) => `WebFetch(domain:${d})`) : ['WebFetch'];
  if (rule.tool === 'web-search') return ['WebSearch'];
  const [, server, tool] = rule.tool.split(':');
  return [tool ? `mcp__${server}__${tool}` : `mcp__${server}`];
}

function emitClaude(ctx) {
  const { policy: p, tier } = ctx;
  const sandboxOn = p.sandbox?.enabled === true;
  // Read() and Edit() denies reach Claude's file tools, the file commands it recognizes in Bash and
  // redirection targets, not a script that opens files itself (permissions: "they don't apply to ...
  // a Python or Node script that opens files itself"); only the sandbox binds every process.
  const partial = [...(p.deny_read.length ? ['deny_read'] : []), ...(p.forbid.some((r) => r.write) ? ['forbid write'] : [])];
  if (partial.length) {
    const scripts = (p.allow ?? []).filter((r) => r.command && coversInterpreter(r.command)).map((r) => starlark(r.command));
    const why = `${partial.join(' and ')} ${partial.length > 1 ? 'reach' : 'reaches'} Claude's file tools and the file commands it recognizes in Bash (cat, head, sed, tee, redirections), not a script that opens files itself${scripts.length ? ` (allowed here: ${scripts.join(', ')})` : ''}`;
    if (!sandboxOn) ctx.gap('sandbox', `${why}; without sandbox.enabled nothing binds every process`);
    else if (p.sandbox?.fail_if_unavailable !== true) ctx.warn('sandbox-may-fall-back', `sandbox.fail_if_unavailable is not true: where the sandbox cannot start, commands run unsandboxed, and ${why}`);
  }
  const perm = { allow: [], deny: [], ask: [] };
  const add = (list, rules) => { for (const r of rules) if (!perm[list].includes(r)) perm[list].push(r); };
  const fsys = { denyRead: [], allowWrite: [] };
  const net = { allowedDomains: [], deniedDomains: [] };

  for (const g of p.deny_read) {
    const t = claudePath(ctx, g, 'deny_read');
    if (!t) continue;
    add('deny', [`Read(${t})`]);
    // Read() deny rules are merged into the sandbox (sandboxing: permission-rule paths join the
    // sandbox configuration); home and absolute paths are also written in the sandbox's own form.
    if (isHome(g) || isAbsolute(g)) fsys.denyRead.push(g);
  }
  for (const r of p.forbid) add('deny', claudeRules(ctx, r, 'forbid'));
  for (const r of p.ask ?? []) add('ask', claudeRules(ctx, r, 'ask'));
  for (const r of p.allow ?? []) add('allow', claudeRules(ctx, r, 'allow'));

  const egress = p.egress;
  if (egress) {
    for (const d of egress.allow_domains ?? []) {
      net.allowedDomains.push(...domainForms(d));
      add('allow', domainForms(d).map((x) => `WebFetch(domain:${x})`));
    }
    for (const d of egress.deny_domains ?? []) {
      net.deniedDomains.push(...domainForms(d));
      add('deny', domainForms(d).map((x) => `WebFetch(domain:${x})`));
    }
    if (egress.default === 'deny') {
      if (p.sandbox?.enabled !== true) {
        ctx.gap('egress', 'egress.default deny is enforced by the sandbox (strictAllowlist), and sandbox.enabled is not true');
      }
      // The sandbox allowlist binds shell commands only; WebFetch follows permission rules, and a
      // deny cannot carve the allowed domains out of "everything else". Under dontAsk (unattended)
      // an unlisted fetch is denied; in a prompting tier a human is asked; under bypassPermissions
      // it runs with nobody asked, which is a hole in the wall.
      const fetchForbidden = p.forbid.some((r) => r.tool === 'web-fetch' && !r.domain);
      if (tier === BYPASS_TIER && !fetchForbidden) ctx.gap('egress', 'WebFetch outside allow_domains runs unasked under bypassPermissions; the sandbox allowlist binds shell commands only (forbid {tool: web-fetch} removes the fetch tool instead)');
      else if (tier === 'auto' && !fetchForbidden) ctx.gap('egress', 'WebFetch outside allow_domains is left to the auto-mode classifier, not denied; the sandbox allowlist binds shell commands only (forbid {tool: web-fetch} removes the fetch tool instead)');
      else if (tier !== 'unattended') ctx.warn('egress-prompts', 'WebFetch outside allow_domains prompts a human instead of being denied; the sandbox allowlist binds shell commands only');
    }
  }

  const sandbox = {};
  if (p.sandbox?.enabled !== undefined) sandbox.enabled = p.sandbox.enabled;
  if (p.sandbox?.fail_if_unavailable !== undefined) sandbox.failIfUnavailable = p.sandbox.fail_if_unavailable;
  // A bypass profile whose own sandbox is on must not let a command the sandbox blocked retry outside
  // it: under bypassPermissions that retry runs with no prompt (sandboxing: the unsandboxed retry
  // escape hatch). Decided from this profile's merged sandbox alone, never from another profile's
  // accepted gap.
  if (tier === BYPASS_TIER && p.sandbox?.enabled === true) sandbox.allowUnsandboxedCommands = false;
  for (const w of p.sandbox?.writable_roots ?? []) {
    if (isHome(w) || isAbsolute(w)) fsys.allowWrite.push(w);
    else ctx.drop('sandbox.writable_roots', { write: w }, 'a relative sandbox path in user settings resolves against ~/.claude, not the workspace');
  }
  const filesystem = Object.fromEntries(Object.entries(fsys).filter(([, v]) => v.length));
  if (sandboxOn && Object.keys(filesystem).length) sandbox.filesystem = filesystem;
  const network = Object.fromEntries(Object.entries(net).filter(([, v]) => v.length));
  if (egress?.default === 'deny') network.strictAllowlist = true;

  // Credential masks: sandboxed commands see a placeholder and the sandbox proxy restores the real
  // value on requests to the inject hosts, which needs the proxy to terminate TLS (sandboxing: mask
  // credentials). Masks bind sandboxed commands only, never the file tools.
  const masks = p.sandbox?.credentials ?? [];
  if (masks.length && !sandboxOn) ctx.warn('credentials-need-sandbox', 'sandbox.credentials masks act only inside the sandbox, and sandbox.enabled is not true: not emitted');
  if (masks.length && sandboxOn) {
    const inject = (c) => (c.inject_hosts ? { injectHosts: c.inject_hosts } : {});
    const files = masks.filter((c) => c.path).map((c) => ({ path: c.path, mode: 'mask', ...(c.extract ? { extract: c.extract } : {}), ...inject(c) }));
    const envVars = masks.filter((c) => c.env).map((c) => ({ name: c.env, mode: 'mask', ...inject(c) }));
    sandbox.credentials = { ...(files.length ? { files } : {}), ...(envVars.length ? { envVars } : {}) };
    network.tlsTerminate = {};
    const allowed = egress?.allow_domains ?? [];
    const unlisted = [...new Set(masks.flatMap((c) => c.inject_hosts ?? []))].filter((h) => !allowed.some((d) => domainAdmits(d, h)));
    if (unlisted.length) ctx.warn('credential-host-unlisted', `the sandbox proxy restores a masked credential only on hosts the egress allow list admits; ${unlisted.join(', ')} ${unlisted.length > 1 ? 'are' : 'is'} not in egress.allow_domains, so requests there carry the placeholder`);
    if (files.length) ctx.warn('mask-not-a-read-deny', `Claude Code's file tools can read ${files.map((f) => f.path).join(', ')}: a mask covers sandboxed commands only (a deny_read entry would deny the sandbox too); on macOS a masked file is blocked instead of masked`);
  }
  if (sandboxOn && Object.keys(network).length) sandbox.network = network;

  // Unattended, the allowlist is the run's boundary and the runner's (--allowedTools under dontAsk,
  // ADR-0021): kept out of the machine's settings, where every run, whatever its role, would inherit
  // it (an allow in settings applies under dontAsk too).
  const permissions = {};
  if (CLAUDE_MODE[tier]) permissions.defaultMode = CLAUDE_MODE[tier];
  for (const k of ['allow', 'deny', 'ask']) if (perm[k].length && !(k === 'allow' && tier === 'unattended')) permissions[k] = perm[k];
  const settings = { permissions };
  if (tier === BYPASS_TIER) settings.skipDangerousModePermissionPrompt = true;
  if (Object.keys(sandbox).length) settings.sandbox = sandbox;
  const guard = p.hooks?.forbid_guard === true;
  if (guard) settings.hooks = guardRegistration('claude');

  // Headless runs: the runner's flags. Unattended pins dontAsk and the allowlist (ADR-0021).
  const budget = p.budgets?.[tier] ?? {};
  const args = [];
  if (tier === 'unattended') {
    args.push('--permission-mode', 'dontAsk');
    if (perm.allow.length) args.push('--allowedTools', perm.allow.join(','));
    if (perm.deny.length) args.push('--disallowedTools', perm.deny.join(','));
  }
  if (budget.max_turns) args.push('--max-turns', String(budget.max_turns));
  if (budget.max_usd) args.push('--max-budget-usd', String(budget.max_usd));
  const runner = runnerFile(ctx, args, budget);

  return [
    jsonFile('settings.json', settings, 'settings-fragment'),
    jsonFile('runner.json', runner, 'runner'),
    ...(guard ? guardFiles(ctx) : []),
  ];
}

// An emitted file: what is written (content) and its parsed form (data), which the walls-only check
// reads.
const jsonFile = (path, data, kind) => ({ path, content: `${JSON.stringify(data, null, 2)}\n`, kind, data });

// Who enforces each cap of a run `harness run` launches: the engine (a flag or setting the compile
// emits), harness run itself, or nobody (said so in a spend-unmetered warning). adapters/*/README.md.
export const ENFORCES = {
  claude: { max_turns: 'engine', max_budget_usd: 'engine', timeout_seconds: 'harness-run' },
  codex: { max_turns: 'harness-run', max_budget_usd: 'none', timeout_seconds: 'harness-run' },
  gemini: { max_turns: 'engine', max_budget_usd: 'none', timeout_seconds: 'harness-run' },
};

// The run's caps from the tier's budget. max_tokens has no enforcer on any engine (a gap).
function capsOf(ctx, budget) {
  if (budget.max_tokens) ctx.gap('budgets', 'max_tokens has no flag or setting, and harness run cannot meter tokens before a run ends');
  if (budget.max_usd && ENFORCES[ctx.engine].max_budget_usd === 'none') {
    const bounds = [budget.max_turns && `max_turns ${budget.max_turns}`, budget.max_minutes && `a hard kill at max_minutes ${budget.max_minutes}`].filter(Boolean);
    const msg = `${ctx.engine} reports no cost: max_usd ${budget.max_usd} is not metered; the run is bounded by ${bounds.length ? bounds.join(' and ') : 'no other cap'}`;
    if (ctx.tier === 'unattended') ctx.warn('spend-unmetered', msg);
    else ctx.gap('budgets', msg);
  }
  return { max_turns: budget.max_turns ?? null, max_budget_usd: budget.max_usd ?? null, timeout_seconds: budget.max_minutes ? budget.max_minutes * 60 : null };
}

function runnerFile(ctx, args, budget) {
  return {
    generated_by: GENERATOR,
    source: ctx.source,
    engine: ctx.engine,
    profile: ctx.profileName,
    tier: ctx.tier,
    ...(ctx.role ? { role: ctx.role } : {}),
    ...(ctx.profile?.requires?.length ? { requires: ctx.profile.requires } : {}),
    ...(ctx.profile?.requires?.length && ctx.policy.requires_config ? { requires_config: ctx.policy.requires_config } : {}),
    args,
    caps: capsOf(ctx, budget),
    enforcement: ENFORCES[ctx.engine],
  };
}

// ------------------------------------------------------------------------------------- codex

// Commands that run whatever code they are handed: shells, language runtimes, package runners, and
// the package managers whose bare prefix covers their exec subcommand. An execpolicy allow runs
// outside the sandbox, so allowing one of these lets any script read what deny_read names and reach
// any host.
const INTERPRETERS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'node', 'nodejs', 'deno', 'bun', 'bunx', 'ruby', 'perl', 'php', 'lua', 'npx', 'pnpx', 'tsx', 'ts-node', 'env', 'xargs', 'sudo', 'eval', 'exec']);
const PACKAGE_EXEC = { pnpm: ['exec', 'dlx'], npm: ['exec', 'x'], yarn: ['exec', 'dlx'], bun: ['x', 'run'] };
const isInterpreter = (t) => INTERPRETERS.has(t) || /^python[0-9.]*$/.test(t);

// Does an allow's argv prefix (any expansion) cover an interpreter invocation?
export function coversInterpreter(command) {
  return expandCommand(command).some((argv) => {
    const head = argv[0].split('/').at(-1);
    if (isInterpreter(head)) return true;
    const sub = PACKAGE_EXEC[head];
    return Boolean(sub) && (argv.length === 1 || sub.includes(argv[1]));
  });
}

const CODEX_BASE = { 'read-only': ':read-only', ask: ':workspace', 'auto-edit': ':workspace', auto: ':workspace', autonomous: ':workspace', unattended: ':workspace' };
const CODEX_APPROVAL = { ask: 'on-request', 'auto-edit': 'on-request', auto: 'on-request', autonomous: 'never', unattended: 'never' };

const starlark = (v) => (Array.isArray(v) ? `[${v.map(starlark).join(', ')}]` : JSON.stringify(v));

export function renderPrefixRule(r) {
  const lines = [`    pattern = ${starlark(r.pattern)},`, `    decision = ${starlark(r.decision)},`];
  if (r.justification) lines.push(`    justification = ${starlark(r.justification)},`);
  if (r.match?.length) lines.push(`    match = ${starlark(r.match)},`);
  return `prefix_rule(\n${lines.join('\n')}\n)\n`;
}

function emitCodex(ctx) {
  const { policy: p, tier } = ctx;
  const guard = p.hooks?.forbid_guard === true;
  if (guard) ctx.warn('hook-trust', 'Codex skips a new or changed user hook until it is reviewed and trusted (/hooks; trust is recorded against the hook\'s hash): trust the harness forbid guard once on this machine, or flags-anywhere forbids hold only in their prefix form until then');
  if (tier === 'auto-edit') ctx.warn('degraded', 'Codex has no "edits free, commands ask" mode: auto-edit compiles like ask (approval_policy on-request)');
  if (tier === 'auto') ctx.warn('degraded', 'Codex has no classifier-reviewed mode: auto compiles to approval_policy on-request on the workspace sandbox (sandboxed work runs without asking; anything outside it prompts)');
  const filesystem = {};
  const roots = {};
  const domains = {};
  let network = p.egress?.default === 'deny';
  const rules = [];
  const mcp = {};
  const where = (g) => (isHome(g) || isAbsolute(g) ? filesystem : roots);
  const setPath = (g, v) => {
    const t = where(g);
    const rank = { deny: 3, read: 2, write: 1 };
    if (!t[g] || rank[v] > rank[t[g]]) t[g] = v;
  };
  const setDomain = (d, v) => { if (domains[d] !== 'deny') domains[d] = v; network = true; };
  const prefixRule = (r, decision, list) => {
    rules.push({
      pattern: r.command,
      decision,
      justification: r.reason ?? `${list} in agent-policy.yaml`,
      match: r.examples?.length ? r.examples : [expandCommand(r.command)[0].join(' ')],
    });
  };

  for (const g of p.deny_read) {
    if (isWindowsPath(g)) { ctx.gap('deny_read', `"${g}" is a Windows path`); continue; }
    setPath(g, 'deny');
  }
  // A wall on Codex, or (unattended) an ask, which nobody answers there: a denial (ADR-0021), written
  // as one so no approval policy can turn it into a yes, and never dropped. `field` names the gap.
  const deny = (r, field) => {
    const as = field === 'ask' ? 'unattended, an ask is a denial; ' : '';
    if (r.command && globToken(r) && !ctx.gap(field, `${as}${describeRule(r)}: execpolicy matches * and ? literally, so the deny would block less than it says`)) return;
    if (r.flags_anywhere) {
      const pattern = prefixForm(r);
      if (pattern) {
        const examples = (r.examples ?? []).filter((ex) => commandMatches(pattern, ex.trim().split(/\s+/)));
        prefixRule({ ...r, command: pattern, examples: examples.length ? examples : undefined }, 'forbidden', field);
      }
      if (guard) return;
      const denied = pattern ? `only "${expandCommand(pattern).map((a) => a.join(' ')).join('", "')}" is denied` : 'none of it is denied';
      ctx.gap(field, `${as}${describeRule(r)}: execpolicy matches an argv prefix token by token, so ${denied}, not the flags anywhere later in the command${r.flags_anywhere.some((f) => f.endsWith('*')) ? ' nor a token a * flag begins' : ''} (hooks.forbid_guard covers it)`);
      return;
    }
    if (r.command) prefixRule(field === 'ask' ? { ...r, reason: `ask in an unattended tier is a denial${r.reason ? `: ${r.reason}` : ''}` } : r, 'forbidden', field);
    else if (r.write) {
      if (ctx.gap(field, `${as}write ${r.write}: a filesystem "read" downgrade covers sandboxed commands, not the apply_patch tool`)) setPath(r.write, 'read');
    } else if (r.tool === 'web-fetch' && r.domain) setDomain(r.domain, 'deny');
    else if (r.tool.startsWith('mcp:') && r.tool.split(':')[2]) {
      const [, s, t] = r.tool.split(':');
      (mcp[s] ??= { disabled_tools: [] }).disabled_tools.push(t);
    } else ctx.gap(field, `${as}${describeRule(r)} has no documented Codex key${r.tool.startsWith('mcp:') ? ' (omit the server from config.toml instead)' : ''}`);
  };
  for (const r of p.forbid) deny(r, 'forbid');
  for (const r of p.ask ?? []) {
    if (tier === 'unattended') deny(r, 'ask');
    else if (r.command) prefixRule(r, 'prompt', 'ask');
    else ctx.drop('ask', r, 'Codex has no ask for writes or tools');
  }
  // An execpolicy allow runs the command outside the sandbox without prompting, past every deny_read
  // entry and the egress list (both are enforced by the sandbox alone). Dropped, the command still
  // runs, sandboxed; emitted only where the operator accepts that escape for the profile, and never
  // for an interpreter.
  const commandAllows = (p.allow ?? []).filter((r) => r.command);
  const interpreters = commandAllows.filter((r) => coversInterpreter(r.command));
  for (const r of interpreters) ctx.warn('allow-interpreter', `allow ${describeRule(r)} not emitted on codex: an execpolicy allow runs outside the sandbox, and an interpreter runs any script there (deny_read and egress hold only inside it); the command runs sandboxed instead`);
  const escapes = commandAllows.filter((r) => !interpreters.includes(r));
  if (escapes.length) {
    const what = escapes.map((r) => starlark(r.command)).join(', ');
    if (ctx.readOnly && ctx.acceptedGap('allow')) ctx.error('role-read-only', `role ${ctx.role} is read-only, and an execpolicy allow runs outside the sandbox: ${what} could write past it (give the role an allow list without them)`);
    else if (ctx.acceptedGap('allow')) {
      ctx.gap('allow', `allow rules run outside the sandbox, past deny_read and egress: ${what}`);
      for (const r of escapes) prefixRule(r, 'allow', 'allow');
    } else ctx.warn('allow-unsandboxed', `allow ${what} not emitted on codex: an execpolicy allow runs outside the sandbox, past deny_read and egress; the commands run sandboxed instead (accept_gaps {engine: codex, field: allow, profiles: [${ctx.profileName}]} emits them)`);
  }
  for (const r of p.allow ?? []) {
    if (r.command) continue;
    else if (r.write) {
      if (r.write === '**') setPath('.', 'write');
      else if (!hasGlob(r.write)) setPath(r.write, 'write');
      else ctx.drop('allow', r, 'Codex filesystem globs are fully supported only for deny');
    } else if (r.tool === 'web-fetch' && r.domain) setDomain(r.domain, 'allow');
    else ctx.drop('allow', r, 'no documented Codex key');
  }
  for (const d of p.egress?.allow_domains ?? []) setDomain(d, 'allow');
  for (const d of p.egress?.deny_domains ?? []) setDomain(d, 'deny');
  if (p.sandbox?.fail_if_unavailable) ctx.gap('sandbox', 'fail_if_unavailable has no documented Codex key');
  if (p.sandbox?.credentials?.length) ctx.gap('sandbox', `credential masks have no documented Codex key: sandboxed commands would read ${p.sandbox.credentials.map((c) => c.path ?? `$${c.env}`).join(', ')} unmasked`);
  for (const w of p.sandbox?.writable_roots ?? []) setPath(w, 'write');

  // No documented turn, spend or token flag for codex exec: harness run counts tool actions in the
  // --json event stream against max_turns, and kills the run at max_minutes.
  const budget = p.budgets?.[tier] ?? {};
  const runnerArgs = budget.max_turns ? ['--json'] : [];

  const profileTable = {
    description: `Compiled from ${ctx.source} (profile ${ctx.profileName}, tier ${tier}) by ${GENERATOR}`,
    extends: ctx.readOnly ? ':read-only' : CODEX_BASE[tier],
  };
  const fsTable = { ...filesystem };
  if (Object.keys(roots).length) fsTable[':workspace_roots'] = roots;
  if (Object.keys(fsTable).length) profileTable.filesystem = fsTable;
  if (network) profileTable.network = { enabled: true, ...(Object.keys(domains).length ? { domains } : {}) };
  const config = { default_permissions: 'harness' };
  if (CODEX_APPROVAL[tier]) config.approval_policy = CODEX_APPROVAL[tier];
  config.permissions = { harness: profileTable };
  if (network) config.features = { network_proxy: true };
  if (Object.keys(mcp).length) {
    config.mcp_servers = mcp;
    ctx.warn('merge-mcp', `merge mcp_servers.{${Object.keys(mcp).join(',')}}.disabled_tools into the existing server entries`);
  }
  const header = `# Compiled from ${ctx.source} (profile ${ctx.profileName}, tier ${tier}) by ${GENERATOR}.\n# A fragment: merge into ~/.codex/config.toml; recompile rather than edit.\n`;
  const configName = tier === 'unattended' ? `${ctx.profileName}.config.toml` : 'config.toml';
  const rulesText = `# Compiled from ${ctx.source} (profile ${ctx.profileName}, tier ${tier}) by ${GENERATOR}.\n# Most restrictive decision wins: forbidden > prompt > allow. Check: codex execpolicy check --rules <this file> -- <cmd>\n\n${rules.map(renderPrefixRule).join('\n')}`;
  return [
    { path: configName, content: `${header}\n${toToml(config)}`, kind: 'settings-fragment', data: config },
    { path: 'rules/harness.rules', content: rulesText, kind: 'rules', data: rules },
    jsonFile('runner.json', runnerFile(ctx, runnerArgs, budget), 'runner'),
    ...(guard ? [jsonFile('hooks.json', { description: `harness forbid guard, compiled from ${ctx.source} (profile ${ctx.profileName})`, hooks: guardRegistration('codex') }, 'settings-fragment'), ...guardFiles(ctx)] : []),
  ];
}

// ------------------------------------------------------------------------------------- gemini

const GEMINI_MODE = { 'read-only': 'plan', ask: 'default', 'auto-edit': 'auto_edit', auto: 'auto_edit' };

const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A path glob as a regex over the JSON-serialized tool arguments: a string field whose name holds
// "path" ({"file_path":"/abs/.env"}), or one entry of such an array ({"paths":["a","/abs/.env"]}).
export function globArgsPattern(glob) {
  let body;
  let g = glob;
  if (isHome(g)) { body = '[^"]*/'; g = g.slice(2); } else if (isAbsolute(g)) { body = '/'; g = g.slice(1); } else body = g.startsWith('**/') ? '' : '(?:[^"]*/)?';
  for (let i = 0; i < g.length; i += 1) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') { body += '(?:[^"]*/)?'; i += 2; } else { body += '[^"]*'; i += 1; }
    } else if (c === '*') body += '[^/"]*';
    else if (c === '?') body += '[^/"]';
    else body += reEscape(c);
  }
  return `"[A-Za-z_]*paths?":\\[?(?:"[^"]*",)*"${body}"`;
}

const domainArgsPattern = (d) => (d.startsWith('**.') ? `https?://(?:[^/"]*\\.)?${reEscape(d.slice(3))}(?:[:/"]|$)` : d.startsWith('*.') ? `https?://[^/"]+\\.${reEscape(d.slice(2))}(?:[:/"]|$)` : `https?://${reEscape(d)}(?:[:/"]|$)`);

function emitGemini(ctx) {
  const { policy: p, tier } = ctx;
  const rules = [];
  const allowed = [];
  const decisionOf = { forbid: 'deny', ask: 'ask_user', allow: 'allow' };
  const rule = (list, fields, r) => {
    const decision = decisionOf[list];
    const out = { ...fields, decision, priority: PRIORITY[decision] };
    if (decision === 'deny') out.denyMessage = r?.reason ?? `forbidden by ${ctx.source}`;
    rules.push(out);
  };
  const toolRule = (list, r) => {
    if (r.flags_anywhere) {
      for (const words of expandCommand(r.command)) for (const f of r.flags_anywhere) rule(list, { toolName: 'run_shell_command', commandPrefix: `${words.join(' ')} ${f.replace(/\*$/, '')}` }, r);
    } else if (r.command) {
      for (const argv of expandCommand(r.command)) {
        rule(list, { toolName: 'run_shell_command', commandPrefix: argv.join(' ') }, r);
        if (list === 'allow') allowed.push(`run_shell_command(${argv.join(' ')})`);
      }
    } else if (r.write) {
      rule(list, r.write === '**' ? { toolName: GEMINI_WRITE_TOOLS } : { toolName: GEMINI_WRITE_TOOLS, argsPattern: globArgsPattern(r.write) }, r);
    } else if (r.tool === 'web-fetch') {
      if (r.domain) rule(list, { toolName: GEMINI_FETCH, argsPattern: domainArgsPattern(r.domain) }, r);
      else rule(list, { toolName: GEMINI_FETCH }, r);
    } else if (r.tool === 'web-search') rule(list, { toolName: GEMINI_SEARCH }, r);
    else {
      const [, s, t] = r.tool.split(':');
      rule(list, { toolName: `mcp_${s}_${t ?? '*'}` }, r);
    }
  };

  const settings = {};
  if (GEMINI_MODE[tier]) settings.general = { defaultApprovalMode: GEMINI_MODE[tier] };
  const args = [];
  if (tier === BYPASS_TIER) {
    if (ctx.gap('tier', 'YOLO is a launch flag, and no page states that a user-tier deny outranks its auto-approval')) args.push('--approval-mode=yolo');
  }
  if (tier === 'unattended') ctx.notes.push('run gemini non-interactively; ask_user rules are denials there');
  if (tier === 'auto') ctx.warn('degraded', 'Gemini has no classifier-reviewed mode: auto compiles to auto_edit (edits without asking, commands ask)');

  if (p.deny_read.length && ctx.gap('deny_read', `read denies reach only the file tools (${GEMINI_READ_TOOLS.join(', ')}; names unverified), not run_shell_command reads`)) {
    for (const g of p.deny_read) rule('forbid', { toolName: GEMINI_READ_TOOLS, argsPattern: globArgsPattern(g) }, { reason: `deny_read ${g} (${ctx.source})` });
  }
  if (p.hooks?.forbid_guard) ctx.warn('hooks-not-emitted', 'the forbid guard is registered for Claude Code and Codex only; Gemini keeps each flags-anywhere forbid in its prefix form (adapters/gemini)');
  for (const r of p.forbid) {
    if (r.command && globToken(r) && !ctx.gap('forbid', `${describeRule(r)}: commandPrefix matches * and ? literally, so the forbid would block less than it says`)) continue;
    if (r.flags_anywhere && !ctx.gap('forbid', `${describeRule(r)}: commandPrefix matches the start of the command, so only the flag right after the words is denied, not the flags anywhere later in it`)) continue;
    if (r.write && !ctx.gap('forbid', `write ${r.write}: a deny reaches the file tools (${GEMINI_WRITE_TOOLS.join(', ')}) only, not shell redirection`)) continue;
    toolRule('forbid', r);
  }
  for (const r of p.ask ?? []) toolRule('ask', r);
  for (const r of p.allow ?? []) toolRule('allow', r);

  const e = p.egress;
  if (e && (e.default === 'deny' || e.deny_domains?.length)) ctx.gap('egress', 'the sandbox offers open or proxied profiles, not a domain list');
  const tools = {};
  if (p.sandbox?.enabled) tools.sandbox = true;
  if (allowed.length) tools.allowed = allowed;
  if (Object.keys(tools).length) settings.tools = tools;
  if (p.sandbox?.fail_if_unavailable) ctx.gap('sandbox', 'fail_if_unavailable has no Gemini key');
  if (p.sandbox?.credentials?.length) ctx.gap('sandbox', `credential masks have no Gemini key: sandboxed commands would read ${p.sandbox.credentials.map((c) => c.path ?? `$${c.env}`).join(', ')} unmasked`);
  for (const w of p.sandbox?.writable_roots ?? []) ctx.drop('sandbox.writable_roots', { write: w }, 'container mounts are the launcher\'s job');

  // model.maxSessionTurns ends a session past its turns (headless exit 53, "turn limit exceeded");
  // there is no spend key, and harness run kills the run at max_minutes.
  const budget = p.budgets?.[tier] ?? {};
  if (budget.max_turns) settings.model = { maxSessionTurns: budget.max_turns };

  const header = `# Compiled from ${ctx.source} (profile ${ctx.profileName}, tier ${tier}) by ${GENERATOR}.\n# User-tier policy (~/.gemini/policies/); the workspace tier is disabled upstream. Tool names other than\n# read_file, glob, write_file, replace and run_shell_command are unverified (adapters/gemini).\n`;
  return [
    jsonFile('settings.json', settings, 'settings-fragment'),
    { path: 'policies/harness.toml', content: `${header}\n${rules.length ? toToml({ rule: rules }) : ''}`, kind: 'rules', data: rules },
    jsonFile('runner.json', runnerFile(ctx, args, budget), 'runner'),
  ];
}

// ------------------------------------------------------------------------------------- guard

// A setting that removes a wall, found in the parsed output of every compile: keys, and the values of
// the keys that pick a mode or a sandbox, never free text (a forbid on `codex --yolo` is a rule's
// pattern, not a mode). Each hit is a compile error: it is a compiler bug, never a policy choice.
const FULL_ACCESS = /danger-full-access/;
const ALWAYS_BAD_FLAGS = new Set(['--dangerously-skip-permissions', '--allow-dangerously-skip-permissions', '--dangerously-bypass-approvals-and-sandbox']);

function unsafeInData(data, where, bypass, bad) {
  const walk = (v, keys) => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, [...keys, i])); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      const at = [...keys, k].join('.');
      if (k === 'disableAllHooks') bad.push(`${where}: disableAllHooks (${at})`);
      if (k === 'hooksConfig' && x?.enabled === false) bad.push(`${where}: hooksConfig.enabled false`);
      if (k === 'disableYoloMode') bad.push(`${where}: security.disableYoloMode (${at})`);
      if (k === 'exclude' && keys.at(-1) === 'tools') bad.push(`${where}: tools.exclude`);
      if ((k === 'hooks' || k === 'codex_hooks') && keys.at(-1) === 'features' && x === false) bad.push(`${where}: features.${k} false`);
      if (['default_permissions', 'extends', 'sandbox_mode'].includes(k) && typeof x === 'string' && FULL_ACCESS.test(x)) bad.push(`${where}: a full-access mode (${at} = ${x})`);
      if (!bypass && k === 'skipDangerousModePermissionPrompt') bad.push(`${where}: skipDangerousModePermissionPrompt outside the ${BYPASS_TIER} tier`);
      if (!bypass && k === 'defaultMode' && x === 'bypassPermissions') bad.push(`${where}: a bypass mode outside the ${BYPASS_TIER} tier (${at})`);
      if (!bypass && k === 'defaultApprovalMode' && x === 'yolo') bad.push(`${where}: a bypass mode outside the ${BYPASS_TIER} tier (${at})`);
      walk(x, [...keys, k]);
    }
  };
  walk(data, []);
}

function unsafeInArgs(args, where, bypass, bad) {
  args.forEach((a, i) => {
    const next = args[i + 1];
    if (ALWAYS_BAD_FLAGS.has(a)) bad.push(`${where}: a full-access flag ${a}`);
    if ((a === '--sandbox' || a === '-s') && FULL_ACCESS.test(next ?? '')) bad.push(`${where}: a full-access flag ${a} ${next}`);
    if (bypass) return;
    if (a === '--yolo' || a === '--approval-mode=yolo' || (a === '--approval-mode' && next === 'yolo')) bad.push(`${where}: a bypass flag outside the ${BYPASS_TIER} tier (${a}${a === '--approval-mode' ? ` ${next}` : ''})`);
    if (a === '--permission-mode' && next === 'bypassPermissions') bad.push(`${where}: a bypass flag outside the ${BYPASS_TIER} tier (--permission-mode bypassPermissions)`);
  });
}

// files: the emitted files, each with its parsed form in `data` (a rules file's data is its rule
// list, which holds patterns, never settings, so it is not walked).
export function unsafeKeys(files, { tier }) {
  const bad = [];
  const bypass = tier === BYPASS_TIER;
  for (const f of files) {
    if (f.kind === 'rules' || f.data === undefined) continue;
    if (f.kind === 'runner') unsafeInArgs(f.data.args ?? [], f.path, bypass, bad);
    else unsafeInData(f.data, f.path, bypass, bad);
  }
  return bad;
}

const EMIT = { claude: emitClaude, codex: emitCodex, gemini: emitGemini };

// The policy one profile compiles from: its own sandbox and egress merged key by key over the
// top-level ones (a key the profile sets replaces the top-level key; lists are replaced, not joined).
export function effectivePolicy(policy, profileName) {
  const prof = policy.profiles?.[profileName];
  if (!prof?.sandbox && !prof?.egress) return policy;
  return {
    ...policy,
    ...(prof.sandbox ? { sandbox: { ...policy.sandbox, ...prof.sandbox } } : {}),
    ...(prof.egress ? { egress: { ...policy.egress, ...prof.egress } } : {}),
  };
}

// ------------------------------------------------------------------------------------- roles

// Does the profile's pre-approval `a` already grant everything the role's `r` does?
const domainWithin = (inner, outer) => {
  const b = outer.replace(/^\*\*?\./, '');
  const under = (x) => x === b || x.endsWith(`.${b}`);
  if (inner === outer) return true;
  if (!inner.startsWith('*')) return domainAdmits(outer, inner);
  const ib = inner.replace(/^\*\*?\./, '');
  if (outer.startsWith('**.')) return under(ib);
  if (outer.startsWith('*.')) return inner.startsWith('*.') ? under(ib) : ib.endsWith(`.${b}`);
  return false;
};
function ruleCovers(a, r) {
  if (a.command && r.command) return expandCommand(r.command).every((argv) => expandCommand(a.command).some((pre) => commandMatches(pre, argv)));
  if (a.write && r.write) return a.write === '**' || a.write === r.write;
  if (a.tool && r.tool) return a.tool === r.tool && (a.tool !== 'web-fetch' || !a.domain || Boolean(r.domain && domainWithin(r.domain, a.domain)));
  return false;
}

// The roles an unattended compile emits for this engine, or null when it compiles the profile alone
// (no roles, or a tier with no allowlist boundary to narrow).
function rolesFor(ctx) {
  const all = Object.entries(ctx.policy.roles ?? {});
  if (!all.length) return null;
  if (ctx.tier !== 'unattended') {
    ctx.notes.push(`roles compile for the unattended tier only: a ${ctx.tier} session has no allowlist boundary for a role to narrow`);
    return null;
  }
  const here = all.filter(([, r]) => !r.engines || r.engines.includes(ctx.engine));
  if (!here.length) ctx.error('role-engine', `the policy names roles and none runs on ${ctx.engine}: every unattended run is one of them, so name ${ctx.engine} in a role's engines or drop it from profile "${ctx.profileName}"`);
  return here;
}

// The profile's policy narrowed to one role, in a context of its own; null when the role widens it.
function roleContext(ctx, name, role) {
  const p = ctx.policy;
  const widens = [];
  for (const r of role.allow ?? []) {
    const viaEgress = r.tool === 'web-fetch' && r.domain && p.egress?.default === 'deny' && (p.egress.allow_domains ?? []).some((d) => domainWithin(r.domain, d));
    if (!(p.allow ?? []).some((a) => ruleCovers(a, r)) && !viaEgress) widens.push(`allow ${describeRule(r)} is not in the profile's allow list`);
  }
  for (const d of role.egress?.allow_domains ?? []) {
    if (p.egress?.default === 'deny' && !(p.egress.allow_domains ?? []).some((x) => domainWithin(d, x))) widens.push(`egress domain ${d} is not in the profile's egress allow list`);
  }
  for (const w of widens) ctx.error('role-narrows', `role ${name}: ${w}; a role only narrows the profile`);
  if (role.read_only && (role.allow ?? []).some((r) => r.write)) ctx.error('role-read-only', `role ${name} is read-only and its allow list has a write`);
  if (widens.length || (role.read_only && (role.allow ?? []).some((r) => r.write))) return null;
  const narrowed = { ...p };
  if (role.allow) narrowed.allow = role.allow;
  if (role.egress) narrowed.egress = { ...p.egress, default: 'deny', allow_domains: role.egress.allow_domains };
  if (role.read_only) {
    narrowed.allow = (narrowed.allow ?? []).filter((r) => !r.write);
    narrowed.forbid = [...p.forbid, { write: '**', reason: `role ${name} is read-only` }];
    if (p.sandbox?.writable_roots) narrowed.sandbox = { ...p.sandbox, writable_roots: undefined };
  }
  const rctx = new Context(narrowed, ctx.profileName, ctx.engine, ctx.source);
  rctx.role = name;
  rctx.readOnly = role.read_only === true;
  return rctx;
}

// A role compile's diagnostics, tagged with the role, into the profile's.
function absorb(ctx, rctx, name) {
  for (const e of rctx.errors) ctx.errors.push({ ...e, role: name, message: `role ${name}: ${e.message}` });
  for (const w of rctx.warnings) ctx.warnings.push({ ...w, role: name });
  for (const a of rctx.accepted) ctx.accepted.push({ ...a, role: name });
  for (const n of rctx.notes) ctx.notes.push(`role ${name}: ${n}`);
}

// Compile one profile for one engine. The policy must already be schema-valid (the CLI validates it
// first); `emit` replaces the engine emitters (tests only). Returns { ok, files: [{ path, content, kind }], errors, warnings, accepted, notes }; files is
// empty whenever errors is not.
export function compilePolicy(policy, { profile, engine, source = 'agent-policy.yaml', emit = EMIT }) {
  if (!ENGINES.includes(engine)) throw new Error(`unknown engine "${engine}" (${ENGINES.join(', ')})`);
  const ctx = new Context(effectivePolicy(policy, profile), profile, engine, source);
  policy = ctx.policy;
  // A read-only tier never writes, so a write pre-approval would contradict it on every engine.
  if (ctx.tier === 'read-only' && (policy.allow ?? []).some((r) => r.write)) {
    for (const r of policy.allow.filter((x) => x.write)) ctx.drop('allow', r, 'the read-only tier never writes');
    ctx.policy = { ...policy, allow: policy.allow.filter((x) => !x.write) };
  }
  preflight(ctx);
  let files = [];
  if (ctx.profile) {
    const roles = rolesFor(ctx);
    if (!roles) files = emit[engine](ctx);
    else {
      // One file set per role under roles/<role>/; the guard hook is the profile's, shared by all.
      const shared = (f) => f.path === 'hooks.json' || f.path.startsWith('hooks/');
      const perRole = [];
      let common = [];
      for (const [name, role] of roles) {
        const rctx = roleContext(ctx, name, role);
        if (!rctx) continue;
        const out = emit[engine](rctx);
        absorb(ctx, rctx, name);
        common = out.filter(shared);
        perRole.push(...out.filter((f) => !shared(f)).map((f) => ({ ...f, path: `roles/${name}/${f.path}` })));
      }
      files = [...common, ...perRole];
    }
    for (const b of unsafeKeys(files, { tier: ctx.tier })) ctx.error('walls-only', `the compile emitted a setting that removes a wall: ${b} (a compiler bug; nothing written)`);
  }
  const ok = ctx.errors.length === 0;
  return { ok, engine, profile, tier: ctx.tier, files: ok ? files : [], errors: ctx.errors, warnings: ctx.warnings, accepted: ctx.accepted, notes: ctx.notes };
}

// What the compile accepted and lost, beside the files it wrote (--out <dir>/report.json): the tier,
// every warning (an ask or allow dropped, a mode degraded), every accepted gap with the degradation
// it accepts and the operator's reason, and the notes for the launcher.
export function renderReport(r) {
  return `${JSON.stringify({ tier: r.tier, warnings: r.warnings, accepted: r.accepted.map(({ field, message, reason, role }) => ({ field, message, reason, ...(role ? { role } : {}) })), notes: r.notes }, null, 2)}\n`;
}

// ------------------------------------------------------------------------------------- diff

// A Claude settings file as chezmoi keeps it (settings.json.tmpl): Go template comments and
// action-only lines removed, an inline action ({{ x | toJson }}) replaced by a placeholder string,
// so the JSON parses. Only the static keys matter to the diff.
export function parseSettingsTemplate(text) {
  const stripped = text
    .replace(/\{\{-?\s*\/\*[\s\S]*?\*\/\s*-?\}\}/g, '')
    .split('\n')
    .filter((l) => !/^\s*\{\{[\s\S]*\}\}\s*$/.test(l))
    .join('\n')
    .replace(/\{\{[^}]*\}\}/g, '"<template>"');
  return JSON.parse(stripped);
}

// The keys of a Claude settings file the policy owns; everything else is the operator's taste and
// stays in the hand-written file.
export const CLAUDE_POLICY_KEYS = ['permissions.defaultMode', 'permissions.allow', 'permissions.deny', 'permissions.ask', 'skipDangerousModePermissionPrompt', 'sandbox'];

const get = (o, dotted) => dotted.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);

export function diffClaudeSettings(compiled, handwritten) {
  const lists = {};
  for (const k of ['permissions.allow', 'permissions.deny', 'permissions.ask']) {
    const a = get(compiled, k) ?? [];
    const b = get(handwritten, k) ?? [];
    lists[k] = { both: a.filter((x) => b.includes(x)), onlyCompiled: a.filter((x) => !b.includes(x)), onlyHandwritten: b.filter((x) => !a.includes(x)) };
  }
  const scalars = {};
  for (const k of ['permissions.defaultMode', 'skipDangerousModePermissionPrompt']) {
    scalars[k] = { compiled: get(compiled, k) ?? null, handwritten: get(handwritten, k) ?? null, same: JSON.stringify(get(compiled, k)) === JSON.stringify(get(handwritten, k)) };
  }
  const sandbox = { compiled: compiled.sandbox ?? null, handwritten: handwritten.sandbox ?? null, same: JSON.stringify(compiled.sandbox ?? null) === JSON.stringify(handwritten.sandbox ?? null) };
  const permKeys = Object.keys(handwritten.permissions ?? {}).filter((k) => !['defaultMode', 'allow', 'deny', 'ask'].includes(k)).map((k) => `permissions.${k}`);
  const outsidePolicy = [...Object.keys(handwritten).filter((k) => !['permissions', 'sandbox', 'skipDangerousModePermissionPrompt', '$schema'].includes(k)), ...permKeys];
  const same = Object.values(lists).every((l) => !l.onlyCompiled.length && !l.onlyHandwritten.length) && Object.values(scalars).every((s) => s.same) && sandbox.same;
  return { same, scalars, lists, sandbox, outsidePolicy };
}

export function renderDiff(d) {
  const out = [];
  for (const [k, s] of Object.entries(d.scalars)) out.push(`${s.same ? '=' : '~'} ${k}: compiled ${JSON.stringify(s.compiled)}, hand-written ${JSON.stringify(s.handwritten)}`);
  for (const [k, l] of Object.entries(d.lists)) {
    out.push(`${l.onlyCompiled.length || l.onlyHandwritten.length ? '~' : '='} ${k}: ${l.both.length} in both`);
    for (const x of l.onlyCompiled) out.push(`    + ${x}   (compiled only)`);
    for (const x of l.onlyHandwritten) out.push(`    - ${x}   (hand-written only)`);
  }
  out.push(`${d.sandbox.same ? '=' : '~'} sandbox: compiled ${JSON.stringify(d.sandbox.compiled)}; hand-written ${JSON.stringify(d.sandbox.handwritten)}`);
  if (d.outsidePolicy.length) out.push(`  outside the policy contract (kept by hand): ${d.outsidePolicy.join(', ')}`);
  return out.join('\n');
}
