import { describe, expect, it } from "vitest";

import { validateWorkflow } from "./validation";
import type { Workflow, WorkflowEdge } from "../types";

const NODES: Workflow["nodes"] = [
  {
    id: "A",
    type: "trigger",
    position: { x: 0, y: 0 },
    data: { label: "A", config: { kind: "event", event: "test" } },
  },
  {
    id: "B",
    type: "action",
    position: { x: 100, y: 0 },
    data: { label: "B", config: { kind: "send_email" } },
  },
  {
    id: "C",
    type: "condition",
    position: { x: 200, y: 0 },
    data: {
      label: "C",
      config: { field: "test", operator: "equals", value: "test" },
    },
  },
];

function buildWorkflow(edges: WorkflowEdge[]): Workflow {
  return {
    id: "test-workflow",
    name: "Test Workflow",
    nodes: NODES,
    edges,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("validateWorkflow", () => {
  it("reports a fully valid workflow as valid", () => {
    const workflow = buildWorkflow([
      { id: "edge-1", source: "A", target: "B" },
      { id: "edge-2", source: "B", target: "C" },
    ]);

    expect(validateWorkflow(workflow)).toEqual({ valid: true });
  });

  it("reports an empty workflow as valid", () => {
    expect(validateWorkflow(buildWorkflow([]))).toEqual({ valid: true });
  });

  it("flags a dangling edge", () => {
    const workflow = buildWorkflow([
      { id: "edge-1", source: "A", target: "does-not-exist" },
    ]);

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result).not.toEqual({ valid: true });
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "dangling-edge", edgeId: "edge-1" }),
      );
    }
  });

  it("flags a self-loop", () => {
    const workflow = buildWorkflow([
      { id: "edge-1", source: "B", target: "B" },
    ]);

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "self-loop", edgeId: "edge-1" }),
      );
    }
  });

  it("flags a duplicate edge", () => {
    const workflow = buildWorkflow([
      { id: "edge-1", source: "A", target: "B" },
      { id: "edge-2", source: "A", target: "B" },
    ]);

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "duplicate-edge", edgeId: "edge-2" }),
      );
      // The first occurrence of the pair is not itself the duplicate.
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ code: "duplicate-edge", edgeId: "edge-1" }),
      );
    }
  });

  it("flags every edge that participates in a cycle", () => {
    const workflow = buildWorkflow([
      { id: "edge-1", source: "B", target: "C" },
      { id: "edge-2", source: "C", target: "B", sourceHandle: "true" },
    ]);

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const cycleEdgeIds = result.errors
        .filter((error) => error.code === "cycle")
        .map((error) => error.edgeId);
      expect(cycleEdgeIds).toEqual(
        expect.arrayContaining(["edge-1", "edge-2"]),
      );
    }
  });

  it("flags an edge into a trigger node", () => {
    const workflow = buildWorkflow([
      { id: "edge-1", source: "B", target: "A" },
    ]);

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "trigger-has-incoming-edge",
          nodeId: "A",
          edgeId: "edge-1",
        }),
      );
    }
  });

  it("does not flag two branches of one condition reaching the same node", () => {
    const workflow = buildWorkflow([
      { id: "edge-1", source: "C", target: "B", sourceHandle: "true" },
      { id: "edge-2", source: "C", target: "B", sourceHandle: "false" },
    ]);

    const result = validateWorkflow(workflow);
    if (!result.valid) {
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ code: "duplicate-edge" }),
      );
    }
  });

  it("flags an edge leaving a condition without a branch", () => {
    const workflow = buildWorkflow([
      { id: "edge-1", source: "C", target: "B" },
    ]);

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "missing-branch", nodeId: "C" }),
      );
    }
  });

  it("flags a branch on an edge leaving a non-condition node", () => {
    const workflow = buildWorkflow([
      { id: "edge-1", source: "A", target: "B", sourceHandle: "true" },
    ]);

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "unexpected-branch", nodeId: "A" }),
      );
    }
  });

  it("collects multiple distinct errors instead of stopping at the first", () => {
    const workflow = buildWorkflow([
      { id: "edge-1", source: "B", target: "A" }, // trigger-has-incoming-edge
      // C is a condition, so this carries a branch -- otherwise it would
      // also (correctly) report missing-branch and muddy what's asserted.
      {
        id: "edge-2",
        source: "C",
        target: "does-not-exist",
        sourceHandle: "true",
      }, // dangling-edge
    ]);

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const codes = result.errors.map((error) => error.code).sort();
      expect(codes).toEqual(
        ["dangling-edge", "trigger-has-incoming-edge"].sort(),
      );
    }
  });
});
