#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { DEFAULT_DENY_TERMS, LIMITS, lintSkills } from './lib/lint-skills.mjs';

const USAGE = `Lint skills against the harness authoring rules.

  node tools/lint-skills.mjs [dir]...      skill folders, or folders of skills (default: skills)
      --known a,b                          more skill names a near-miss may route to
      --deny-terms "A,B"                   replace the engine/vendor deny-list
      --allow-terms "A,B"                  drop names from the deny-list
      --overlap <0..1>                     trigger-overlap warning threshold (default ${LIMITS.overlap})
      --strict                             warnings fail too
      --json                               machine-readable

Exit 0 when nothing fails, 1 when a rule fails, 2 on a usage error.
Default deny-list: ${DEFAULT_DENY_TERMS.join(', ')}.`;

export function main(argv = process.argv.slice(2)) {
  const VALUED = new Set(['--known', '--deny-terms', '--allow-terms', '--overlap']);
  const value = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1]; };
  const list = (n) => (value(n) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const targets = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  const overlap = value('--overlap');
  if (overlap !== undefined && !(Number(overlap) >= 0 && Number(overlap) <= 1)) { console.error(`lint: --overlap takes a number in 0..1\n\n${USAGE}`); return 2; }
  let result;
  try {
    result = lintSkills(targets.length ? targets : ['skills'], {
      known: list('--known'),
      denyTerms: value('--deny-terms') ? list('--deny-terms') : undefined,
      allowTerms: list('--allow-terms'),
      limits: overlap !== undefined ? { overlap: Number(overlap) } : {},
    });
  } catch (e) {
    console.error(`lint: ${e.message}\n\n${USAGE}`);
    return 2;
  }
  const strict = argv.includes('--strict');
  const failed = result.counts.error > 0 || (strict && result.counts.warning > 0);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return failed ? 1 : 0;
  }
  for (const s of result.skills) {
    console.log(`${s.status} ${path.relative(process.cwd(), s.dir) || s.dir}${s.deprecated ? ' (deprecated)' : ''}`);
    for (const x of s.findings) console.log(`  ${x.severity.padEnd(7)} ${x.rule} ${x.file ?? ''}${x.line ? `:${x.line}` : ''} — ${x.message}`);
  }
  for (const o of result.overlaps) console.log(`  ${o.severity.padEnd(7)} ${o.rule} — ${o.message}`);
  if (!result.skills.length) console.log('no skills found (a skill is a folder holding SKILL.md)');
  const bad = result.skills.filter((s) => s.status === 'FAIL').length;
  console.log(`${failed ? 'FAIL' : 'PASS'} ${result.skills.length - bad}/${result.skills.length} skill(s) pass; ${result.counts.error} error(s), ${result.counts.warning} warning(s)${strict ? ' (strict)' : ''}`);
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
