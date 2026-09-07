import type { ConditionConfig } from "../types";

/**
 * Reads a dot-separated path out of an arbitrary payload.
 *
 * `"customer.plan"` against `{ customer: { plan: "pro" } }` -> `"pro"`.
 * Returns `undefined` for a missing segment, a non-object intermediate
 * value (e.g. the path continues past a string or a number), or an empty
 * path -- never throws. A condition testing a field a given payload
 * doesn't happen to have is an expected outcome to evaluate against, not
 * an error.
 */
function getByPath(payload: Record<string, unknown>, path: string): unknown {
  if (path === "") {
    return undefined;
  }

  return path.split(".").reduce<unknown>((value, key) => {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }
    return (value as Record<string, unknown>)[key];
  }, payload);
}

/**
 * Evaluates one condition node's rule against a run's input payload.
 *
 * Every comparison is total -- there is no input for which this throws.
 * `config.value` is always a string (`ConditionConfig.value: string`), but
 * the payload field it's compared against isn't guaranteed to be -- a
 * trigger's sample payload can hold a real number, boolean, or `null` (see
 * the simple payload editor's per-field type). Three coercions make every
 * operator work against those anyway:
 * - `equals`/`not_equals` run the actual value through `String(...)`
 *   first, so a payload field typed as Number or True/False (`42`, `true`)
 *   can still be checked with an exact-match operator against the typed
 *   string `"42"`/`"true"`, not just genuine strings.
 * - `greater_than`/`less_than` run both sides through `Number(...)`. A
 *   value that doesn't parse becomes `NaN`, and every comparison against
 *   `NaN` is `false` (`Number("eighteen") > Number("5")` is `false`, not
 *   an error) -- so a condition like `age greater_than "eighteen"`
 *   evaluates to `false` rather than crashing a run.
 * - `contains` also runs the actual value through `String(...)` first, so
 *   it works against numbers and booleans, not just strings.
 *
 * All three of `equals`/`not_equals`/`contains` treat a missing field
 * (`actual` is `undefined`) as `""` rather than the literal text
 * `"undefined"` `String(undefined)` would otherwise produce, so "does the
 * missing field equal/contain X" is reliably `false` (or `true`, for an
 * empty-string `X`) instead of matching by accident.
 *
 * `contains` is case-insensitive (both sides are lowercased before the
 * substring check); `equals`/`not_equals` are exact. This deliberately
 * doesn't match by matching -- a "contains" check reads to a person as
 * "roughly this text is in there," and matching that expectation matters
 * more here than mirroring JavaScript's own case-sensitive `.includes()`.
 * `equals` stays exact (no case-folding) because a workflow author who
 * wants exact matching (an id, a status enum) needs *some* operator that
 * means what it says.
 */
export function evaluateCondition(
  config: ConditionConfig,
  payload: Record<string, unknown>,
): boolean {
  const actual = getByPath(payload, config.field);
  const actualText = String(actual ?? "");

  switch (config.operator) {
    case "equals":
      return actualText === config.value;
    case "not_equals":
      return actualText !== config.value;
    case "contains":
      return actualText.toLowerCase().includes(config.value.toLowerCase());
    case "greater_than":
      return Number(actual) > Number(config.value);
    case "less_than":
      return Number(actual) < Number(config.value);
  }
}
