#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { readText } from './lib/loaders.mjs';
import { registry } from './lib/registry.mjs';
import { checkRequires, PROBES } from './lib/requires.mjs';
import { validateFile } from './lib/validate.mjs';

const USAGE = `Probe this host for a policy profile's named preconditions (its requires).

  harness check-requires --policy <agent-policy.yaml> --profile <p> [--json]

Probes: ${Object.keys(PROBES).join(', ')}.
  prod-unreachable-from-this-host  a TCP connect to every requires_config.prod_hosts entry fails
                                   within requires_config.connect_timeout_ms (default 3000)
  non-root                         the uid is not 0
  container                        /.dockerenv, /run/.containerenv, $container or a container cgroup
  non-root-container               both of the above
  sandbox-available                bubblewrap runs (Linux) or sandbox-exec runs (macOS)
An unknown name fails closed. A bypass-tier profile that names none fails (HAR-4).
Exit 0 every probe passed, 1 one failed, 2 usage error. harness run applies the same check to the
requires in a runner.json before it starts a run.`;

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const value = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1]; };
  const usage = (msg) => { console.error(`check-requires: ${msg}\n\n${USAGE}`); return 2; };
  const file = value('--policy');
  const name = value('--profile');
  if (!file || !fs.existsSync(file)) return usage(`give an existing --policy file (got ${file ?? 'nothing'})`);
  if (!name) return usage('--profile is required');
  const v = validateFile(file, { contract: 'policy', registry: registry() });
  const invalid = v.results.flatMap((r) => r.findings.filter((f) => f.severity === 'error'));
  if (invalid.length) {
    console.error(`check-requires: ${file} is not a valid policy:`);
    for (const f of invalid) console.error(`  ${f.pointer} ${f.rule}: ${f.message}`);
    return 1;
  }
  const policy = parse(readText(file));
  const profile = policy.profiles[name];
  if (!profile) return usage(`no profile "${name}" (profiles: ${Object.keys(policy.profiles).join(', ')})`);
  const requires = profile.requires ?? [];
  const results = await checkRequires(requires, policy.requires_config);
  if (profile.tier === 'autonomous' && !requires.length) results.push({ name: 'bypass-requires', ok: false, detail: 'the bypass tier names no requires (HAR-4)' });
  const ok = results.every((r) => r.ok);
  if (argv.includes('--json')) console.log(JSON.stringify({ profile: name, tier: profile.tier, ok, results }, null, 2));
  else {
    for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}: ${r.detail}`);
    console.log(`${ok ? 'PASS' : 'FAIL'} profile ${name} (tier ${profile.tier}): ${results.length ? `${results.filter((r) => r.ok).length}/${results.length} precondition(s) hold` : 'names no requires; nothing to check'}`);
  }
  return ok ? 0 : 1;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
