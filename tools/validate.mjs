#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { registry } from './lib/registry.mjs';
import { renderReadiness, trace } from './lib/trace.mjs';
import { validateFile, validatePath } from './lib/validate.mjs';

const USAGE = `Validate harness artifacts against their contracts.

  node tools/validate.mjs <file|dir>...              infer each file's contract from its path
  node tools/validate.mjs --contract task <file>...  validate as one contract
  node tools/validate.mjs --trace <project-root>     check the trace graph (BRIEF -> ... -> tests)
      [--tests "<glob>"]...                          test files to read names from (repeatable)
      [--test-pattern "<regex>"]...                  another way a test is named: group 1 (or the
                                                     match) of each match is a name (repeatable)
      [--readiness <dir>]                            write <dir>/<epic>/readiness.md per epic, with
                                                     the root's HEAD as source_commit (in a git repo)
      [--no-timestamp]                               omit generated_at and source_commit, so a
                                                     committed report changes only with the plan
      [--strict]                                     warnings fail too
  node tools/validate.mjs --list                     list contracts, versions and artifact paths
  options: --json (machine-readable), --quiet (failures only), --warnings (print warnings)

Exit 0 when nothing fails, 1 when something fails, 2 on a usage error.`;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const values = (n) => args.flatMap((a, i) => (args[i - 1] === n ? [a] : []));
const VALUED = new Set(['--contract', '--trace', '--tests', '--test-pattern', '--readiness']);
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUED.has(args[i - 1]));

function fail(msg) {
  console.error(`validate: ${msg}\n\n${USAGE}`);
  process.exit(2);
}

const loc = (f) => `${f.line ? `:${f.line}` : ''}`;

function printFile(r, opts) {
  const rel = path.relative(process.cwd(), r.file) || r.file;
  const errors = r.results.flatMap((x) => x.findings.filter((f) => f.severity === 'error').map((f) => ({ ...f, contract: x.contract })));
  const warnings = r.results.flatMap((x) => x.findings.filter((f) => f.severity === 'warning').map((f) => ({ ...f, contract: x.contract })));
  if (opts.quiet && r.status === 'PASS') return;
  const tags = r.results.map((x) => `${x.contract}@${x.version}${x.records > 1 ? ` ×${x.records}` : ''}`).join(', ');
  console.log(`${r.status} ${rel}${tags ? ` [${tags}]` : ''}`);
  for (const f of errors) console.log(`  ${f.pointer} ${f.rule}${loc(f)}: ${f.message}`);
  if (opts.warnings) for (const f of warnings) console.log(`  warning ${f.pointer} ${f.rule}${loc(f)}: ${f.message}`);
}

if (flag('--help') || flag('-h')) { console.log(USAGE); process.exit(0); }

if (flag('--list')) {
  const r = registry();
  for (const c of r.contracts()) {
    console.log(`${c.padEnd(18)} ${r.version(c).padEnd(7)} ${r.artifacts(c).map((a) => `${a.paths.join(' ')}${a.suffixes ? ` *${a.suffixes.join(' *')}` : ''} (${a.format})`).join('; ')}`);
  }
  process.exit(0);
}

if (flag('--trace')) {
  const [root] = values('--trace');
  if (!root || !fs.existsSync(root)) fail(`--trace needs an existing project root (got ${root ?? 'nothing'})`);
  const tests = values('--tests');
  const patterns = values('--test-pattern');
  for (const p of patterns) { try { new RegExp(p); } catch (e) { fail(`--test-pattern ${p}: ${e.message}`); } }
  const result = trace(root, { ...(tests.length ? { testGlobs: tests } : {}), testPatterns: patterns });
  const strict = flag('--strict');
  const failed = result.counts.error > 0 || (strict && result.counts.warning > 0);
  const [out] = values('--readiness');
  if (out) {
    // Both change on every check whatever the plan says; --no-timestamp leaves them out so a
    // committed report does not dirty the tree (its own commit dates it).
    const stable = flag('--no-timestamp');
    const head = stable ? null : spawnSync('git', ['-C', root, 'rev-parse', '--verify', '--quiet', 'HEAD'], { encoding: 'utf8' });
    const commit = head?.status === 0 ? head.stdout.trim() : undefined;
    for (const e of result.epics) {
      const dir = path.join(out, e.epic);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'readiness.md'), renderReadiness(result, e.epic, { commit, ...(stable ? { now: null } : {}) }));
    }
  }
  if (flag('--json')) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(failed ? 1 : 0);
  }
  console.log(`trace ${path.resolve(root)} — ${result.adoption} adoption; ${result.tests.files} test file(s), ${result.tests.names} test name(s)`);
  const show = (g) => console.log(`  ${g.severity.padEnd(7)} ${g.rule}${g.blocks_readiness ? ' (blocks readiness)' : ''} ${g.subject}${g.file ? ` — ${g.file}${g.line ? `:${g.line}` : ''}` : ''}\n          ${g.message}`);
  const global = result.gaps.filter((g) => !g.epic);
  if (global.length) { console.log('project'); global.forEach(show); }
  for (const e of result.epics) {
    const c = e.coverage;
    console.log(`epic ${e.epic} [${e.epic_status}, ${e.mode}] — ${e.verdict.toUpperCase()}: ${e.counts.error} error(s), ${e.counts.warning} warning(s); journeys ${c.journeys.covered}/${c.journeys.total}, requirements ${c.requirements.covered}/${c.requirements.total}, tasks citing a requirement ${c.tasks.covered}/${c.tasks.total}, criteria in tests ${c.criteria.covered}/${c.criteria.total}`);
    e.gaps.forEach(show);
  }
  console.log(`${failed ? 'FAIL' : 'PASS'} trace: ${result.counts.error} error(s), ${result.counts.warning} warning(s), ${result.counts.info} info${strict ? ' (strict)' : ''}`);
  process.exit(failed ? 1 : 0);
}

if (!positional.length) fail('give a file or directory, or --trace <root>, or --list');
const [contract] = values('--contract');
if (contract && !registry().has(contract)) fail(`unknown contract "${contract}" (known: ${registry().contracts().join(', ')})`);
const opts = { contract, quiet: flag('--quiet'), warnings: flag('--warnings') };

const results = [];
for (const target of positional) {
  if (!fs.existsSync(target)) fail(`no such file or directory: ${target}`);
  if (fs.statSync(target).isDirectory()) results.push(...validatePath(target, opts));
  else {
    const r = validateFile(target, opts);
    if (r.status === 'SKIP') fail(`no contract matches ${target}; pass --contract <name> (--list shows them)`);
    results.push(r);
  }
}

if (flag('--json')) console.log(JSON.stringify(results, null, 2));
else {
  for (const r of results) printFile(r, opts);
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`${failed ? 'FAIL' : 'PASS'} ${results.length - failed}/${results.length} file(s) valid`);
}
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
