import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { walk } from '../tools/lib/glob.mjs';
import { PARSERS } from '../tools/lib/parsers.mjs';
import { registry } from '../tools/lib/registry.mjs';
import { namedIn, testNames } from '../tools/lib/ears.mjs';
import { trace } from '../tools/lib/trace.mjs';
import { fixtureCase, inferContracts, validateFile, validatePath } from '../tools/lib/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'fixtures');
const reg = registry();

// The template's real work queue, when this checkout sits beside it. Optional: CI elsewhere skips.
const STACK_DRIFT = process.env.PROMPTBOOK_SMOKE_PROJECT ?? '/home/claude/wt-stack-drift';
const TEMPLATE = process.env.PROMPTBOOK_TEMPLATE ?? '/home/claude/agentic-template';
const STAGEHAND = process.env.PROMPTBOOK_STAGEHAND ?? '/home/claude/stagehand';

// A copy of a trace fixture project in a temp dir, with files replaced or edited: { 'rel/path': text | (old) => text }.
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'promptbook-validate-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let copies = 0;
function project(base, edits = {}) {
  const dir = path.join(TMP, `p${(copies += 1)}`);
  fs.cpSync(path.join(FIX, 'trace', base), dir, { recursive: true });
  for (const [rel, edit] of Object.entries(edits)) {
    const f = path.join(dir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, typeof edit === 'function' ? edit(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '') : edit);
  }
  return dir;
}
const taskText = (id, fm = {}, body = {}) => {
  const front = { id, epic: 'invoicing', status: 'ready', priority: 'P2', size: 'S', cuj: 'CUJ-1', guiding_docs: ['specs/invoicing/spec.md'], branch: `feat/${id.toLowerCase()}`, depends_on: [], owner: null, requirements: ['REQ-1'], ...fm };
  const yaml = Object.entries(front).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  return `---\n${yaml}\n---\n\n# ${id} · ${body.title ?? 'a task'}\n\n## Context\n${body.context ?? 'x'}\n\n## Acceptance criteria (EARS)\n${body.criteria ?? '- AC-1 — When an owner lists invoices, the API shall return them newest first.'}\n\n## Open questions\n${body.questions ?? ''}\n\n## Agent log (append-only, newest last)\n`;
};

const errorsOf = (r) => r.results.flatMap((x) => x.findings.filter((f) => f.severity === 'error'));
const cases = (kind, contract) => {
  const dir = path.join(FIX, kind, contract);
  return fs.existsSync(dir) ? walk(dir) : [];
};

describe('schemas', () => {
  it('every schema compiles in strict mode and carries $id and x-version', () => {
    for (const [name, schema] of reg.schemas) {
      assert.equal(schema.$id, `https://promptbook.dev/schemas/${name}.schema.json`);
      assert.match(schema['x-version'], /^\d+\.\d+\.\d+$/, name);
      if (name !== 'common') assert.doesNotThrow(() => reg.validator(name), name);
    }
  });

  it('CONTRACTS.md states each schema at its current x-version', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'CONTRACTS.md'), 'utf8');
    const stated = [...doc.matchAll(/`(?:schemas\/)?([a-z-]+)\.schema\.json`\s+(\d+\.\d+\.\d+)/g)];
    assert.ok(stated.length >= reg.contracts().length, `${stated.length} versions stated`);
    for (const [, name, v] of stated) assert.equal(v, reg.version(name), `CONTRACTS.md says ${name} ${v}`);
    for (const name of reg.contracts()) assert.ok(stated.some(([, n]) => n === name), `CONTRACTS.md never states ${name}'s version`);
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

describe('test names across languages', () => {
  const dir = path.join(FIX, 'test-names');
  for (const f of fs.readdirSync(dir).filter((x) => !x.endsWith('.feature'))) {
    it(`${f}: every criterion of BILL-6 is named, qualified by the task id`, () => {
      const names = testNames(fs.readFileSync(path.join(dir, f), 'utf8'), { file: f });
      for (const ac of ['AC-1', 'AC-2', 'AC-3']) {
        assert.ok(names.some((n) => namedIn([n], 'BILL-6') && namedIn([n], ac)), `${ac} in ${JSON.stringify(names)}`);
      }
      assert.ok(!namedIn(names, 'AC-4') && !namedIn(names, 'BILL-60'), 'no other id');
    });
  }

  it('--test-pattern names tests in a format no extractor knows (a Gherkin scenario)', () => {
    const text = fs.readFileSync(path.join(dir, 'rating.feature'), 'utf8');
    assert.ok(!namedIn(testNames(text, { file: 'rating.feature' }), 'AC-1'));
    const names = testNames(text, { file: 'rating.feature', patterns: ['^\\s*Scenario:\\s*(.+)$'] });
    for (const ac of ['AC-1', 'AC-2', 'AC-3']) assert.ok(namedIn(names, ac), ac);
  });

  it('a commented-out, skipped or todo test, a Rust helper fn and a stray id= evidence nothing', () => {
    const cases = {
      'a.test.ts': [
        "it('X-1 AC-1 runs', () => {});",
        "// it('X-1 AC-2 commented out', () => {});",
        "/* test('X-1 AC-3 in a block comment', () => {}); */",
        "it.skip('X-1 AC-4 skipped', () => {});",
        "test.todo('X-1 AC-5 todo');",
        "xit('X-1 AC-6 x-prefixed', () => {});",
        "describe.skip('suite', () => { it('X-1 AC-7 inside a skipped describe', () => {}); });",
        "xdescribe('X-1 AC-8 x-described', () => {});",
        "it('X-1 AC-9 with skip option', { skip: true }, () => {});",
        "it.skip.each([[1]])('X-1 AC-10 skipped each %s', () => {});",
        "it('X-1 AC-11 says // in a string', () => {});",
        "it('X-1 AC-12 skip: false runs', { skip: false }, () => {});",
      ].join('\n'),
      'test_a.py': [
        'def test_x_1_ac_1_runs():',
        '    pass',
        '# def test_x_1_ac_2_commented():',
        'call(id="X-1 AC-3 a stray id kwarg")',
        'pytest.param(1, id="X-1 AC-11 a real param id")',
      ].join('\n'),
      'a.rs': [
        '#[test]',
        'fn x_1_ac_1_runs() {}',
        'fn x_1_ac_2_helper_fn() {}',
        '#[test]',
        '#[ignore]',
        'fn x_1_ac_3_ignored() {}',
        '// #[test] fn x_1_ac_4_commented() {}',
        "#[tokio::test]\nasync fn x_1_ac_11_async() { let c = '\"'; }",
      ].join('\n'),
      'a_test.go': 'func TestX1AC1Runs(t *testing.T) {}\n// func TestX1AC2Commented(t *testing.T) {}\n/* t.Run("X-1 AC-3 block", nil) */',
      'a_spec.rb': 'it "X-1 AC-1 runs" do\nend\n# it "X-1 AC-2 commented" do\nxit "X-1 AC-3 pending" do\nend\n=begin\nit "X-1 AC-4 in a block comment" do\n=end',
    };
    for (const [file, text] of Object.entries(cases)) {
      const names = testNames(text, { file });
      assert.ok(namedIn(names, 'AC-1'), `${file}: AC-1 counts (${JSON.stringify(names)})`);
      for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10]) assert.ok(!namedIn(names, `AC-${n}`), `${file}: AC-${n} does not count (${JSON.stringify(names)})`);
    }
    assert.ok(namedIn(testNames(cases['a.test.ts'], { file: 'a.test.ts' }), 'AC-11') && namedIn(testNames(cases['a.test.ts'], { file: 'a.test.ts' }), 'AC-12'));
    assert.ok(namedIn(testNames(cases['test_a.py'], { file: 'test_a.py' }), 'AC-11'));
    assert.ok(namedIn(testNames(cases['a.rs'], { file: 'a.rs' }), 'AC-11'));
  });

  it('an id matches in its written forms, never inside a longer one', () => {
    for (const n of ['AC-2 rounds', 'test_ac_2_rounds', 'ac2', 'TestBILL7AC2Rounds', 'it AC_2']) assert.ok(namedIn([n], 'AC-2'), n);
    for (const n of ['AC-21', 'FAC2', 'mac2', 'BAC-2', 'ac-2-1'.replace('-1', '1')]) assert.ok(!namedIn([n], 'AC-2'), n);
  });

  it('the trace reads a Python project\'s tests by default and --test-pattern from the CLI', () => {
    const dir2 = project('complete', {
      'tests/invoicing.test.ts': '',
      'tests/test_invoicing.py': 'def test_inv_1_ac_1_returns_the_pdf():\n    pass\n\ndef test_inv_1_ac_2_returns_404_for_another_tenant():\n    pass\n',
    });
    const r = trace(dir2);
    assert.deepEqual(r.epics[0].coverage.criteria, { covered: 2, total: 2 });
    assert.equal(r.counts.error, 0, JSON.stringify(r.gaps));
    const dir3 = project('complete', { 'tests/invoicing.test.ts': '', 'tests/invoicing.feature': 'Scenario: INV-1 AC-1 returns the PDF\nScenario: INV-1 AC-2 returns 404\n' });
    const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/validate.mjs'), ...a], { encoding: 'utf8' });
    assert.equal(cli('--trace', dir3, '--tests', 'tests/*.feature').status, 1, 'no extractor reads .feature');
    const ok = cli('--trace', dir3, '--tests', 'tests/*.feature', '--test-pattern', '^Scenario: (.+)$');
    assert.equal(ok.status, 0, ok.stdout);
    assert.equal(cli('--trace', dir3, '--test-pattern', '(').status, 2, 'a bad regex is a usage error');
  });
});

describe('requirement categories', () => {
  it('the playbook names exactly the NFR categories the requirement contract accepts', () => {
    const page = fs.readFileSync(path.join(ROOT, 'playbook/planning/journeys-and-requirements.md'), 'utf8').replace(/\s+/g, ' ');
    const listed = page.match(/names a category and a measurable threshold: ([a-z, ]+)\./)[1].split(/,\s*/);
    assert.deepEqual([...listed].sort(), [...reg.schema('requirement').properties.category.enum].sort());
  });
});

describe('toolkit-lock', () => {
  const lock = parse(fs.readFileSync(path.join(FIX, 'valid/toolkit-lock/skill-libraries/toolkit.lock'), 'utf8'));
  const v = (data) => { const fn = reg.validator('toolkit-lock'); return fn(data) ? [] : fn.errors; };
  it('exactly one promptbook: skill libraries are L3 too, but never promptbook', () => {
    assert.deepEqual(v(lock), []);
    assert.ok(v({ ...lock, entries: lock.entries.filter((e) => e.kind !== 'promptbook') }).length, 'skill libraries alone are no promptbook');
    const noKind = { ...lock, entries: lock.entries.map((e) => (e.kind === 'promptbook' ? { ...e, kind: undefined } : e)).map((e) => JSON.parse(JSON.stringify(e))) };
    assert.deepEqual(v(noKind), [], 'an L3 entry with no kind is promptbook');
  });
  it('a kind on the wrong layer is a warning, not an error', () => {
    const file = path.join(TMP, 'kinds', 'toolkit.lock');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const odd = { ...lock, entries: lock.entries.map((e) => (e.name === 'cli-runtime' ? { ...e, kind: 'skill-library' } : e)) };
    fs.writeFileSync(file, JSON.stringify(odd));
    const r = validateFile(file);
    assert.equal(r.status, 'PASS');
    assert.deepEqual(r.results[0].findings.map((f) => [f.severity, f.rule]), [['warning', 'kind-matches-layer']]);
  });
});

describe('contract by filename suffix (examples outside the project layout)', () => {
  const V = (rel) => path.join(FIX, 'valid', rel);
  const examples = {
    'GRANT-8-integration.grant.yaml': ['grant', V('grant/project-delegation.yaml')],
    'author-done.return.json': ['return', V('return/coder-complete.json')],
    'BILL-7-claimed.task-record.yaml': ['task-record', V('task-record/worktree-resources.yaml')],
    'loop.run-record.jsonl': ['run-record', V('run-record/loop-mjs-outcomes.jsonl')],
    'devbox.policy.yaml': ['policy', V('policy/bypass-container.yaml')],
    'project.toolkit.lock': ['toolkit-lock', V('toolkit-lock/skill-libraries/toolkit.lock')],
    'at-review.task.md': ['task', V('task/promptbook-fields.md')],
    'acme.brief.md': ['brief', V('brief/full/docs/product/brief.md')],
    'owen.persona.md': ['persona', V('persona/file/docs/product/personas/per-3.md')],
    'team.persona.md': ['persona', V('persona/list/docs/product/personas.md')],
    'money.adr.md': ['decision', V('decision/context-form.md')],
    'invoicing.ux.md': ['ux-flow', V('ux-flow/invoicing/docs/ux/invoicing.md')],
    'rating-engine.spec.md': ['epic,requirement', V('epic/real-template-migration.md')],
    'rating-engine.cuj.md': ['journey', V('journey/real-rating-engine/specs/rating-engine/cuj.md')],
    'template-migration.readiness.md': ['readiness-report', V('readiness-report/generated-legacy/specs/template-migration/readiness.md')],
    '2026-10-13-model-5-5.setup-review.md': ['setup-review', V('setup-review/model-release.md')],
    'one-window.reflection.md': ['reflection-report', V('reflection-report/one-window.md')],
  };
  const dir = path.join(TMP, 'skill-examples/references/examples');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, [, src]] of Object.entries(examples)) fs.copyFileSync(src, path.join(dir, name));
  fs.writeFileSync(path.join(dir, 'adr.template.md'), '## ADR-NNNN: <title>\n**Status:** <Proposed>\n');
  fs.writeFileSync(path.join(dir, 'broken.grant.yaml'), 'id: GRANT-9\ngranted_by: maria\n');

  for (const [name, [contracts]] of Object.entries(examples)) {
    it(`${name} validates as ${contracts}`, () => {
      const r = validateFile(path.join(dir, name));
      assert.deepEqual(r.results.map((x) => x.contract).sort().join(), contracts);
      assert.equal(r.status, 'PASS', JSON.stringify(errorsOf(r)));
    });
  }

  it('an entry file takes its epic from the name before the suffix (journeys require one)', () => {
    const [hit] = inferContracts(path.join(dir, 'rating-engine.cuj.md'));
    assert.deepEqual([hit.contract, hit.captures], ['journey', ['rating-engine']]);
    const epics = PARSERS.journeys(fs.readFileSync(path.join(dir, 'rating-engine.cuj.md'), 'utf8'), { epic: hit.captures[0] }).records.map((r) => r.data.epic);
    assert.ok(epics.length && epics.every((e) => e === 'rating-engine'));
  });

  it('a broken example fails; a .template. file and a plain file are skipped; a directory walk finds them all', () => {
    assert.equal(validateFile(path.join(dir, 'broken.grant.yaml')).status, 'FAIL');
    assert.equal(validateFile(path.join(dir, 'adr.template.md')).status, 'SKIP');
    const walked = validatePath(path.dirname(dir));
    assert.equal(walked.length, Object.keys(examples).length + 1);
    assert.ok(!walked.some((r) => r.file.endsWith('adr.template.md')));
    assert.equal(validateFile(path.join(dir, 'adr.template.md'), { contract: 'decision' }).status, 'FAIL', '--contract still validates a template');
  });
});

describe('a project\'s _-prefixed templates (agentic-template\'s docs/ux/_UX-TEMPLATE.md)', () => {
  const dir = path.join(TMP, 'templates');
  const ux = '---\nepic: my-epic\n---\n\n# UX — <epic name>\n\n## UX-1 · <the journey>\n- **CUJs:** CUJ-1\n- **Steps:**\n  1. **<Screen>** → <action>\n';
  const files = {
    'docs/ux/_UX-TEMPLATE.md': ux,
    'docs/product/_BRIEF-TEMPLATE.md': '---\nid: BRIEF\nproduct: <name>\n---\n',
    'specs/invoicing/tasks/_TASK-TEMPLATE.md': '---\nid: <PREFIX>-<n>\nepic: <epic>\n---\n',
    'specs/_drafts/spec.md': '---\nepic: _drafts\nstatus: intake\n---\n',
    '.orchestrator/grants/_GRANT-TEMPLATE.yaml': 'id: GRANT-<n>\n',
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }

  it('gets no contract from its path, so a directory walk skips it', () => {
    for (const rel of Object.keys(files)) assert.equal(validateFile(path.join(dir, rel)).status, 'SKIP', rel);
    assert.deepEqual(validatePath(dir), []);
  });

  it('--contract still validates it', () => {
    const r = validateFile(path.join(dir, 'docs/ux/_UX-TEMPLATE.md'), { contract: 'ux-flow' });
    assert.equal(r.status, 'FAIL', 'its placeholders are not a flow');
    assert.equal(validateFile(path.join(dir, '.orchestrator/grants/_GRANT-TEMPLATE.yaml'), { contract: 'grant' }).status, 'FAIL');
  });

  it('--contract binds nothing from a _-prefixed name, so a valid template is not failed for its file name', () => {
    const flow = fs.readFileSync(path.join(FIX, 'valid/ux-flow/invoicing/docs/ux/invoicing.md'), 'utf8');
    const rel = 'docs/ux/_VALID-TEMPLATE.md';
    fs.writeFileSync(path.join(dir, rel), flow);
    const r = validateFile(path.join(dir, rel), { contract: 'ux-flow' });
    assert.equal(r.status, 'PASS', JSON.stringify(r.results));
  });
});

describe('a project\'s own skills: evals under a dot-folder', () => {
  const dir = path.join(TMP, 'project-skills');
  const evidence = fs.readFileSync(path.join(FIX, 'valid/evidence/entries/skills/writing-requirements/evals/evidence.md'), 'utf8');
  const routing = fs.readFileSync(path.join(FIX, 'valid/evidence/routing/skills/writing-requirements/evals/routing.jsonl'), 'utf8');
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  for (const base of ['.agents/skills/drafting-notes', '.claude/skills/drafting-notes']) {
    write(`${base}/evals/evidence.md`, evidence);
    write(`${base}/evals/routing.jsonl`, routing);
  }
  write('.agents/skills/broken-notes/evals/evidence.md', evidence.replace(/\*\*Kind:\*\* \w+/, '**Kind:** rumour'));
  write('docs/examples/why.evidence.md', evidence);
  write('docs/examples/cases.routing.jsonl', routing);

  it('evidence.md and routing.jsonl under .agents/skills and .claude/skills get the evidence contract', () => {
    for (const base of ['.agents/skills/drafting-notes', '.claude/skills/drafting-notes']) {
      for (const f of ['evidence.md', 'routing.jsonl']) {
        const r = validateFile(path.join(dir, base, 'evals', f));
        assert.deepEqual([r.status, r.results.map((x) => x.contract)], ['PASS', ['evidence']], `${base}/evals/${f}: ${JSON.stringify(errorsOf(r))}`);
      }
    }
    const bad = validateFile(path.join(dir, '.agents/skills/broken-notes/evals/evidence.md'));
    assert.equal(bad.status, 'FAIL');
    assert.ok(errorsOf(bad).some((f) => f.rule === 'invalid-kind'), JSON.stringify(errorsOf(bad)));
  });

  it('outside a skills folder, *.evidence.md and *.routing.jsonl name the contract', () => {
    for (const f of ['why.evidence.md', 'cases.routing.jsonl']) {
      const r = validateFile(path.join(dir, 'docs/examples', f));
      assert.deepEqual([r.status, r.results.map((x) => x.contract)], ['PASS', ['evidence']], f);
    }
  });

  it('a directory walk of the project finds every one of them', () => {
    assert.equal(validatePath(dir).length, 7);
  });
});

describe('run-record: who ran it', () => {
  const outcomes = reg.schema('run-record').properties.outcome.enum;

  it('every outcome agentic-template\'s loop writes (fix/agent-run-caps, dontAsk) is one the contract accepts', (t) => {
    const src = spawnSync('git', ['-c', 'safe.directory=*', '-C', TEMPLATE, 'show', 'fix/agent-run-caps:scripts/loop.mjs'], { encoding: 'utf8' });
    if (src.status !== 0) return t.skip(`no fix/agent-run-caps in ${TEMPLATE}`);
    const expr = src.stdout.match(/\boutcome: ([^\n]*?),\s*\n/)[1];
    const written = [...expr.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    assert.deepEqual(written.sort(), ['advanced', 'failed', 'needs-human', 'stalled']);
    for (const o of written) assert.ok(outcomes.includes(o), o);
    assert.match(src.stdout, /permission_denials: denials/, 'it writes the denial lines the contract accepts');
  });

  it('a verdict or read that left the task in another status is a warning: it was probably the author\'s', () => {
    const file = path.join(TMP, 'moved.run-record.jsonl');
    const line = fs.readFileSync(path.join(FIX, 'valid/run-record/roles.jsonl'), 'utf8').split('\n')[0];
    fs.writeFileSync(file, `${line.replace('"status_after":"review"', '"status_after":"human-review"')}\n`);
    const r = validateFile(file);
    assert.equal(r.status, 'PASS');
    assert.deepEqual(r.results[0].findings.map((f) => [f.severity, f.rule]), [['warning', 'run-kept-status']]);
  });
});

describe('stagehand writes the promptbook formats', () => {
  const assets = path.join(STAGEHAND, 'skills/orchestrating-development/assets');
  it('its task-record and grant templates validate as they are, placeholders and all', { skip: !fs.existsSync(assets) && `no stagehand checkout at ${STAGEHAND}` }, () => {
    for (const [file, contract] of [['task-record.yaml', 'task-record'], ['project-grant.yaml', 'grant']]) {
      const r = validateFile(path.join(assets, file), { contract });
      assert.equal(r.status, 'PASS', `${file}: ${JSON.stringify(r.results.flatMap((x) => x.findings))}`);
    }
  });
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

  it('workflow roles are exactly the common role enum', () => {
    assert.deepEqual(Object.keys(load('workflow').roles).sort(), [...enumOf('role')].sort());
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

  it('a terminal state has no transition out of it', () => {
    for (const [name, m] of Object.entries(load('workflow').machines)) {
      for (const t of m.transitions) for (const from of [].concat(t.from)) assert.ok(!m.terminal.includes(from), `${name}.${t.id} leaves terminal ${from}`);
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

  it('an input request is a human\'s to answer: no attention note lets a grant answer it, and authority never grants it', () => {
    const notes = Object.values(load('attention').sources).flatMap((s) => [s.signals, s.status, s.conclusion, s.derived].filter(Boolean)).flatMap((t) => Object.values(t).map((m) => m.note ?? ''));
    for (const n of notes) assert.doesNotMatch(n, /grant (holder|covers)|unless a grant/i, n);
    assert.ok(load('authority').never_grantable.some((x) => x.id === 'answer-input-request'));
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

  it('no test file and a task at review or later is a blocking error, never a ready verdict', () => {
    const dir = project('complete');
    fs.rmSync(path.join(dir, 'tests'), { recursive: true });
    const r = trace(dir);
    const exist = r.gaps.find((g) => g.rule === 'tests-exist');
    assert.equal(exist.severity, 'error');
    assert.match(exist.message, /INV-1 is at review or later/);
    assert.deepEqual(r.gaps.filter((g) => g.rule === 'criterion-named-in-test').map((g) => [g.subject, g.severity, g.blocks_readiness]), [['INV-1 AC-1', 'error', true], ['INV-1 AC-2', 'error', true]]);
    assert.equal(r.epics[0].verdict, 'not-ready');
    const early = project('complete', { 'specs/invoicing/tasks/INV-1.md': (t) => t.replace('status: review', 'status: ready').replace(/owner: .*/, 'owner: null') });
    fs.rmSync(path.join(early, 'tests'), { recursive: true });
    assert.equal(trace(early).gaps.find((g) => g.rule === 'tests-exist').severity, 'warning', 'before review, no tests is a warning');
  });

  it('an explicit --tests glob that matches nothing is an error, whatever the statuses', () => {
    const r = trace(path.join(FIX, 'trace/complete'), { testGlobs: ['test/**/*.ts'] });
    const exist = r.gaps.find((g) => g.rule === 'tests-exist');
    assert.equal(exist.severity, 'error');
    assert.match(exist.message, /--tests test\/\*\*\/\*\.ts matched no file/);
    assert.equal(r.epics[0].verdict, 'not-ready');
    const cli = spawnSync(process.execPath, [path.join(ROOT, 'tools/validate.mjs'), '--trace', path.join(FIX, 'trace/complete'), '--tests', 'test/**/*.ts'], { encoding: 'utf8' });
    assert.equal(cli.status, 1, cli.stdout);
    assert.match(cli.stdout, /NOT-READY/);
  });

  it('an epic mode is the default for its tasks; a task mode overrides it (info)', () => {
    const dir = project('complete', {
      'specs/invoicing/spec.md': (t) => t.replace('owner: maria\n', 'owner: maria\nmode: research-plan-implement\n'),
      'specs/invoicing/tasks/INV-2.md': taskText('INV-2', { mode: 'ralph-loop' }),
      'specs/invoicing/tasks/INV-3.md': taskText('INV-3'),
    });
    const e = trace(dir).epics[0];
    assert.equal(e.mode, 'research-plan-implement');
    assert.deepEqual(e.task_modes, { 'INV-1': 'research-plan-implement', 'INV-2': 'ralph-loop', 'INV-3': 'research-plan-implement' });
    assert.deepEqual(e.gaps.filter((g) => g.rule === 'task-mode-overrides-epic').map((g) => [g.subject, g.severity]), [['INV-2', 'info']]);
    assert.equal(trace(path.join(FIX, 'trace/complete')).epics[0].task_modes['INV-1'], 'spec-driven', 'no mode anywhere: spec-driven');
  });

  describe('criteria in tests: a bare AC-n several tasks share counts for none of them', () => {
    // INV-1 (AC-1, AC-2, in review) and INV-2 (AC-1 only, in review) share AC-1; only INV-1 has AC-2.
    const inv2 = taskText('INV-2', { status: 'review', owner: 'coder-agent' }, { criteria: '- AC-1 — When an owner lists invoices, the API shall return them newest first.' });
    const run = (tests) => trace(project('complete', { 'specs/invoicing/tasks/INV-2.md': inv2, 'tests/invoicing.test.ts': tests }));
    const ev = (r) => Object.fromEntries(r.epics[0].criteria_evidence.map((x) => [`${x.task} ${x.criterion}`, x.evidence]));
    const by = (r, rule) => r.gaps.filter((g) => g.rule === rule).map((g) => g.subject).sort();

    it('a bare AC-1 is ambiguous: neither task is covered, and the warning names both', () => {
      const r = run("it('AC-1 returns the PDF', () => {});\nit('INV-1 AC-2 returns 404 for another tenant', () => {});\n");
      assert.deepEqual(r.epics[0].coverage.criteria, { covered: 1, total: 3 });
      assert.deepEqual(ev(r), { 'INV-1 AC-1': 'ambiguous', 'INV-1 AC-2': 'qualified', 'INV-2 AC-1': 'ambiguous' });
      const amb = r.gaps.filter((g) => g.rule === 'ambiguous-criterion-id');
      assert.equal(amb.length, 1);
      assert.equal(amb[0].severity, 'warning');
      assert.match(amb[0].message, /INV-1, INV-2/);
      assert.equal(amb[0].file, 'tests/invoicing.test.ts');
      assert.deepEqual(by(r, 'criterion-named-in-test'), ['INV-1 AC-1', 'INV-2 AC-1']);
      assert.equal(r.epics[0].verdict, 'not-ready');
    });

    it('a qualified "<TASK> AC-n" counts for that task only', () => {
      const r = run("it('INV-1 AC-1 returns the PDF', () => {});\nit('INV-1 AC-2 returns 404', () => {});\n");
      assert.deepEqual(ev(r), { 'INV-1 AC-1': 'qualified', 'INV-1 AC-2': 'qualified', 'INV-2 AC-1': 'none' });
      assert.deepEqual(by(r, 'criterion-named-in-test'), ['INV-2 AC-1']);
      assert.deepEqual(by(r, 'ambiguous-criterion-id'), [], 'a qualified name is never ambiguous');
    });

    it('a bare id counts when exactly one task of the epic has it', () => {
      const r = run("it('INV-1 AC-1 returns the PDF', () => {});\nit('INV-2 AC-1 lists newest first', () => {});\nit('AC-2 returns 404', () => {});\n");
      assert.deepEqual(ev(r), { 'INV-1 AC-1': 'qualified', 'INV-1 AC-2': 'bare', 'INV-2 AC-1': 'qualified' });
      assert.deepEqual(r.epics[0].coverage.criteria, { covered: 3, total: 3 });
      assert.deepEqual(by(r, 'criterion-named-in-test'), []);
      assert.deepEqual(by(r, 'ambiguous-criterion-id'), []);
    });
  });

  describe('plan shape', () => {
    const adr = '\n## ADR-0002: Invoices are stored as rendered PDFs\n**Status:** Proposed\n**Date:** 2026-10-12\n**Decision:** Store the rendered PDF.\n**Why:** The rendered file is the legal artifact.\n**Door:** one-way\n**Reversed when:** a regulator requires structured invoices.\n**Consequences:** Re-rendering is not a feature.\n';
    const plan = (status, { skeletonRoot = false } = {}) => project('complete', {
      'specs/invoicing/spec.md': (t) => t.replace('status: approved', `status: ${status}`).replace('**ADRs:** ADR-0001', '**ADRs:** ADR-0001, ADR-0002'),
      'DECISIONS.md': (t) => `${t}${adr}`,
      'specs/invoicing/tasks/INV-1.md': (t) => (skeletonRoot ? t.replace('depends_on: []', 'depends_on: [INV-2]') : t),
      'specs/invoicing/tasks/INV-2.md': taskText('INV-2', { 'x-skeleton': true, touches: ['src/**'], depends_on: skeletonRoot ? [] : ['INV-3'] }, { title: 'Walking skeleton: download end to end' }),
      'specs/invoicing/tasks/INV-3.md': taskText('INV-3', { touches: ['src/api/invoices/**'], depends_on: skeletonRoot ? ['INV-2'] : [] }),
      'specs/invoicing/tasks/INV-4.md': taskText('INV-4', { touches: ['src/api/invoices/list.ts'], depends_on: skeletonRoot ? ['INV-2', 'INV-3'] : [] }),
      'specs/invoicing/tasks/INV-5.md': taskText('INV-5', { size: 'XL', depends_on: skeletonRoot ? ['INV-2'] : [] }),
      'specs/invoicing/tasks/INV-6.md': taskText('INV-6', { depends_on: skeletonRoot ? ['INV-2'] : [] }, { questions: '- [ ] Which PDF library? **Blocks readiness** until the owner picks.\n- [x] Paper size? A4.' }),
    });
    const by = (r, rule) => r.gaps.filter((g) => g.rule === rule).map((g) => [g.subject, g.severity]);

    it('an approved epic: unordered overlapping tasks, a skeleton that is not the root, an undecided one-way door, a blocked or XL ready task are errors', () => {
      const r = trace(plan('approved'));
      assert.deepEqual(by(r, 'overlapping-tasks-ordered').filter(([s]) => s === 'INV-3 INV-4'), [['INV-3 INV-4', 'error']]);
      const sk = by(r, 'skeleton-is-root');
      assert.ok(sk.length === 2 && sk.every(([s, sev]) => s === 'INV-2' && sev === 'error'), JSON.stringify(sk));
      assert.deepEqual(by(r, 'one-way-door-decided'), [['ADR-0002', 'error']]);
      assert.deepEqual(by(r, 'ready-task-unblocked'), [['INV-6', 'error']], 'the answered question does not block');
      assert.deepEqual(by(r, 'task-size-fits'), [['INV-5', 'error']]);
      assert.equal(r.epics[0].verdict, 'not-ready');
    });

    it('before approval the epic-level rules are warnings; a ready task still answers for itself', () => {
      const r = trace(plan('draft'));
      for (const rule of ['overlapping-tasks-ordered', 'skeleton-is-root', 'one-way-door-decided']) assert.ok(by(r, rule).length && by(r, rule).every(([, sev]) => sev === 'warning'), rule);
      assert.deepEqual(by(r, 'ready-task-unblocked'), [['INV-6', 'error']]);
    });

    it('a skeleton at the root with every task after it, and ordered lanes, raise nothing', () => {
      const r = trace(plan('approved', { skeletonRoot: true }));
      assert.deepEqual(by(r, 'skeleton-is-root'), []);
      assert.deepEqual(by(r, 'overlapping-tasks-ordered').filter(([s]) => s === 'INV-3 INV-4'), [], 'INV-4 depends on INV-3');
    });

    it('legacy adoption keeps every plan rule a warning', () => {
      const dir = plan('approved');
      fs.rmSync(path.join(dir, 'docs/product/brief.md'));
      const r = trace(dir);
      for (const rule of ['overlapping-tasks-ordered', 'skeleton-is-root', 'one-way-door-decided', 'ready-task-unblocked', 'task-size-fits']) assert.ok(by(r, rule).every(([, sev]) => sev === 'warning'), rule);
    });
  });

  it('a broken project reports each broken link by rule', () => {
    const r = trace(path.join(FIX, 'trace/broken'));
    const rules = new Set(r.gaps.filter((g) => g.severity === 'error').map((g) => g.rule));
    for (const rule of ['decision-exists', 'requirement-exists', 'guiding-doc-exists', 'criterion-named-in-test', 'task-cites-requirement', 'dependencies-acyclic', 'journey-exists', 'persona-exists', 'user-facing-journey-has-ux', 'journey-has-task', 'journey-has-requirement', 'journey-cites-persona', 'requirement-has-task']) {
      assert.ok(rules.has(rule), `missing ${rule}; got ${[...rules].join(', ')}`);
    }
    assert.equal(r.epics[0].verdict, 'not-ready');
  });

  it('smoke: wt-stack-drift (specs, no product docs, no tests) reports gaps as legacy warnings, and its merged and human-review tasks as untested', { skip: !fs.existsSync(STACK_DRIFT) }, () => {
    const r = trace(STACK_DRIFT);
    assert.equal(r.adoption, 'legacy');
    const errors = r.gaps.filter((g) => g.severity === 'error');
    assert.deepEqual([...new Set(errors.map((g) => g.rule))].sort(), ['criterion-named-in-test', 'tests-exist'], JSON.stringify(errors, null, 2));
    assert.deepEqual([...new Set(errors.filter((g) => g.rule === 'criterion-named-in-test').map((g) => g.subject.split(' ')[0]))].sort(), ['BILL-1', 'BILL-2']);
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

  it('--readiness records the root\'s HEAD as source_commit; --no-timestamp writes the same bytes on every run', () => {
    const dir = project('complete');
    const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { encoding: 'utf8' });
    git('init', '-q');
    git('add', '-A');
    git('commit', '-q', '-m', 'plan');
    const head = git('rev-parse', 'HEAD').stdout.trim();
    const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/validate.mjs'), '--trace', dir, ...a], { encoding: 'utf8' });
    const report = (out) => fs.readFileSync(path.join(out, 'invoicing/readiness.md'), 'utf8');
    const fm = (text) => parse(text.split('---')[1]);

    const out = path.join(dir, 'reports');
    assert.equal(cli('--readiness', out).status, 0);
    assert.equal(fm(report(out)).source_commit, head);
    assert.ok(fm(report(out)).generated_at);
    assert.equal(validateFile(path.join(out, 'invoicing/readiness.md'), { contract: 'readiness-report' }).status, 'PASS');

    const stable = path.join(dir, 'specs');
    assert.equal(cli('--readiness', stable, '--no-timestamp').status, 0);
    const first = report(stable);
    assert.equal(fm(first).generated_at, undefined);
    assert.equal(fm(first).source_commit, undefined);
    git('add', '-A');
    git('commit', '-q', '-m', 'the readiness report');
    assert.equal(cli('--readiness', stable, '--no-timestamp').status, 0);
    assert.equal(report(stable), first, 'a second check after committing the report changes nothing');
    assert.equal(git('status', '--porcelain', 'specs').stdout, '');
    const r = validateFile(path.join(stable, 'invoicing/readiness.md'));
    assert.equal(r.status, 'PASS', JSON.stringify(errorsOf(r)));
  });

  it('--readiness <dir> --check regenerates each committed report, writes nothing, and fails on a stale, hand-edited, timestamped, missing or orphan one', () => {
    const dir = project('complete');
    const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/validate.mjs'), '--trace', dir, ...a], { encoding: 'utf8' });
    const specs = path.join(dir, 'specs');
    const file = path.join(specs, 'invoicing/readiness.md');
    const check = () => cli('--readiness', specs, '--check');
    const status = () => JSON.parse(cli('--readiness', specs, '--check', '--json').stdout).readiness_check.map((c) => [c.epic, c.status]);

    assert.equal(check().status, 1, 'no committed report yet');
    assert.deepEqual(status(), [['invoicing', 'missing']]);
    assert.ok(!fs.existsSync(file), '--check writes nothing');
    assert.equal(cli('--readiness', specs, '--no-timestamp').status, 0);
    const ok = check();
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, /readiness 1\/1 report\(s\) current/);

    const committed = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, committed.replace('**ready**', '**ready** (signed off)'));
    const edited = check();
    assert.equal(edited.status, 1);
    assert.match(edited.stdout, /readiness .*invoicing\/readiness\.md: stale — differs from the plan at line \d+/);
    assert.match(edited.stdout, /regenerate: node tools\/validate\.mjs --trace .* --readiness .* --no-timestamp/);

    fs.writeFileSync(file, committed);
    fs.writeFileSync(path.join(specs, 'invoicing/tasks/INV-2.md'), taskText('INV-2'));
    assert.deepEqual(status(), [['invoicing', 'stale']], 'the plan changed, the report did not');
    fs.rmSync(path.join(specs, 'invoicing/tasks/INV-2.md'));

    assert.equal(cli('--readiness', specs).status, 0, 'a timestamped report');
    assert.deepEqual(status(), [['invoicing', 'timestamped']]);
    const reports = path.join(dir, 'reports');
    assert.equal(cli('--readiness', reports, '--no-timestamp').status, 0);
    fs.mkdirSync(path.join(reports, 'billing'));
    fs.writeFileSync(path.join(reports, 'billing/readiness.md'), committed);
    const orphan = JSON.parse(cli('--readiness', reports, '--check', '--json').stdout).readiness_check.map((c) => [c.epic, c.status]);
    assert.deepEqual(orphan.sort(), [['billing', 'orphan'], ['invoicing', 'ok']]);
    assert.equal(cli('--check').status, 2, '--check without --readiness is a usage error');
  });

  it('the CLI exits 1 on the smoke project (a merged task, no test file) and on the broken one', { skip: !fs.existsSync(STACK_DRIFT) }, () => {
    const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/validate.mjs'), ...a], { encoding: 'utf8' });
    const smoke = cli('--trace', STACK_DRIFT);
    assert.equal(smoke.status, 1, smoke.stdout + smoke.stderr);
    assert.match(smoke.stdout, /legacy adoption/);
    assert.match(smoke.stdout, /error {3}tests-exist \(blocks readiness\)/);
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
    assert.match(r.stdout, /^FAIL fixtures\/invalid\/task\/claimed-task-has-owner\.md \[task@\d+\.\d+\.\d+\]/m);
    assert.match(r.stdout, /^ {2}\/owner claimed-task-has-owner:11: /m);
  });

  it('exits 0 when every file passes, and 2 on a usage error', () => {
    assert.equal(cli('fixtures/valid').status, 0);
    assert.equal(cli('--contract', 'nope', 'fixtures/valid/task').status, 2);
    assert.equal(cli('README.md').status, 2);
  });

  it('--contract validates a file whose path implies no contract', () => {
    const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'promptbook-'));
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
