import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isGerundName, jaccard, lintSkills, markdownLinks, parseScenarios, triggerTokens } from '../tools/lib/lint-skills.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'fixtures/lint');
const GOOD = path.join(FIX, 'good/skills');
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'harness-lint-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

// A broken case is an overlay on the good set: fixtures/lint/broken/<rule>/<skill>/<file> replaces
// that file of a copy of the good skills (a new skill folder starts as a copy of drafting-widgets);
// a file named <x>.delete removes <x>. Each case is named for the one rule it breaks.
function overlay(rule) {
  const dir = path.join(TMP, rule);
  fs.cpSync(GOOD, dir, { recursive: true });
  const src = path.join(FIX, 'broken', rule);
  for (const top of fs.readdirSync(src)) {
    if (!fs.existsSync(path.join(dir, top))) fs.cpSync(path.join(GOOD, 'drafting-widgets'), path.join(dir, top), { recursive: true });
  }
  for (const f of walk(src)) {
    const rel = path.relative(src, f);
    if (rel.endsWith('.delete')) fs.rmSync(path.join(dir, rel.replace(/\.delete$/, '')));
    else fs.copyFileSync(f, path.join(dir, rel));
  }
  return dir;
}

const rules = (r, severity) => new Set([...r.skills.flatMap((s) => s.findings), ...r.overlaps].filter((x) => x.severity === severity).map((x) => x.rule));

describe('lint-skills', () => {
  it('passes the good set with no error and no warning, including a deprecated skill and engine notes', () => {
    const r = lintSkills([GOOD]);
    assert.equal(r.counts.skills, 4);
    assert.deepEqual(r.counts, { skills: 4, error: 0, warning: 0 }, JSON.stringify(r.skills.flatMap((s) => s.findings), null, 2));
    assert.ok(r.skills.find((s) => s.name === 'sorting-widgets').deprecated);
  });

  const cases = fs.readdirSync(path.join(FIX, 'broken')).sort();
  it('has a broken case per authoring rule', () => {
    for (const rule of ['agentskills-core-fields-only', 'name-matches-path', 'name-is-gerund', 'description-use-when', 'description-do-not-use-for', 'body-length', 'engine-neutral', 'links-stay-in-skill', 'evals-present', 'routing-counts', 'route-to-known', 'near-miss-names-route', 'scenarios-count', 'scenario-format', 'evidence-count', 'outside-evidence-cites-url', 'deprecated-never-triggers', 'description-overlap']) {
      assert.ok(cases.includes(rule), `no fixtures/lint/broken/${rule}`);
    }
  });

  for (const rule of cases) {
    it(`broken: ${rule}`, () => {
      const r = lintSkills([overlay(rule)]);
      if (rule === 'description-overlap') {
        const o = r.overlaps.find((x) => [x.a, x.b].sort().join() === 'drafting-widgets,sketching-widgets');
        assert.ok(o, `no overlap named; got ${JSON.stringify(r.overlaps)}`);
        assert.ok(o.score > 0.3 && o.shared.includes('widget'), JSON.stringify(o));
        assert.equal(r.counts.error, 0, 'overlap is a warning, not an error');
        return;
      }
      assert.ok(rules(r, 'error').has(rule), `expected error ${rule}, got errors ${[...rules(r, 'error')]} warnings ${[...rules(r, 'warning')]}`);
    });
  }

  it('lets engine names live in references/engine-notes.md only', () => {
    const r = lintSkills([path.join(GOOD, 'drafting-widgets')]);
    assert.equal(r.counts.error, 0);
    assert.match(fs.readFileSync(path.join(GOOD, 'drafting-widgets/references/engine-notes.md'), 'utf8'), /Claude Code/);
  });

  it('takes a configurable deny-list', () => {
    const r = lintSkills([GOOD], { denyTerms: ['widget'] });
    assert.ok(rules(r, 'error').has('engine-neutral'));
    const ok = lintSkills([overlay('engine-neutral')], { allowTerms: ['Claude Code', 'Claude'] });
    assert.ok(!rules(ok, 'error').has('engine-neutral'));
  });

  it('warns between 200 and 300 body lines and fails above', () => {
    const dir = overlay('body-length');
    const skill = path.join(dir, 'drafting-widgets/SKILL.md');
    const text = fs.readFileSync(skill, 'utf8').split('\n');
    fs.writeFileSync(skill, text.slice(0, text.length - 120).join('\n'));
    const r = lintSkills([dir]);
    assert.ok(!rules(r, 'error').has('body-length'));
    assert.ok(rules(r, 'warning').has('body-length'));
  });

  it('accepts a near-miss routed to a pinned external skill or to --known', () => {
    assert.ok(fs.readFileSync(path.join(GOOD, 'drafting-widgets/evals/routing.jsonl'), 'utf8').includes('"route_to":"reviewing-code"'));
    const r = lintSkills([overlay('route-to-known')], { known: ['releasing-gizmos'] });
    assert.ok(!rules(r, 'error').has('route-to-known'));
  });

  it('helpers: gerund names, trigger tokens, Jaccard, links, scenarios', () => {
    assert.ok(isGerundName('writing-requirements'));
    assert.ok(isGerundName('debugging-failures'));
    assert.ok(!isGerundName('requirements-writer'));
    assert.ok(!isGerundName('ring-buffer'));
    const a = triggerTokens('Use when drafting a widget spec. Do not use for checking widgets (checking-widgets).');
    assert.ok(a.has('widget') && a.has('draft') && !a.has('check'), [...a].join());
    assert.equal(jaccard(new Set(['a', 'b']), new Set(['b', 'c'])), 1 / 3);
    assert.deepEqual(markdownLinks('see [x](../a.md) and `[y](../b.md)`\n```\n[z](../c.md)\n```\n[ref]: ../d.md').map((l) => l.target), ['../a.md', '../d.md']);
    assert.equal(parseScenarios('# S\n\n## One\n- **Setup:** x\n\n## Two\nSetup: y\n').length, 2);
  });
});

describe('lint-skills CLI', () => {
  const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/lint-skills.mjs'), ...a], { encoding: 'utf8', cwd: ROOT });

  it('exits 0 on the good set and 1 on a broken one, naming the rule and the file line', () => {
    const ok = cli('fixtures/lint/good/skills');
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /^PASS 4\/4 skill\(s\) pass/m);
    const bad = cli(overlay('engine-neutral'));
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /error {3}engine-neutral SKILL\.md:\d+ — body names "Claude Code"/);
  });

  it('--strict fails on a warning; --json is machine-readable; a bad flag is a usage error', () => {
    const dir = overlay('description-overlap');
    assert.equal(cli(dir).status, 0);
    assert.equal(cli(dir, '--strict').status, 1);
    const j = JSON.parse(cli(dir, '--json').stdout);
    assert.equal(j.overlaps[0].rule, 'description-overlap');
    assert.equal(cli(dir, '--overlap', 'lots').status, 2);
  });
});
