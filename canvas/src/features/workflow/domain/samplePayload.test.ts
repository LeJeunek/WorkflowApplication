import { describe, expect, it } from "vitest";

import { buildPayload, flattenPayload, nextFieldName } from "./samplePayload";
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

  it("flattens a flat object into one row per key", () => {
    expect(flattenPayload('{"plan": "pro", "seats": 5}')).toEqual([
      { path: "plan", value: "pro" },
      { path: "seats", value: "5" },
    ]);
  });

  it("dot-joins nested object keys", () => {
    expect(
      flattenPayload(
        '{"customer": {"id": "cust_1", "plan": "pro"}}',
      ),
    ).toEqual([
      { path: "customer.id", value: "cust_1" },
      { path: "customer.plan", value: "pro" },
    ]);
  });

  it("keeps arrays and other non-object leaves as a single row of JSON text", () => {
    expect(flattenPayload('{"tags": ["vip", "beta"]}')).toEqual([
      { path: "tags", value: '["vip","beta"]' },
    ]);
  });

  it("renders non-string leaves (number, boolean, null) as their JSON text", () => {
    expect(
      flattenPayload('{"seats": 5, "active": true, "note": null}'),
    ).toEqual([
      { path: "seats", value: "5" },
      { path: "active", value: "true" },
      { path: "note", value: "null" },
    ]);
  });
});

describe("buildPayload", () => {
  it("builds an empty object from no rows", () => {
    expect(buildPayload([])).toBe("{}");
  });

  it("drops a row with a blank path", () => {
    expect(buildPayload([{ path: "  ", value: "pro" }])).toBe("{}");
  });

  it("builds flat keys from flat paths", () => {
    expect(JSON.parse(buildPayload([{ path: "plan", value: "pro" }]))).toEqual(
      { plan: "pro" },
    );
  });

  it("nests multiple rows sharing a dot-path prefix into the same object", () => {
    const rows: PayloadField[] = [
      { path: "customer.id", value: "cust_1" },
      { path: "customer.plan", value: "pro" },
    ];
    expect(JSON.parse(buildPayload(rows))).toEqual({
      customer: { id: "cust_1", plan: "pro" },
    });
  });

  it("parses a value that's valid JSON into its real type", () => {
    const rows: PayloadField[] = [
      { path: "seats", value: "5" },
      { path: "active", value: "true" },
      { path: "note", value: "null" },
      { path: "tags", value: '["vip","beta"]' },
    ];
    expect(JSON.parse(buildPayload(rows))).toEqual({
      seats: 5,
      active: true,
      note: null,
      tags: ["vip", "beta"],
    });
  });

  it("keeps a value that isn't valid JSON as a plain string", () => {
    expect(
      JSON.parse(buildPayload([{ path: "plan", value: "pro" }])),
    ).toEqual({ plan: "pro" });
  });

  it("round-trips through flattenPayload for a nested payload", () => {
    const original = '{"customer":{"id":"cust_1","plan":"pro"},"seats":5}';
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
      { path: "field1", value: "" },
      { path: "field2", value: "" },
    ];
    expect(nextFieldName(rows)).toBe("field3");
  });

  it("finds the first free slot rather than always appending", () => {
    const rows: PayloadField[] = [
      { path: "field1", value: "" },
      { path: "field3", value: "" },
    ];
    expect(nextFieldName(rows)).toBe("field2");
  });
});
