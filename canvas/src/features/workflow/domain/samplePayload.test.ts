import { describe, expect, it } from "vitest";

import {
  buildPayload,
  defaultValueForType,
  flattenPayload,
  nextFieldName,
} from "./samplePayload";
import type { PayloadField } from "./samplePayload";

describe("flattenPayload", () => {
  it("returns no rows for undefined or empty text", () => {
    expect(flattenPayload(undefined)).toEqual([]);
    expect(flattenPayload("")).toEqual([]);
    expect(flattenPayload("   ")).toEqual([]);
  });

  it("returns no rows for invalid JSON, matching how a run treats it", () => {
    expect(flattenPayload("{not valid")).toEqual([]);
  });

  it("flattens a flat object into one row per key, typed as text", () => {
    expect(flattenPayload('{"plan": "pro"}')).toEqual([
      { path: "plan", type: "text", value: "pro" },
    ]);
  });

  it("dot-joins nested object keys", () => {
    expect(
      flattenPayload('{"customer": {"id": "cust_1", "plan": "pro"}}'),
    ).toEqual([
      { path: "customer.id", type: "text", value: "cust_1" },
      { path: "customer.plan", type: "text", value: "pro" },
    ]);
  });

  it("infers number, boolean, and null types from the leaf's real type", () => {
    expect(
      flattenPayload('{"seats": 5, "active": true, "note": null}'),
    ).toEqual([
      { path: "seats", type: "number", value: "5" },
      { path: "active", type: "boolean", value: "true" },
      { path: "note", type: "null", value: "" },
    ]);
  });

  it("keeps an array as a single row of JSON type", () => {
    expect(flattenPayload('{"tags": ["vip", "beta"]}')).toEqual([
      { path: "tags", type: "json", value: '["vip","beta"]' },
    ]);
  });
});

describe("buildPayload", () => {
  it("builds an empty object from no rows", () => {
    expect(buildPayload([])).toBe("{}");
  });

  it("drops a row with a blank path", () => {
    expect(
      buildPayload([{ path: "  ", type: "text", value: "pro" }]),
    ).toBe("{}");
  });

  it("nests multiple rows sharing a dot-path prefix into the same object", () => {
    const rows: PayloadField[] = [
      { path: "customer.id", type: "text", value: "cust_1" },
      { path: "customer.plan", type: "text", value: "pro" },
    ];
    expect(JSON.parse(buildPayload(rows))).toEqual({
      customer: { id: "cust_1", plan: "pro" },
    });
  });

  it("resolves each row by its declared type, not by guessing", () => {
    const rows: PayloadField[] = [
      { path: "plan", type: "text", value: "true" },
      { path: "seats", type: "number", value: "5" },
      { path: "active", type: "boolean", value: "true" },
      { path: "note", type: "null", value: "anything" },
      { path: "tags", type: "json", value: '["vip","beta"]' },
    ];
    expect(JSON.parse(buildPayload(rows))).toEqual({
      plan: "true",
      seats: 5,
      active: true,
      note: null,
      tags: ["vip", "beta"],
    });
  });

  it("keeps a number row's text as-is while it doesn't parse yet, rather than coercing it", () => {
    expect(
      JSON.parse(buildPayload([{ path: "balance", type: "number", value: "-" }])),
    ).toEqual({ balance: "-" });
  });

  it("keeps a json row's text as-is while it doesn't parse yet", () => {
    expect(
      JSON.parse(buildPayload([{ path: "tags", type: "json", value: "[1," }])),
    ).toEqual({ tags: "[1," });
  });

  it("a boolean row is always exactly true or false, regardless of its text", () => {
    expect(
      JSON.parse(
        buildPayload([{ path: "active", type: "boolean", value: "nonsense" }]),
      ),
    ).toEqual({ active: false });
  });

  it("round-trips through flattenPayload for a nested payload", () => {
    const original =
      '{"customer":{"id":"cust_1","plan":"pro"},"seats":5,"active":true,"note":null,"tags":["a"]}';
    const rebuilt = buildPayload(flattenPayload(original));
    expect(JSON.parse(rebuilt)).toEqual(JSON.parse(original));
  });
});

describe("nextFieldName", () => {
  it("returns field1 when there are no rows yet", () => {
    expect(nextFieldName([])).toBe("field1");
  });

  it("skips names already used by existing rows", () => {
    const rows: PayloadField[] = [
      { path: "field1", type: "text", value: "" },
      { path: "field2", type: "text", value: "" },
    ];
    expect(nextFieldName(rows)).toBe("field3");
  });

  it("finds the first free slot rather than always appending", () => {
    const rows: PayloadField[] = [
      { path: "field1", type: "text", value: "" },
      { path: "field3", type: "text", value: "" },
    ];
    expect(nextFieldName(rows)).toBe("field2");
  });
});

describe("defaultValueForType", () => {
  it("keeps the current text for text and json", () => {
    expect(defaultValueForType("text", "pro")).toBe("pro");
    expect(defaultValueForType("json", '["a"]')).toBe('["a"]');
  });

  it("keeps a number-valid current value, defaults to 0 otherwise", () => {
    expect(defaultValueForType("number", "42")).toBe("42");
    expect(defaultValueForType("number", "pro")).toBe("0");
    expect(defaultValueForType("number", "")).toBe("0");
  });

  it("keeps true/false as-is, defaults to true otherwise", () => {
    expect(defaultValueForType("boolean", "false")).toBe("false");
    expect(defaultValueForType("boolean", "pro")).toBe("true");
  });

  it("is always empty for null", () => {
    expect(defaultValueForType("null", "anything")).toBe("");
  });
});
