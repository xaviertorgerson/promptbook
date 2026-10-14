#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { verifyGrant } from './lib/grant-verify.mjs';

const USAGE = `Check a grant before acting under it.

  harness grant verify <grant.yaml>... [--git] [--owners a,b] [--identities <file.yaml>] [--root <dir>]

  The grant contract (schema and named checks); the file is a live grant under .orchestrator/grants/
  (a draft under drafts/ is reported, not live); granted_by, every narrowed[].by and revoked_by are
  owners of that path (the project's CODEOWNERS rule for it, or --owners); narrowed[] only narrows
  (removes what the grant in force holds, lowers limits and the expiry, never empties a scope list).
  --git also checks the history: the file's last commit is by granted_by, every commit touching it
  is by an owner, the issued fields are as first committed, narrowed[] was only appended to, and a
  commit named in source exists. A git author matches a handle by name, email local part, or the
  --identities map ({handle: [emails or names]}).
      --json    print the findings as JSON

Exit 0 when every grant verifies, 1 when one does not, 2 on a usage error.`;

export function main(argv = process.argv.slice(2)) {
  const VALUED = new Set(['--owners', '--identities', '--root']);
  const value = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1]; };
  const usage = (m) => { console.error(`grant: ${m}\n\n${USAGE}`); return 2; };
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const [cmd, ...files] = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  if (cmd !== 'verify') return usage(cmd ? `unknown subcommand ${cmd}` : 'give a subcommand: verify');
  if (!files.length) return usage('give one or more grant files');
  for (const f of files) if (!fs.existsSync(f)) return usage(`no such file: ${f}`);
  let identities = {};
  if (value('--identities')) {
    try { identities = parse(fs.readFileSync(value('--identities'), 'utf8')) ?? {}; } catch (e) { return usage(`--identities: ${e.message}`); }
  }
  const owners = value('--owners') ? value('--owners').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const results = files.map((f) => verifyGrant(f, { git: argv.includes('--git'), owners, identities, root: value('--root') ?? null }));
  const failed = results.some((r) => r.findings.some((x) => x.severity === 'error'));
  if (argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
  else {
    for (const r of results) {
      const errors = r.findings.filter((x) => x.severity === 'error');
      console.log(`${errors.length ? 'FAIL' : 'PASS'} ${r.file}${r.live ? ' (live)' : ''}`);
      for (const x of r.findings) console.log(`  ${x.severity === 'error' ? '' : `${x.severity} `}${x.rule}: ${x.message}`);
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
