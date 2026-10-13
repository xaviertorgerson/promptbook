// The TOML subset the policy compiler emits: tables of strings, booleans, integers and string
// arrays, nested tables, and arrays of tables ([[rule]]). Strings are TOML basic strings; JSON's
// escapes (\" \\ \n \t \uXXXX) are valid TOML, so JSON.stringify writes them. Key order is the
// object's insertion order, so output is deterministic for golden files.

const bareKey = (k) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k));

const isTable = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isTableArray = (v) => Array.isArray(v) && v.length > 0 && v.every(isTable);

export function tomlValue(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`TOML: cannot write ${v}`);
    return String(v);
  }
  if (Array.isArray(v)) return `[${v.map(tomlValue).join(', ')}]`;
  throw new Error(`TOML: unsupported value ${JSON.stringify(v)}`);
}

// Write obj as TOML. comments: { "<dotted.table.path>": "comment" } printed above that table.
export function toToml(obj, { comments = {} } = {}) {
  const out = [];
  const emit = (table, keys) => {
    const scalars = Object.entries(table).filter(([, v]) => v !== undefined && !isTable(v) && !isTableArray(v));
    const header = keys.length ? keys.map(bareKey).join('.') : null;
    if (header && scalars.length) {
      if (out.length) out.push('');
      if (comments[keys.join('.')]) out.push(`# ${comments[keys.join('.')]}`);
      out.push(`[${header}]`);
    }
    for (const [k, v] of scalars) out.push(`${bareKey(k)} = ${tomlValue(v)}`);
    for (const [k, v] of Object.entries(table)) {
      if (isTable(v)) emit(v, [...keys, k]);
      else if (isTableArray(v)) {
        for (const item of v) {
          if (out.length) out.push('');
          out.push(`[[${[...keys, k].map(bareKey).join('.')}]]`);
          for (const [ik, iv] of Object.entries(item)) if (iv !== undefined) out.push(`${bareKey(ik)} = ${tomlValue(iv)}`);
        }
      }
    }
  };
  emit(obj, []);
  return `${out.join('\n')}\n`;
}
