#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { budgetSet, budgetSetByName, DEFAULT_DENY_TERMS, LIMITS, lintSkills, SETS_FILE } from './lib/lint-skills.mjs';

const HARNESS_SKILLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills');

const USAGE = `Lint skills against the harness authoring rules.

  node tools/lint-skills.mjs [dir]...      skill folders, or folders of skills (default: skills)
      --known a,b                          more skill names a near-miss may route to
      --deny-terms "A,B"                   replace the engine/vendor deny-list
      --allow-terms "A,B"                  drop names from the deny-list
      --overlap <0..1>                     trigger-overlap warning threshold (default ${LIMITS.overlap})
      --budget-set <file|set>              sum the descriptions a machine profile installs (a list of
                                           skill folders, or a toolkit.lock) and warn over ${LIMITS.descriptionBudget}
                                           characters; or a set named in ${SETS_FILE} (the linted folder's,
                                           else ./skills', else the harness's), with what it is loaded
                                           with, an error over the budget less its headroom; with no
                                           folder given, only this check runs
      --external <name>=<dir>              read an external's skills (SETS.yaml external) from a checkout
                                           instead of its measured characters (repeatable)
      --strict                             warnings fail too
      --json                               machine-readable

Exit 0 when nothing fails, 1 when a rule fails, 2 on a usage error.
Default deny-list: ${DEFAULT_DENY_TERMS.join(', ')}.`;

export function main(argv = process.argv.slice(2)) {
  const VALUED = new Set(['--known', '--deny-terms', '--allow-terms', '--overlap', '--budget-set', '--external']);
  const value = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1]; };
  const list = (n) => (value(n) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); return 0; }
  const targets = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
  const overlap = value('--overlap');
  if (overlap !== undefined && !(Number(overlap) >= 0 && Number(overlap) <= 1)) { console.error(`lint: --overlap takes a number in 0..1\n\n${USAGE}`); return 2; }
  const setFile = value('--budget-set');
  const externalDirs = Object.fromEntries(argv.flatMap((a, i) => (argv[i - 1] === '--external' ? [a.split('=')] : [])).map(([k, ...v]) => [k, v.join('=')]));
  // A --budget-set that is no file is a set name: looked up in the linted folder's SETS.yaml, else
  // ./skills/SETS.yaml, else the harness's own.
  const setsFile = setFile !== undefined && !fs.existsSync(setFile)
    ? [...targets.map((t) => path.join(t, SETS_FILE)), path.join('skills', SETS_FILE), path.join(HARNESS_SKILLS, SETS_FILE)].find((f) => fs.existsSync(f))
    : null;
  if (setFile !== undefined && !fs.existsSync(setFile) && !setsFile) { console.error(`lint: --budget-set ${setFile}: no such file, and no ${SETS_FILE} to find a set in\n\n${USAGE}`); return 2; }
  let result;
  try {
    result = lintSkills(targets.length || setFile === undefined ? (targets.length ? targets : ['skills']) : [], {
      known: list('--known'),
      denyTerms: value('--deny-terms') ? list('--deny-terms') : undefined,
      allowTerms: list('--allow-terms'),
      limits: overlap !== undefined ? { overlap: Number(overlap) } : {},
      externalDirs,
    });
  } catch (e) {
    console.error(`lint: ${e.message}\n\n${USAGE}`);
    return 2;
  }
  if (setFile !== undefined) {
    try {
      result.budgetSet = setsFile ? budgetSetByName(setsFile, setFile, { externalDirs }) : budgetSet(setFile);
    } catch (e) {
      console.error(`lint: --budget-set ${setFile}: ${e.message}\n\n${USAGE}`);
      return 2;
    }
    for (const f of result.budgetSet.findings) result.counts[f.severity] += 1;
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
  for (const st of result.sets ?? []) {
    console.log(`sets ${path.relative(process.cwd(), st.file) || st.file}: ${st.sets.map((x) => `${x.name} ${x.total}${x.scope === 'library' ? ' (library)' : `/${x.limit}`}`).join(', ')}`);
    for (const f of st.findings) console.log(`  ${f.severity.padEnd(7)} ${f.rule} — ${f.message}`);
  }
  if (result.budgetSet) {
    const b = result.budgetSet;
    console.log(`budget set ${path.relative(process.cwd(), b.file) || b.file}: ${b.skills.reduce((n, x) => n + (x.count ?? 1), 0)} skill(s), ${b.total} of ${b.limit} characters`);
    for (const f of b.findings) console.log(`  ${f.severity.padEnd(7)} ${f.rule} — ${f.message}`);
  } else if (!result.skills.length) console.log('no skills found (a skill is a folder holding SKILL.md)');
  const bad = result.skills.filter((s) => s.status === 'FAIL').length;
  const scope = result.skills.length || !result.budgetSet ? `${result.skills.length - bad}/${result.skills.length} skill(s) pass` : 'budget set';
  console.log(`${failed ? 'FAIL' : 'PASS'} ${scope}; ${result.counts.error} error(s), ${result.counts.warning} warning(s)${strict ? ' (strict)' : ''}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
