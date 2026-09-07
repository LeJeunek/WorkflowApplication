import { describe, expect, it } from "vitest";

import { evaluateCondition } from "./evaluate";
import type { ConditionConfig, ConditionOperator } from "../types";

function condition(
  field: string,
  operator: ConditionOperator,
  value: string,
): ConditionConfig {
  return { field, operator, value };
}

describe("evaluateCondition", () => {
  describe("equals / not_equals", () => {
    it("matches an exact string value", () => {
      expect(
        evaluateCondition(condition("plan", "equals", "pro"), {
          plan: "pro",
        }),
      ).toBe(true);
    });

    it("does not match a different value", () => {
      expect(
        evaluateCondition(condition("plan", "equals", "pro"), {
          plan: "free",
        }),
      ).toBe(false);
    });

    it("not_equals is the exact inverse of equals", () => {
      const payload = { plan: "pro" };
      expect(evaluateCondition(condition("plan", "equals", "pro"), payload)).toBe(true);
      expect(evaluateCondition(condition("plan", "not_equals", "pro"), payload)).toBe(false);
    });

    it("is case-sensitive, unlike contains", () => {
      // Deliberate asymmetry: equals is for exact matches (an id, a status
      // enum) where a workflow author who chose it wants it to mean what
      // it says, unlike contains's more forgiving "roughly this text".
      expect(
        evaluateCondition(condition("plan", "equals", "Pro"), { plan: "pro" }),
      ).toBe(false);
    });

    it("coerces a non-string actual value before comparing", () => {
      // config.value is always a string (ConditionConfig.value: string),
      // but a payload field can be a real number, boolean, or null (see the
      // simple payload editor's per-field type) -- equals has to be able to
      // check those, not just genuine strings.
      expect(
        evaluateCondition(condition("seats", "equals", "42"), { seats: 42 }),
      ).toBe(true);
      expect(
        evaluateCondition(condition("active", "equals", "true"), {
          active: true,
        }),
      ).toBe(true);
      expect(
        evaluateCondition(condition("active", "not_equals", "true"), {
          active: false,
        }),
      ).toBe(true);
    });

    it("treats a missing field as an empty string, matching an empty Value", () => {
      expect(
        evaluateCondition(condition("missing", "equals", ""), {}),
      ).toBe(true);
      expect(
        evaluateCondition(condition("missing", "not_equals", ""), {}),
      ).toBe(false);
    });
  });

  describe("contains", () => {
    it("matches a substring", () => {
      expect(
        evaluateCondition(condition("email", "contains", "@acme.com"), {
          email: "kyle@acme.com",
        }),
      ).toBe(true);
    });

    it("coerces a non-string actual value before searching", () => {
      // The stored value is always a string (ConditionConfig.value: string),
      // but the payload field it's compared against isn't guaranteed to be.
      expect(
        evaluateCondition(condition("age", "contains", "2"), { age: 42 }),
      ).toBe(true);
    });

    it("treats a missing field as an empty string rather than throwing", () => {
      expect(
        evaluateCondition(condition("missing", "contains", "x"), {}),
      ).toBe(false);
    });

    it("is case-insensitive", () => {
      // The exact scenario that motivated this: a payload with a lowercase
      // "pro" plan and a condition value typed as "Pro" should still match
      // -- a person reading "contains" expects roughly-this-text-is-in-there,
      // not JavaScript's own case-sensitive String.includes().
      expect(
        evaluateCondition(condition("customer.plan", "contains", "Pro"), {
          customer: { plan: "pro" },
        }),
      ).toBe(true);
      expect(
        evaluateCondition(condition("plan", "contains", "PRO"), {
          plan: "approved",
        }),
      ).toBe(true);
    });
  });

  describe("greater_than / less_than", () => {
    it("compares numerically, not lexically", () => {
      // Lexical comparison would put "9" > "10"; numeric comparison must not.
      expect(
        evaluateCondition(condition("count", "greater_than", "9"), {
          count: 10,
        }),
      ).toBe(true);
    });

    it("is false, not an error, when the actual value doesn't parse as a number", () => {
      expect(
        evaluateCondition(condition("age", "greater_than", "18"), {
          age: "eighteen",
        }),
      ).toBe(false);
    });

    it("less_than compares numerically in the other direction", () => {
      expect(
        evaluateCondition(condition("count", "less_than", "10"), {
          count: 9,
        }),
      ).toBe(true);
    });
  });

  describe("field path resolution", () => {
    it("reads a nested field via a dot path", () => {
      expect(
        evaluateCondition(condition("customer.plan", "equals", "pro"), {
          customer: { plan: "pro" },
        }),
      ).toBe(true);
    });

    it("returns undefined, not a throw, when an intermediate segment isn't an object", () => {
      expect(
        evaluateCondition(condition("customer.plan", "equals", "pro"), {
          customer: "not-an-object",
        }),
      ).toBe(false);
    });

    it("a completely missing top-level field never equals a non-empty value", () => {
      expect(
        evaluateCondition(condition("does.not.exist", "equals", "pro"), {}),
      ).toBe(false);
    });
  });
});
