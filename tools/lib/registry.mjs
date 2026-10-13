import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// The schema registry: every schemas/*.schema.json compiled once into one Ajv instance, so a $ref to
// common.schema.json resolves the same way for every contract. Harness keywords (x-*) are declared
// as annotations; x-unique-by is the one that validates.
//
//   x-version    the contract's version (semver)
//   x-artifacts  where the artifact lives in a project and which loader reads it
//   x-sections   required level-2 headings of a Markdown body: [{ id, heading, match }]
//   x-checks     named body checks beyond JSON Schema (tools/lib/checks.mjs)
//   x-rule       the rule name an error at or below this node reports (fixtures are named by it)
//   x-rules      { <keyword>: <rule name> } for errors of that keyword at this node

export const SCHEMA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../schemas');
export const SCHEMA_BASE = 'https://harness.dev/schemas/';

const ANNOTATIONS = ['x-version', 'x-sections', 'x-artifacts', 'x-checks', 'x-rule', 'x-rules'];

function uniqueBy(prop, data) {
  const seen = new Map();
  const errors = [];
  data.forEach((item, i) => {
    const key = item?.[prop];
    if (key === undefined) return;
    if (seen.has(key)) {
      errors.push({
        keyword: 'x-unique-by',
        instancePath: `/${i}/${prop}`,
        message: `duplicates ${prop} "${key}" of item ${seen.get(key)}`,
        params: { prop, value: key },
      });
    } else seen.set(key, i);
  });
  return errors;
}

export class Registry {
  constructor(dir = SCHEMA_DIR) {
    this.dir = dir;
    this.ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, strictRequired: false, allowUnionTypes: true, verbose: true });
    addFormats(this.ajv);
    this.ajv.addVocabulary(ANNOTATIONS);
    this.ajv.addKeyword({
      keyword: 'x-unique-by',
      type: 'array',
      schemaType: 'string',
      errors: true,
      validate: function validate(prop, data) {
        validate.errors = uniqueBy(prop, data);
        return validate.errors.length === 0;
      },
    });
    this.schemas = new Map();
    // Every schema node -> { parent node, key from parent }. Ajv reports schemaPath relative to the
    // $ref target that failed, without saying which document that is; with verbose on it also hands
    // back the failing node itself (parentSchema), so its ancestors are found by identity.
    this.parents = new WeakMap();
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.schema.json')).sort()) {
      const schema = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const name = file.replace(/\.schema\.json$/, '');
      if (schema.$id !== `${SCHEMA_BASE}${file}`) throw new Error(`${file}: $id must be ${SCHEMA_BASE}${file}`);
      this.schemas.set(name, schema);
      this.index(schema, null, undefined);
      this.ajv.addSchema(schema);
    }
    this.validators = new Map();
  }

  index(node, parent, key) {
    if (!node || typeof node !== 'object') return;
    this.parents.set(node, { parent, key });
    for (const [k, v] of Object.entries(node)) this.index(v, node, k);
  }

  // The node and its ancestors, nearest first, each with the key that leads from it toward the node.
  ancestry(node) {
    const out = [{ node, key: undefined }];
    for (let link = this.parents.get(node); link?.parent; link = this.parents.get(link.parent)) {
      out.push({ node: link.parent, key: link.key });
    }
    return out;
  }

  // Contracts are every schema that describes an artifact; common holds shared definitions only.
  contracts() {
    return [...this.schemas.keys()].filter((n) => n !== 'common');
  }

  has(name) {
    return this.schemas.has(name) && name !== 'common';
  }

  schema(name) {
    const s = this.schemas.get(name);
    if (!s) throw new Error(`unknown contract "${name}" (known: ${this.contracts().join(', ')})`);
    return s;
  }

  version(name) {
    return this.schema(name)['x-version'];
  }

  artifacts(name) {
    return this.schema(name)['x-artifacts'] ?? [];
  }

  sections(name) {
    return this.schema(name)['x-sections'] ?? [];
  }

  // A validator for the whole schema, or for a fragment of it (#/$defs/entry) when one schema
  // describes several artifact shapes.
  validator(name, pointer = '') {
    const key = `${name}${pointer}`;
    if (!this.validators.has(key)) {
      const v = this.ajv.getSchema(`${SCHEMA_BASE}${name}.schema.json${pointer}`);
      if (!v) throw new Error(`cannot resolve ${name}.schema.json${pointer}`);
      this.validators.set(key, v);
    }
    return this.validators.get(key);
  }

  // The schema nodes an Ajv schemaPath walks through, root first, each with the key taken out of it
  // ({ node, key }; the last has key undefined), so an error can be named by the deepest x-rule
  // above it. A path into another schema (common.schema.json#/...) starts there.
  nodesOnPath(name, schemaPath) {
    const [ref, frag = ''] = schemaPath.split('#');
    const doc = ref ? this.schemas.get(path.basename(ref).replace(/\.schema\.json$/, '')) : this.schema(name);
    if (!doc) return [];
    const steps = [{ node: doc, key: undefined }];
    for (const raw of frag.split('/').slice(1)) {
      const key = decodeURIComponent(raw.replace(/~1/g, '/').replace(/~0/g, '~'));
      const node = steps.at(-1).node;
      if (node == null || typeof node !== 'object' || !(key in node)) break;
      steps.at(-1).key = key;
      steps.push({ node: node[key], key: undefined });
    }
    return steps;
  }

  // The schema object at a fragment of a contract ("#/$defs/entry", or "" for the whole schema).
  at(name, pointer) {
    return pointer ? this.nodesOnPath(name, pointer).at(-1)?.node : this.schema(name);
  }
}

let shared;
export function registry() {
  shared ??= new Registry();
  return shared;
}
