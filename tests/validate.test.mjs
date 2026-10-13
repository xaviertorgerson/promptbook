import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { walk } from '../tools/lib/glob.mjs';
import { registry } from '../tools/lib/registry.mjs';
import { trace } from '../tools/lib/trace.mjs';
import { fixtureCase, validateFile } from '../tools/lib/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'fixtures');
const reg = registry();

// The template's real work queue, when this checkout sits beside it. Optional: CI elsewhere skips.
const STACK_DRIFT = process.env.HARNESS_SMOKE_PROJECT ?? '/home/claude/wt-stack-drift';
const TEMPLATE = process.env.HARNESS_TEMPLATE ?? '/home/claude/agentic-template';

const errorsOf = (r) => r.results.flatMap((x) => x.findings.filter((f) => f.severity === 'error'));
const cases = (kind, contract) => {
  const dir = path.join(FIX, kind, contract);
  return fs.existsSync(dir) ? walk(dir) : [];
};

describe('schemas', () => {
  it('every schema compiles in strict mode and carries $id and x-version', () => {
    for (const [name, schema] of reg.schemas) {
      assert.equal(schema.$id, `https://harness.dev/schemas/${name}.schema.json`);
      assert.match(schema['x-version'], /^\d+\.\d+\.\d+$/, name);
      if (name !== 'common') assert.doesNotThrow(() => reg.validator(name), name);
    }
  });

  it('every contract declares where its artifact lives', () => {
    for (const name of reg.contracts()) assert.ok(reg.artifacts(name).length, `${name} has no x-artifacts`);
  });
});

describe('fixtures', () => {
  for (const contract of reg.contracts()) {
    describe(contract, () => {
      const valid = cases('valid', contract);
      const invalid = cases('invalid', contract);

      it('has at least one valid and two invalid cases', () => {
        assert.ok(valid.length >= 1, `${contract}: no valid fixture`);
        assert.ok(new Set(invalid.map(fixtureCase)).size >= 2, `${contract}: fewer than two invalid fixtures`);
      });

      for (const file of valid) {
        it(`valid: ${path.relative(FIX, file)}`, () => {
          const r = validateFile(file);
          assert.equal(r.status, 'PASS', JSON.stringify(errorsOf(r), null, 2));
          assert.ok(r.results.some((x) => x.contract === contract), `validated as ${r.results.map((x) => x.contract)}`);
        });
      }

      for (const file of invalid) {
        const rule = fixtureCase(file);
        it(`invalid: ${path.relative(FIX, file)} breaks ${rule}`, () => {
          const r = validateFile(file);
          assert.equal(r.status, 'FAIL', `${file} passed`);
          const rules = errorsOf(r).map((f) => f.rule);
          assert.ok(rules.includes(rule), `expected rule ${rule}, got ${rules.join(', ')}`);
        });
      }
    });
  }
});

describe('task schema compatibility', () => {
  const real = (root) => (fs.existsSync(path.join(root, 'specs')) ? walk(path.join(root, 'specs')).filter((f) => /\/tasks\/[^_][^/]*\.md$/.test(f)) : []);

  it('the copied real task files are byte-identical to their sources', { skip: !fs.existsSync(TEMPLATE) }, () => {
    const pairs = [
      ['fixtures/valid/task/real-bill-2-human-review.md', path.join(TEMPLATE, 'specs/rating-engine/tasks/BILL-2.md')],
      ['fixtures/valid/task/real-bill-4-needs-input.md', path.join(TEMPLATE, 'specs/rating-engine/tasks/BILL-4.md')],
    ];
    if (fs.existsSync(STACK_DRIFT)) pairs.push(['fixtures/valid/task/real-tmig-1-spec-draft.md', path.join(STACK_DRIFT, 'specs/template-migration/tasks/TMIG-1.md')]);
    for (const [copy, src] of pairs) assert.equal(fs.readFileSync(path.join(ROOT, copy), 'utf8'), fs.readFileSync(src, 'utf8'), copy);
  });

  for (const root of [TEMPLATE, STACK_DRIFT]) {
    it(`every task file under ${root}/specs validates unchanged`, { skip: !fs.existsSync(root) }, () => {
      const files = real(root);
      assert.ok(files.length > 0);
      for (const f of files) {
        const r = validateFile(f);
        assert.equal(r.status, 'PASS', `${f}: ${JSON.stringify(errorsOf(r))}`);
      }
    });

    it(`every spec.md, cuj.md and DECISIONS.md under ${root} validates unchanged`, { skip: !fs.existsSync(root) }, () => {
      const files = walk(path.join(root, 'specs')).filter((f) => /\/specs\/[^_/][^/]*\/(spec|cuj)\.md$/.test(f));
      files.push(path.join(root, 'DECISIONS.md'));
      for (const f of files) {
        const r = validateFile(f);
        assert.equal(r.status, 'PASS', `${f}: ${JSON.stringify(errorsOf(r))}`);
      }
    });
  }
});

describe('state machines', () => {
  const load = (n) => parse(fs.readFileSync(path.join(ROOT, 'state-machines', `${n}.yaml`), 'utf8'));
  const enumOf = (def) => reg.schema('common').$defs[def].enum;

  it('workflow task and epic states are exactly the schema enums', () => {
    const w = load('workflow');
    assert.deepEqual(Object.keys(w.machines.task.states).sort(), [...enumOf('taskStatus')].sort());
    assert.deepEqual(Object.keys(w.machines.epic.states).sort(), [...enumOf('epicStatus')].sort());
  });

  it('every transition names known states, roles, guards, gates and grantable actions', () => {
    const w = load('workflow');
    const a = load('authority');
    const roles = new Set(Object.keys(w.roles));
    for (const [mname, m] of Object.entries(w.machines)) {
      const states = new Set(Object.keys(m.states));
      for (const t of m.transitions) {
        for (const s of [].concat(t.from, t.to)) if (s !== '$prior') assert.ok(states.has(s), `${mname}.${t.id}: unknown state ${s}`);
        for (const r of t.by) assert.ok(roles.has(r), `${mname}.${t.id}: unknown role ${r}`);
        for (const g of [...(t.guards ?? []), ...(t.grant_guards ?? [])]) assert.ok(w.guards[g], `${mname}.${t.id}: unknown guard ${g}`);
        if (t.gate) assert.equal(w.gates[t.gate].transition, t.id, `${mname}.${t.id}: gate ${t.gate} points elsewhere`);
        if (t.grant) assert.ok(a.grantable[t.grant], `${mname}.${t.id}: ${t.grant} is not grantable`);
        if (t.kickback) assert.equal(t.reason, true, `${mname}.${t.id}: a kick-back needs a reason`);
      }
    }
  });

  it('the three human gates exist and only pr-approval is grantable, and only as merge', () => {
    const w = load('workflow');
    assert.deepEqual(Object.keys(w.gates).sort(), ['pr-approval', 'production-release', 'spec-approval']);
    assert.equal(w.gates['spec-approval'].grantable, false);
    assert.equal(w.gates['production-release'].grantable, false);
    assert.equal(w.gates['pr-approval'].grantable, 'merge');
  });

  it('grantable actions are exactly the grant schema actions; merge always requires review and checks', () => {
    const a = load('authority');
    const g = reg.schema('grant');
    const schemaActions = [...g.$defs.simpleAction.enum, 'merge'].sort();
    assert.deepEqual(Object.keys(a.grantable).sort(), schemaActions);
    assert.deepEqual(a.grantable.merge.always_requires.sort(), ['independent-review', 'required-checks']);
    for (const id of ['spec-approval', 'production-release', 'answer-permission-prompt']) assert.ok(a.never_grantable.some((n) => n.id === id), id);
  });

  it('attention states are the schema enum and no signal maps to a workflow status', () => {
    const at = load('attention');
    const attention = enumOf('attention');
    assert.deepEqual(Object.keys(at.states).sort(), [...attention].sort());
    assert.ok(at.rules.some((r) => r.id === 'signals-never-advance-workflow'));
    const statuses = new Set([...enumOf('taskStatus'), ...enumOf('epicStatus')]);
    for (const [src, s] of Object.entries(at.sources)) {
      const maps = [s.signals, s.status, s.conclusion, s.derived].filter(Boolean);
      for (const table of maps) {
        for (const [signal, m] of Object.entries(table)) {
          assert.ok(m.attention === null || attention.includes(m.attention), `${src}.${signal}: ${m.attention}`);
          assert.ok(['ignore', 'inspect', 'record'].includes(m.reconcile), `${src}.${signal}: reconcile ${m.reconcile}`);
          assert.ok(!statuses.has(m.attention), `${src}.${signal} maps to a workflow status`);
          assert.equal(m.status, undefined, `${src}.${signal} sets a status`);
        }
      }
    }
  });

  it('attention covers the Herdr, A2A and MCP Tasks vocabularies', () => {
    const s = load('attention').sources;
    assert.deepEqual(Object.keys(s.herdr.signals).sort(), ['blocked', 'done', 'idle', 'unknown', 'working']);
    assert.equal(s.herdr.event, 'pane.agent_status_changed');
    for (const st of ['TASK_STATE_WORKING', 'TASK_STATE_INPUT_REQUIRED', 'TASK_STATE_AUTH_REQUIRED', 'TASK_STATE_COMPLETED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED', 'TASK_STATE_REJECTED']) assert.ok(s.a2a.signals[st], st);
    assert.deepEqual(Object.keys(s['mcp-tasks'].signals).sort(), ['cancelled', 'completed', 'failed', 'input_required', 'working']);
  });
});

describe('trace graph', () => {
  it('a complete project is ready with no gap', () => {
    const r = trace(path.join(FIX, 'trace/complete'));
    assert.equal(r.adoption, 'full');
    assert.deepEqual(r.counts, { error: 0, warning: 0, info: 0 });
    assert.equal(r.epics[0].verdict, 'ready');
    assert.deepEqual(r.epics[0].coverage.criteria, { covered: 2, total: 2 });
  });

  it('a broken project reports each broken link by rule', () => {
    const r = trace(path.join(FIX, 'trace/broken'));
    const rules = new Set(r.gaps.filter((g) => g.severity === 'error').map((g) => g.rule));
    for (const rule of ['decision-exists', 'requirement-exists', 'guiding-doc-exists', 'criterion-named-in-test', 'task-cites-requirement', 'dependencies-acyclic', 'journey-exists', 'persona-exists', 'user-facing-journey-has-ux', 'journey-has-task', 'journey-has-requirement', 'journey-cites-persona', 'requirement-has-task']) {
      assert.ok(rules.has(rule), `missing ${rule}; got ${[...rules].join(', ')}`);
    }
    assert.equal(r.epics[0].verdict, 'not-ready');
  });

  it('smoke: wt-stack-drift (specs, no product docs) reports gaps as legacy warnings and does not crash', { skip: !fs.existsSync(STACK_DRIFT) }, () => {
    const r = trace(STACK_DRIFT);
    assert.equal(r.adoption, 'legacy');
    assert.equal(r.counts.error, 0, JSON.stringify(r.gaps.filter((g) => g.severity === 'error'), null, 2));
    assert.ok(r.gaps.some((g) => g.rule === 'brief-exists' && g.severity === 'warning'));
    assert.ok(r.gaps.some((g) => g.rule === 'rules-skipped' && g.severity === 'info'));
    const tm = r.epics.find((e) => e.epic === 'template-migration');
    assert.ok(tm, 'template-migration epic found');
    assert.equal(tm.verdict, 'not-ready');
    assert.equal(tm.coverage.journeys.total, 4);
    assert.equal(tm.coverage.requirements.total, 8);
    assert.equal(tm.coverage.tasks.total, 6);
    assert.ok(tm.gaps.some((g) => g.rule === 'task-cites-requirement'));
    assert.ok(tm.gaps.some((g) => g.rule === 'journey-has-task' && g.subject === 'CUJ-2'), 'CUJ-2 is attributed only in the spec index');
  });

  it('the CLI exits 0 on the smoke project and 1 on the broken one', { skip: !fs.existsSync(STACK_DRIFT) }, () => {
    const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/validate.mjs'), ...a], { encoding: 'utf8' });
    const ok = cli('--trace', STACK_DRIFT);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /legacy adoption/);
    const bad = cli('--trace', path.join(FIX, 'trace/broken'));
    assert.equal(bad.status, 1);
    const strict = cli('--trace', STACK_DRIFT, '--strict');
    assert.equal(strict.status, 1, 'warnings fail under --strict');
  });
});

describe('CLI', () => {
  const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/validate.mjs'), ...a], { encoding: 'utf8', cwd: ROOT });

  it('prints PASS/FAIL per file with a JSON pointer, a line and the rule, and exits non-zero on failure', () => {
    const r = cli('fixtures/invalid/task/claimed-task-has-owner.md');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^FAIL fixtures\/invalid\/task\/claimed-task-has-owner\.md \[task@1\.0\.0\]/m);
    assert.match(r.stdout, /^ {2}\/owner claimed-task-has-owner:11: /m);
  });

  it('exits 0 when every file passes, and 2 on a usage error', () => {
    assert.equal(cli('fixtures/valid').status, 0);
    assert.equal(cli('--contract', 'nope', 'fixtures/valid/task').status, 2);
    assert.equal(cli('README.md').status, 2);
  });

  it('--contract validates a file whose path implies no contract', () => {
    const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'harness-'));
    const f = path.join(tmp, 'anything.yaml');
    fs.copyFileSync(path.join(FIX, 'valid/grant/project-delegation.yaml'), f);
    try {
      const r = cli('--contract', 'grant', f);
      assert.equal(r.status, 0, r.stdout);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
