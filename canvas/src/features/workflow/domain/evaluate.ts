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
 * Two coercions make that true:
 * - `greater_than`/`less_than` run both sides through `Number(...)`. A
 *   value that doesn't parse becomes `NaN`, and every comparison against
 *   `NaN` is `false` (`Number("eighteen") > Number("5")` is `false`, not
 *   an error) -- so a condition like `age greater_than "eighteen"`
 *   evaluates to `false` rather than crashing a run.
 * - `contains` runs the actual value through `String(...)` first, so it
 *   works against numbers and booleans, not just strings. A missing field
 *   (`actual` is `undefined`) becomes `""` via `?? ""`, so "does the
 *   missing field contain X" is reliably `false` instead of throwing on
 *   `String(undefined)` producing the literal text `"undefined"`.
 */
export function evaluateCondition(
  config: ConditionConfig,
  payload: Record<string, unknown>,
): boolean {
  const actual = getByPath(payload, config.field);

  switch (config.operator) {
    case "equals":
      return actual === config.value;
    case "not_equals":
      return actual !== config.value;
    case "contains":
      return String(actual ?? "").includes(config.value);
    case "greater_than":
      return Number(actual) > Number(config.value);
    case "less_than":
      return Number(actual) < Number(config.value);
  }
}
