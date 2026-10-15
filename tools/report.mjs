#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { readRuns, render, runFiles, summarize } from './lib/report.mjs';

const USAGE = `What the agent runs cost: totals from run-record JSONL.

  promptbook report [file|dir]... [--since <date>] [--json]

  A file is read as run records; a directory is searched for them (.agent/loop-runs.jsonl,
  .agent/runs/*.jsonl, *.run-record.jsonl). With no path, the current directory. Each line is
  validated against the run-record contract; an invalid line is skipped and listed, never counted.
  Per task, per role (once any run names one) and in total: runs, outcomes, turns, cost, input and
  output tokens, cache hit rate (cache read / all input) and denied calls; then the three most
  expensive runs.
      --since <date>   only runs started at or after it (2026-10-01, or a full ISO time)
      --json           print the report as JSON

Exit 0 when every line is a valid run record, 1 when a line was skipped, 2 on a usage error.`;

export function main(argv = process.argv.slice(2)) {
  const usage = (m) => { console.error(`report: ${m}\n\n${USAGE}`); return 2; };
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const paths = [];
  let since = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') continue;
    if (a === '--since') {
      since = argv[(i += 1)];
      if (since === undefined || Number.isNaN(Date.parse(since))) return usage(`--since needs a date, got ${since === undefined ? 'nothing' : JSON.stringify(since)}`);
    } else if (a.startsWith('-')) return usage(`unknown option ${a}`);
    else paths.push(a);
  }
  if (!paths.length) paths.push('.');
  for (const p of paths) if (!fs.existsSync(p)) return usage(`no such file or directory: ${p}`);
  const seen = new Set();
  const files = paths.flatMap((p) => runFiles(p)).filter((f) => {
    const real = fs.realpathSync(f);
    return !seen.has(real) && seen.add(real);
  });
  const { runs, invalid } = readRuns(files, { since: since === null ? null : Date.parse(since) });
  const summary = summarize(runs);
  if (argv.includes('--json')) console.log(JSON.stringify({ files, since, invalid, ...summary }, null, 2));
  else console.log(files.length ? render({ files, invalid, since }, summary) : `no run-record file under ${paths.join(', ')}`);
  return invalid.length ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
