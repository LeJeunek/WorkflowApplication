import { parseSamplePayload } from "./execution";

/** Every type a simple-editor row can declare, in the order offered to pick from. */
export const PAYLOAD_FIELD_TYPES = [
  "text",
  "number",
  "boolean",
  "null",
  "json",
] as const;

export type PayloadFieldType = (typeof PAYLOAD_FIELD_TYPES)[number];

/**
 * One row of the simple field-by-field payload editor: a dot-path key, an
 * explicit type, and display text. The type is stored rather than guessed
 * from the text alone -- otherwise there's no way to tell "the text `true`,
 * literally" from "the boolean `true`" apart, and no dropdown to pick a
 * boolean/number/null value without typing JSON syntax by hand, which is
 * exactly what this editor exists to avoid.
 */
export interface PayloadField {
  path: string;
  type: PayloadFieldType;
  value: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The row a JSON leaf becomes, inferred from its actual runtime type. */
function leafToField(path: string, leaf: unknown): PayloadField {
  if (typeof leaf === "string") {
    return { path, type: "text", value: leaf };
  }
  if (typeof leaf === "number") {
    return { path, type: "number", value: String(leaf) };
  }
  if (typeof leaf === "boolean") {
    return { path, type: "boolean", value: String(leaf) };
  }
  if (leaf === null) {
    return { path, type: "null", value: "" };
  }
  // Only an array can reach here -- isPlainObject leaves are recursed into
  // by the caller, not passed to this function.
  return { path, type: "json", value: JSON.stringify(leaf) };
}

/**
 * Flattens a trigger's sample payload into dot-path rows for the simple
 * editor. Only plain objects are recursed into -- an array is shown as one
 * row of JSON type (its raw text) rather than being editable item-by-item,
 * so nothing in the payload is ever lost even though only object nesting
 * can be built through the simple editor. Delegates parsing to
 * {@link parseSamplePayload}, so invalid or absent JSON is just an empty
 * row list, consistent with how a run treats it.
 */
export function flattenPayload(raw: string | undefined): PayloadField[] {
  const rows: PayloadField[] = [];

  function walk(value: Record<string, unknown>, prefix: string) {
    for (const [key, val] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (isPlainObject(val)) {
        walk(val, path);
      } else {
        rows.push(leafToField(path, val));
      }
    }
  }

  walk(parseSamplePayload(raw), "");
  return rows;
}

/**
 * Resolves one row's display text into the real value its declared `type`
 * calls for. `number` and `json` fall back to the raw text when it doesn't
 * parse as that type *yet* -- a mid-edit value like `-` (typing a negative
 * number) or `[1,` (typing an array) is kept exactly as typed rather than
 * being coerced into some default that would fight the very keystroke that
 * produced it. Since `type` itself is re-derived from the result on the
 * next flatten, an in-progress number briefly reads back as `text` and
 * self-corrects the moment it becomes a real number -- the same graceful,
 * un-blocking fallback the whole-payload Advanced/JSON view already uses.
 */
function resolveFieldValue(row: PayloadField): unknown {
  switch (row.type) {
    case "text":
      return row.value;
    case "number": {
      const parsed = Number(row.value);
      return row.value.trim() !== "" && Number.isFinite(parsed)
        ? parsed
        : row.value;
    }
    case "boolean":
      return row.value === "true";
    case "null":
      return null;
    case "json":
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
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
  for (const row of rows) {
    if (row.path.trim() === "") {
      continue;
    }
    setPath(result, row.path.split("."), resolveFieldValue(row));
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

/**
 * The value to show when a row's type is changed via the dropdown --
 * preserves the current text where it's already valid for the new type (so
 * toggling Number -> Text -> Number round-trips cleanly), and falls back to
 * a sensible default otherwise. Mirrors how switching a Trigger's Kind
 * resets kind-specific fields elsewhere in this app: an explicit type
 * change is a deliberate reset, unlike the keystroke-by-keystroke tolerance
 * {@link resolveFieldValue} gives an in-progress edit.
 */
export function defaultValueForType(
  type: PayloadFieldType,
  currentValue: string,
): string {
  switch (type) {
    case "text":
    case "json":
      return currentValue;
    case "number":
      return currentValue.trim() !== "" && Number.isFinite(Number(currentValue))
        ? currentValue
        : "0";
    case "boolean":
      return currentValue === "true" || currentValue === "false"
        ? currentValue
        : "true";
    case "null":
      return "";
  }
}
