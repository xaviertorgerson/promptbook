#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { compilePolicy, diffClaudeSettings, ENGINES, parseSettingsTemplate, renderDiff, renderReport } from './lib/compile-policy.mjs';
import { readText } from './lib/loaders.mjs';
import { registry } from './lib/registry.mjs';
import { validateFile } from './lib/validate.mjs';

const USAGE = `Compile the L1 agent policy into one engine's settings for one machine profile.

  node tools/compile-policy.mjs <agent-policy.yaml> --profile <p> --engine claude|codex|gemini [--out <dir>]
      --out <dir>          write the files there, and report.json: warnings, accepted gaps with
                           what each degrades, notes (default: print the files)
      --diff <settings>    compare the compiled Claude settings with a hand-written settings.json
                           (or a chezmoi settings.json.tmpl) and report differences; exit 0
      --json               machine-readable result

Fail closed: a deny the engine cannot represent is an error unless accept_gaps names it with a
reason; an unrepresentable ask or allow is dropped with a warning. A bypass tier without its
preconditions is refused. Nothing is written when anything fails.
Exit 0 compiled, 1 refused, 2 usage error. Engine mappings: adapters/<engine>/README.md.`;

export function main(argv = process.argv.slice(2)) {
  const VALUED = new Set(['--profile', '--engine', '--out', '--diff']);
  const value = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1]; };
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const [file] = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  const profile = value('--profile');
  const engine = value('--engine');
  const usage = (msg) => { console.error(`compile-policy: ${msg}\n\n${USAGE}`); return 2; };
  if (!file || !fs.existsSync(file)) return usage(`give an existing policy file (got ${file ?? 'nothing'})`);
  if (!profile) return usage('--profile is required');
  if (!ENGINES.includes(engine)) return usage(`--engine must be one of ${ENGINES.join(', ')}`);

  // The policy contract first: the compiler trusts a schema-valid policy and nothing else.
  const v = validateFile(file, { contract: 'policy', registry: registry() });
  const invalid = v.results.flatMap((r) => r.findings.filter((f) => f.severity === 'error'));
  if (invalid.length) {
    console.error(`compile-policy: ${file} is not a valid policy:`);
    for (const f of invalid) console.error(`  ${f.pointer} ${f.rule}${f.line ? `:${f.line}` : ''}: ${f.message}`);
    return 1;
  }
  const policy = parse(readText(file));
  const result = compilePolicy(policy, { profile, engine, source: path.basename(file) });

  const out = value('--out');
  const written = result.ok && out ? [...result.files, { path: 'report.json', content: renderReport(result), kind: 'report' }] : [];
  for (const f of written) {
    const dest = path.join(out, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.content);
  }
  let diff = null;
  const diffWith = value('--diff');
  if (diffWith && result.ok) {
    if (engine !== 'claude') return usage('--diff compares Claude settings only');
    const compiled = JSON.parse(result.files.find((f) => f.path === 'settings.json').content);
    const text = readText(diffWith);
    diff = diffClaudeSettings(compiled, diffWith.endsWith('.tmpl') ? parseSettingsTemplate(text) : JSON.parse(text));
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...result, files: result.files.map(({ data, ...f }) => f), diff }, null, 2));
    return result.ok ? 0 : 1;
  }
  for (const e of result.errors) {
    console.error(`error   ${e.rule}: ${e.message}`);
    if (e.stanza) console.error(`        to accept it, add to the policy:\n${e.stanza.replace(/^/gm, '          ')}`);
  }
  for (const w of result.warnings) console.error(`warning ${w.rule}: ${w.message}`);
  for (const a of result.accepted) console.error(`accepted gap ${engine}.${a.field}: ${a.message} — "${a.reason}"`);
  for (const n of result.notes) console.error(`note    ${n}`);
  if (!result.ok) {
    console.error(`REFUSED ${engine} for profile ${profile} (tier ${result.tier ?? '?'}): ${result.errors.length} error(s); nothing written`);
    return 1;
  }
  if (diff) {
    console.log(`diff: compiled ${engine} settings vs ${diffWith} — ${diff.same ? 'same' : 'different'}`);
    console.log(renderDiff(diff));
  } else if (out) {
    for (const f of written) console.log(`wrote ${path.join(out, f.path)} (${f.kind})`);
  } else {
    for (const f of result.files) console.log(`--- ${f.path} (${f.kind})\n${f.content}`);
  }
  console.error(`COMPILED ${engine} for profile ${profile} (tier ${result.tier}): ${result.files.length} file(s), ${result.warnings.length} warning(s), ${result.accepted.length} accepted gap(s)`);
  return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
