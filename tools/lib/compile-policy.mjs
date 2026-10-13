import { toToml } from './toml.mjs';

// The L1 policy compiler: agent-policy.yaml (schemas/policy.schema.json) -> one engine's settings,
// for one machine profile. Every mapping is the table in adapters/<engine>/README.md; this file is
// the executable half. The rules every engine shares:
//
//   fail closed   a deny the engine cannot represent (deny_read, forbid, egress, sandbox, budgets,
//                 tier) is an error unless accept_gaps names {engine, field} with a reason; an ask or
//                 allow it cannot represent is dropped with a warning (dropping one never loosens a
//                 wall). On any error nothing is written.
//   walls only    the compiler never emits a key that removes walls: disableAllHooks,
//                 hooksConfig.enabled false, security.disableYoloMode overrides, tools.exclude,
//                 :danger-full-access, a bypass mode or its prompt skip outside the bypass tier
//                 (assertNoUnsafeKeys, checked on every compile).
//   preconditions the bypass tier (autonomous) names what keeps it safe outside the policy
//                 (profile `requires`, never waivable) and is isolated by the policy's own sandbox
//                 and egress deny, or by an accept_gaps entry for that field with a reason (HAR-4);
//                 the unattended tier has the caps HAR-3 states, which accept_gaps cannot waive.

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

const describeRule = (r) => (r.command ? `command ${JSON.stringify(r.command)}` : r.write ? `write ${r.write}` : `tool ${r.tool}${r.domain ? ` domain ${r.domain}` : ''}`);

class Context {
  constructor(policy, profileName, engine, source) {
    this.policy = policy;
    this.profileName = profileName;
    this.engine = engine;
    this.source = source;
    this.profile = policy.profiles?.[profileName];
    this.tier = this.profile?.tier;
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

  // A deny-side field the engine cannot represent (or only partly). true when the operator accepted
  // the gap, so the caller may emit its best effort; false (and an error) otherwise.
  gap(field, message) {
    const acc = (this.policy.accept_gaps ?? []).find((g) => g.engine === this.engine && g.field === field);
    if (acc) {
      this.accepted.push({ field, message, reason: acc.reason });
      return true;
    }
    this.error('unrepresentable', `${this.engine} cannot represent ${field}: ${message}`, {
      field,
      stanza: `accept_gaps:\n  - { engine: ${this.engine}, field: ${field}, reason: "<why this degradation is acceptable>" }`,
    });
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
        if (!r.command || !commandMatches(r.command, ex.trim().split(/\s+/))) ctx.error('example-matches', `${list}/${i}: example "${ex}" does not match ${describeRule(r)}`);
      }
    });
  }
  if (!ctx.profile) {
    ctx.error('profile-exists', `no profile "${ctx.profileName}" (profiles: ${Object.keys(p.profiles ?? {}).join(', ')})`);
    return;
  }
  if (ctx.profile.engines && !ctx.profile.engines.includes(ctx.engine)) {
    ctx.error('engine-installed', `profile "${ctx.profileName}" lists engines ${ctx.profile.engines.join(', ')}; it does not install ${ctx.engine}`);
  }
  if (ctx.tier === BYPASS_TIER) {
    // HAR-4: bypass only where the agent is sandboxed (non-root, never falling back to running
    // unsandboxed) and production is unreachable at the network level. The policy's own isolation is
    // the sandbox and egress.default deny; an operator who isolates the host another way (a
    // container, a network ACL) accepts that field's gap by name, with a reason. What keeps the host
    // safe outside the policy is named in the profile's requires, which nothing waives.
    const accepted = (field) => (p.accept_gaps ?? []).find((g) => g.engine === ctx.engine && g.field === field);
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
      ctx.error('bypass-preconditions', `profile "${ctx.profileName}" is the bypass tier (${BYPASS_TIER}) without its preconditions (HAR-4: sandboxed, non-root, production unreachable): set ${missing.join(', ')}, or accept the gap by name (accept_gaps: { engine: ${ctx.engine}, field: sandbox|egress, reason })`);
    }
    const req = ctx.profile.requires ?? [];
    if (!req.length) ctx.error('bypass-requires', `profile "${ctx.profileName}" is the bypass tier (${BYPASS_TIER}) and names no preconditions; set requires: [prod-unreachable-from-this-host, ...] (HAR-4). The compiler cannot see a network ACL or a container, so it will not assume one`);
    else ctx.notes.push(`bypass tier ${ctx.profileName} requires: ${req.join(', ')} (the launcher checks each before starting; the policy cannot)`);
  }
  if (ctx.tier === 'unattended') {
    const b = p.budgets?.unattended ?? {};
    const missing = ['max_turns', 'max_usd'].filter((k) => b[k] === undefined);
    if (missing.length) ctx.error('unattended-caps', `the unattended tier runs with turn and spend caps (HAR-3): budgets.unattended lacks ${missing.join(', ')}`);
  }
}

// ------------------------------------------------------------------------------------- claude

const CLAUDE_MODE = { 'read-only': 'plan', ask: 'default', 'auto-edit': 'acceptEdits', autonomous: 'bypassPermissions' };

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

function claudeRules(ctx, rule, list) {
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
      else if (tier !== 'unattended') ctx.warn('egress-prompts', 'WebFetch outside allow_domains prompts a human instead of being denied; the sandbox allowlist binds shell commands only');
    }
  }

  const sandbox = {};
  if (p.sandbox?.enabled !== undefined) sandbox.enabled = p.sandbox.enabled;
  if (p.sandbox?.fail_if_unavailable !== undefined) sandbox.failIfUnavailable = p.sandbox.fail_if_unavailable;
  for (const w of p.sandbox?.writable_roots ?? []) {
    if (isHome(w) || isAbsolute(w)) fsys.allowWrite.push(w);
    else ctx.drop('sandbox.writable_roots', { write: w }, 'a relative sandbox path in user settings resolves against ~/.claude, not the workspace');
  }
  const filesystem = Object.fromEntries(Object.entries(fsys).filter(([, v]) => v.length));
  if (Object.keys(filesystem).length) sandbox.filesystem = filesystem;
  const network = Object.fromEntries(Object.entries(net).filter(([, v]) => v.length));
  if (egress?.default === 'deny') network.strictAllowlist = true;
  if (Object.keys(network).length) sandbox.network = network;

  const permissions = {};
  if (CLAUDE_MODE[tier]) permissions.defaultMode = CLAUDE_MODE[tier];
  for (const k of ['allow', 'deny', 'ask']) if (perm[k].length) permissions[k] = perm[k];
  const settings = { permissions };
  if (tier === BYPASS_TIER) settings.skipDangerousModePermissionPrompt = true;
  if (Object.keys(sandbox).length) settings.sandbox = sandbox;

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
  if (budget.max_tokens) ctx.gap('budgets', 'max_tokens has no flag and no timeout can enforce it');
  const runner = runnerFile(ctx, args, budget);

  return [
    { path: 'settings.json', content: `${JSON.stringify(settings, null, 2)}\n`, kind: 'settings-fragment' },
    { path: 'runner.json', content: `${JSON.stringify(runner, null, 2)}\n`, kind: 'runner' },
  ];
}

function runnerFile(ctx, args, budget) {
  return {
    generated_by: GENERATOR,
    source: ctx.source,
    engine: ctx.engine,
    profile: ctx.profileName,
    tier: ctx.tier,
    ...(ctx.profile?.requires?.length ? { requires: ctx.profile.requires } : {}),
    args,
    timeout_seconds: budget.max_minutes ? budget.max_minutes * 60 : null,
  };
}

// ------------------------------------------------------------------------------------- codex

const CODEX_BASE = { 'read-only': ':read-only', ask: ':workspace', 'auto-edit': ':workspace', autonomous: ':workspace', unattended: ':workspace' };
const CODEX_APPROVAL = { ask: 'on-request', 'auto-edit': 'on-request', autonomous: 'never', unattended: 'never' };

const starlark = (v) => (Array.isArray(v) ? `[${v.map(starlark).join(', ')}]` : JSON.stringify(v));

export function renderPrefixRule(r) {
  const lines = [`    pattern = ${starlark(r.pattern)},`, `    decision = ${starlark(r.decision)},`];
  if (r.justification) lines.push(`    justification = ${starlark(r.justification)},`);
  if (r.match?.length) lines.push(`    match = ${starlark(r.match)},`);
  return `prefix_rule(\n${lines.join('\n')}\n)\n`;
}

function emitCodex(ctx) {
  const { policy: p, tier } = ctx;
  if (tier === 'auto-edit') ctx.warn('degraded', 'Codex has no "edits free, commands ask" mode: auto-edit compiles like ask (approval_policy on-request)');
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
  for (const r of p.forbid) {
    if (r.command && globToken(r) && !ctx.gap('forbid', `${describeRule(r)}: execpolicy matches * and ? literally, so the forbid would block less than it says`)) continue;
    if (r.command) prefixRule(r, 'forbidden', 'forbid');
    else if (r.write) {
      if (ctx.gap('forbid', `write ${r.write}: a filesystem "read" downgrade covers sandboxed commands, not the apply_patch tool`)) setPath(r.write, 'read');
    } else if (r.tool === 'web-fetch' && r.domain) setDomain(r.domain, 'deny');
    else if (r.tool.startsWith('mcp:') && r.tool.split(':')[2]) {
      const [, s, t] = r.tool.split(':');
      (mcp[s] ??= { disabled_tools: [] }).disabled_tools.push(t);
    } else ctx.gap('forbid', `${describeRule(r)} has no documented Codex key${r.tool.startsWith('mcp:') ? ' (omit the server from config.toml instead)' : ''}`);
  }
  // Unattended, nobody answers a prompt: an ask is a denial (ADR-0021), written as one so no
  // approval policy can turn it into a yes.
  for (const r of p.ask ?? []) {
    if (r.command) prefixRule(tier === 'unattended' ? { ...r, reason: `ask in an unattended tier is a denial${r.reason ? `: ${r.reason}` : ''}` } : r, tier === 'unattended' ? 'forbidden' : 'prompt', 'ask');
    else ctx.drop('ask', r, 'Codex has no ask for writes or tools');
  }
  for (const r of p.allow ?? []) {
    if (r.command) prefixRule(r, 'allow', 'allow');
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
  for (const w of p.sandbox?.writable_roots ?? []) setPath(w, 'write');

  const budget = p.budgets?.[tier] ?? {};
  const capped = ['max_turns', 'max_usd', 'max_tokens'].filter((k) => budget[k] !== undefined);
  if (capped.length) ctx.gap('budgets', `${capped.join(', ')} have no documented codex exec flag (a runner timeout enforces max_minutes only)`);

  const profileTable = {
    description: `Compiled from ${ctx.source} (profile ${ctx.profileName}, tier ${tier}) by ${GENERATOR}`,
    extends: CODEX_BASE[tier],
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
    { path: configName, content: `${header}\n${toToml(config)}`, kind: 'settings-fragment' },
    { path: 'rules/harness.rules', content: rulesText, kind: 'rules' },
    { path: 'runner.json', content: `${JSON.stringify(runnerFile(ctx, [], budget), null, 2)}\n`, kind: 'runner' },
  ];
}

// ------------------------------------------------------------------------------------- gemini

const GEMINI_MODE = { 'read-only': 'plan', ask: 'default', 'auto-edit': 'auto_edit' };

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
    if (r.command) {
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

  if (p.deny_read.length && ctx.gap('deny_read', `read denies reach only the file tools (${GEMINI_READ_TOOLS.join(', ')}; names unverified), not run_shell_command reads`)) {
    for (const g of p.deny_read) rule('forbid', { toolName: GEMINI_READ_TOOLS, argsPattern: globArgsPattern(g) }, { reason: `deny_read ${g} (${ctx.source})` });
  }
  for (const r of p.forbid) {
    if (r.command && globToken(r) && !ctx.gap('forbid', `${describeRule(r)}: commandPrefix matches * and ? literally, so the forbid would block less than it says`)) continue;
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
  for (const w of p.sandbox?.writable_roots ?? []) ctx.drop('sandbox.writable_roots', { write: w }, 'container mounts are the launcher\'s job');

  const budget = p.budgets?.[tier] ?? {};
  const capped = ['max_turns', 'max_usd', 'max_tokens'].filter((k) => budget[k] !== undefined);
  if (capped.length) ctx.gap('budgets', `${capped.join(', ')} have no main-session key (only subagent max_turns)`);

  const header = `# Compiled from ${ctx.source} (profile ${ctx.profileName}, tier ${tier}) by ${GENERATOR}.\n# User-tier policy (~/.gemini/policies/); the workspace tier is disabled upstream. Tool names other than\n# read_file, glob, write_file, replace and run_shell_command are unverified (adapters/gemini).\n`;
  return [
    { path: 'settings.json', content: `${JSON.stringify(settings, null, 2)}\n`, kind: 'settings-fragment' },
    { path: 'policies/harness.toml', content: `${header}\n${rules.length ? toToml({ rule: rules }) : ''}`, kind: 'rules' },
    { path: 'runner.json', content: `${JSON.stringify(runnerFile(ctx, args, budget), null, 2)}\n`, kind: 'runner' },
  ];
}

// ------------------------------------------------------------------------------------- guard

// The keys that would remove a wall, checked on every compile's output. Throws: a hit is a compiler
// bug, never a policy choice.
export function assertNoUnsafeKeys(files, { engine, tier }) {
  const bad = [];
  for (const f of files) {
    const c = f.content;
    if (/disableAllHooks/.test(c)) bad.push(`${f.path}: disableAllHooks`);
    if (/"hooksConfig"/.test(c) && /"enabled"\s*:\s*false/.test(c)) bad.push(`${f.path}: hooksConfig.enabled false`);
    if (/disableYoloMode/.test(c)) bad.push(`${f.path}: security.disableYoloMode`);
    if (/"exclude"\s*:/.test(c) && engine === 'gemini') bad.push(`${f.path}: tools.exclude`);
    if (/danger-full-access|dangerously-skip-permissions/.test(c)) bad.push(`${f.path}: a full-access mode`);
    if (tier !== BYPASS_TIER && /skipDangerousModePermissionPrompt|bypassPermissions|--yolo|approval-mode=yolo/.test(c)) bad.push(`${f.path}: a bypass key outside the ${BYPASS_TIER} tier`);
  }
  if (bad.length) throw new Error(`compile-policy emitted a key that removes a wall: ${bad.join('; ')}`);
}

const EMIT = { claude: emitClaude, codex: emitCodex, gemini: emitGemini };

// Compile one profile for one engine. The policy must already be schema-valid (the CLI validates it
// first). Returns { ok, files: [{ path, content, kind }], errors, warnings, accepted, notes }; files is
// empty whenever errors is not.
export function compilePolicy(policy, { profile, engine, source = 'agent-policy.yaml' }) {
  if (!ENGINES.includes(engine)) throw new Error(`unknown engine "${engine}" (${ENGINES.join(', ')})`);
  const ctx = new Context(policy, profile, engine, source);
  // A read-only tier never writes, so a write pre-approval would contradict it on every engine.
  if (ctx.tier === 'read-only' && (policy.allow ?? []).some((r) => r.write)) {
    for (const r of policy.allow.filter((x) => x.write)) ctx.drop('allow', r, 'the read-only tier never writes');
    ctx.policy = { ...policy, allow: policy.allow.filter((x) => !x.write) };
  }
  preflight(ctx);
  let files = [];
  if (ctx.profile) {
    files = EMIT[engine](ctx);
    assertNoUnsafeKeys(files, { engine, tier: ctx.tier });
  }
  const ok = ctx.errors.length === 0;
  return { ok, engine, profile, tier: ctx.tier, files: ok ? files : [], errors: ctx.errors, warnings: ctx.warnings, accepted: ctx.accepted, notes: ctx.notes };
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
