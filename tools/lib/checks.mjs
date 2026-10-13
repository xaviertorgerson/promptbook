import { classify, criteria } from './ears.mjs';
import { headings, splitLines, stripComments, fenceMask } from './markdown.mjs';

// Named checks a schema lists under x-checks: rules JSON Schema cannot express because they read the
// Markdown body or compare two fields. Each returns findings { rule, pointer, message, line, severity }.

const CLAIMED = new Set(['ready', 'in-progress', 'review', 'human-review', 'merging', 'merged']);

export const CHECKS = {
  // The acceptance criteria: ids present, canonical, unique, and EARS-shaped (agentic-template ears-lint
  // patterns). A task past spec-draft has at least one real criterion.
  criteria({ data, text }) {
    const out = [];
    const { found, items } = criteria(text);
    if (!found) return out; // missing-section-acceptance-criteria reports it
    const real = items.filter((c) => !c.placeholder);
    const seen = new Map();
    for (const c of real) {
      if (!c.id) {
        out.push({ rule: 'criterion-has-id', pointer: '(body)', line: c.line, message: `criterion has no AC-n id: "${c.raw.slice(0, 80)}"` });
        continue;
      }
      if (c.legacy) out.push({ severity: 'warning', rule: 'criterion-id-canonical', pointer: '(body)', line: c.line, message: `${c.written} is the legacy form; write ${c.id}` });
      if (seen.has(c.id)) out.push({ rule: 'criterion-id-unique', pointer: '(body)', line: c.line, message: `${c.id} repeats line ${seen.get(c.id)}` });
      else seen.set(c.id, c.line);
      if (!classify(c.statement)) {
        out.push({ rule: 'criterion-is-ears', pointer: '(body)', line: c.line, message: `${c.id} is not an EARS sentence (When/While/Where/If…then/The … shall …): "${c.statement.slice(0, 100)}"` });
      }
    }
    if (!real.length && CLAIMED.has(data?.status)) {
      out.push({ rule: 'ready-task-has-criteria', pointer: '/status', line: null, message: `a ${data.status} task has no real acceptance criteria` });
    }
    return out;
  },

  'no-self-dependency'({ data }) {
    const out = [];
    if (Array.isArray(data?.depends_on) && data.depends_on.includes(data.id)) out.push({ rule: 'no-self-dependency', pointer: '/depends_on', message: `${data.id} depends on itself` });
    if (data?.parent && data.parent === data.id) out.push({ rule: 'no-self-dependency', pointer: '/parent', message: `${data.id} is its own parent` });
    return out;
  },

  // "# <ID> · title": the board and the loop show the title; a heading naming another task is a copy error.
  'title-heading'({ data, text }) {
    const lines = splitLines(stripComments(text));
    const h1 = headings(lines, fenceMask(lines)).find((h) => h.level === 1);
    if (!h1) return [{ severity: 'warning', rule: 'title-names-id', pointer: '(body)', line: null, message: 'no "# <ID> · title" heading' }];
    const named = (h1.text.match(/^([A-Z][A-Z0-9]*-[0-9]+)\b/) ?? [])[1];
    if (named && data?.id && named !== data.id) return [{ rule: 'title-names-id', pointer: '(body)', line: h1.index + 1, message: `title names ${named}, frontmatter id is ${data.id}` }];
    return [];
  },

  'ended-after-started'({ data }) {
    if (data?.started_at && data?.ended_at && Date.parse(data.ended_at) < Date.parse(data.started_at)) {
      return [{ rule: 'ended-after-started', pointer: '/ended_at', message: `ended_at ${data.ended_at} is before started_at ${data.started_at}` }];
    }
    return [];
  },

  'grant-dates'({ data }) {
    const out = [];
    const t = (k) => (data?.[k] ? Date.parse(data[k]) : NaN);
    if (t('expires_at') <= t('granted_at')) out.push({ rule: 'expires-after-granted', pointer: '/expires_at', message: `expires_at ${data.expires_at} is not after granted_at ${data.granted_at}` });
    if (t('revoked_at') < t('granted_at')) out.push({ rule: 'revoked-after-granted', pointer: '/revoked_at', message: `revoked_at ${data.revoked_at} is before granted_at ${data.granted_at}` });
    return out;
  },

  // A rule in allow or ask that a forbid rule already covers never takes effect (deny wins on every
  // engine), so it misleads a reader. A forbid that an allow repeats is a mistake either way.
  'policy-shadowing'({ data }) {
    const out = [];
    const key = (r) => JSON.stringify(r.command ?? r.write ?? [r.tool, r.domain ?? null]);
    const covers = (deny, other) => {
      if (deny.command && other.command) {
        if (deny.command.length > other.command.length) return false;
        return deny.command.every((tok, i) => {
          const a = [].concat(tok);
          const b = [].concat(other.command[i]);
          return b.every((x) => a.includes(x));
        });
      }
      return key(deny) === key(other);
    };
    for (const list of ['allow', 'ask']) {
      (data?.[list] ?? []).forEach((r, i) => {
        const hit = (data.forbid ?? []).findIndex((f) => covers(f, r));
        if (hit !== -1) out.push({ severity: 'warning', rule: 'rule-shadowed-by-forbid', pointer: `/${list}/${i}`, message: `never takes effect: forbid/${hit} already denies it` });
      });
    }
    return out;
  },
};

// Required level-2 headings (x-sections). Matched against the heading text with the schema's regex.
export function checkSections(sections, body, bodyLine) {
  const lines = splitLines(stripComments(body));
  const hs = headings(lines, fenceMask(lines)).filter((h) => h.level === 2);
  const out = [];
  for (const s of sections) {
    const re = new RegExp(s.match, 'i');
    if (!hs.some((h) => re.test(h.text))) {
      out.push({ rule: `missing-section-${s.id}`, pointer: '(body)', line: bodyLine, message: `missing "## ${s.heading}" section` });
    }
  }
  return out;
}
