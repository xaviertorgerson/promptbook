#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { importEvals } from './lib/import-evals.mjs';

const USAGE = `Import an agentic-template evals.md into the harness's three eval files.

  node tools/import-evals.mjs <evals.md> --out <skill>/evals
      --skill <name>        the skill's name in the headings (default: the evals.md folder's name)
      --rename a=b,c=d      map the source's skill names to the harness's in route_to
      --k <n>               pass^k for the imported scenarios (default 3)
      --force               overwrite routing.jsonl, scenarios.md, evidence.md if they exist
      --dry-run             print what would be written; write nothing

Writes routing.jsonl (a no-trigger row with no skill to route to becomes a negative case with
note "needs route_to"), scenarios.md (a scenario the source gives no prompt gets a TODO(import)
prompt) and evidence.md. Lint reports both markers (imported-needs-review) until a human resolves
them. Exit 0 written, 1 refused (a file exists), 2 usage error.`;

export function main(argv = process.argv.slice(2)) {
  const VALUED = new Set(['--out', '--skill', '--rename', '--k']);
  const value = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1]; };
  const usage = (m) => { console.error(`import-evals: ${m}\n\n${USAGE}`); return 2; };
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const [file] = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  if (!file || !fs.existsSync(file)) return usage(file ? `no such file: ${file}` : 'give an evals.md');
  const out = value('--out');
  const dryRun = argv.includes('--dry-run');
  if (!out && !dryRun) return usage('--out <skill>/evals is required (or --dry-run)');
  const k = Number(value('--k') ?? 3);
  if (!(Number.isInteger(k) && k >= 1)) return usage('--k takes a whole number of at least 1');
  const rename = {};
  for (const pair of (value('--rename') ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
    const [a, b] = pair.split('=');
    if (!a || !b) return usage(`--rename takes old=new pairs (got ${pair})`);
    rename[a.trim()] = b.trim();
  }
  const skill = value('--skill') ?? path.basename(path.dirname(path.resolve(file)));
  const r = importEvals(fs.readFileSync(file, 'utf8'), { skill, source: file, rename, k });
  const files = { 'routing.jsonl': r.routingJsonl, 'scenarios.md': r.scenarios, 'evidence.md': r.evidence };
  if (dryRun) {
    for (const [name, text] of Object.entries(files)) console.log(`--- ${name}\n${text}`);
  } else {
    const existing = Object.keys(files).filter((n) => fs.existsSync(path.join(out, n)));
    if (existing.length && !argv.includes('--force')) {
      console.error(`import-evals: ${existing.join(', ')} already exist in ${out}; pass --force to overwrite`);
      return 1;
    }
    fs.mkdirSync(out, { recursive: true });
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(out, name), text);
  }
  const c = r.counts;
  console.log(`import-evals: ${skill}: ${c.positive} positive, ${c.nearMiss} near-miss, ${c.negative} negative routing case(s); ${c.scenarios} scenario(s); ${c.evidence} evidence entr(ies)${dryRun ? ' (dry run)' : ` → ${out}`}`);
  for (const x of r.review) console.log(`  needs review: ${x}`);
  return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
