import { parseSamplePayload } from "./execution";

/** One row of the simple field-by-field payload editor: a dot-path key paired with its display text. */
export interface PayloadField {
  path: string;
  value: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Flattens a trigger's sample payload into dot-path rows for the simple
 * editor. Only plain objects are recursed into -- an array or any other
 * leaf value is shown as one row (its JSON text) rather than being
 * editable field-by-field, so nothing in the payload is ever lost even
 * though only object nesting can be built through the simple editor.
 * Delegates parsing to {@link parseSamplePayload}, so invalid or absent
 * JSON is just an empty row list, consistent with how a run treats it.
 */
export function flattenPayload(raw: string | undefined): PayloadField[] {
  const rows: PayloadField[] = [];

  function walk(value: Record<string, unknown>, prefix: string) {
    for (const [key, val] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (isPlainObject(val)) {
        walk(val, path);
      } else {
        rows.push({
          path,
          value: typeof val === "string" ? val : JSON.stringify(val),
        });
      }
    }
  }

  walk(parseSamplePayload(raw), "");
  return rows;
}

/**
 * Parses one row's display text back into a real value: valid JSON (a
 * number, `true`/`false`, `null`, or even a hand-typed array/object) is
 * used as-is, so the simple editor round-trips whatever {@link flattenPayload}
 * showed; anything else -- the common case, plain words like `pro` -- is
 * kept as a string rather than rejected.
 */
function parseFieldValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function setPath(
  target: Record<string, unknown>,
  segments: string[],
  value: unknown,
): void {
  const [head, ...rest] = segments;
  if (rest.length === 0) {
    target[head] = value;
    return;
  }
  const next = isPlainObject(target[head])
    ? (target[head] as Record<string, unknown>)
    : {};
  target[head] = next;
  setPath(next, rest, value);
}

/**
 * Rebuilds sample payload JSON text from dot-path rows -- the inverse of
 * {@link flattenPayload}. Always rebuilds from scratch rather than patching
 * the previous JSON, so a renamed or reordered row can't leave a stale key
 * behind. A row with a blank path is dropped rather than producing an
 * empty-string key -- the transient state of a field the user hasn't named
 * yet, not something meant to be saved.
 */
export function buildPayload(rows: PayloadField[]): string {
  const result: Record<string, unknown> = {};
  for (const { path, value } of rows) {
    if (path.trim() === "") {
      continue;
    }
    setPath(result, path.split("."), parseFieldValue(value));
  }
  return JSON.stringify(result, null, 2);
}

/** A field name guaranteed not to collide with any row already present, for "+ Add field". */
export function nextFieldName(rows: PayloadField[]): string {
  const existing = new Set(rows.map((row) => row.path));
  let n = 1;
  while (existing.has(`field${n}`)) {
    n++;
  }
  return `field${n}`;
}
