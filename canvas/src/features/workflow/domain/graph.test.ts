import { describe, expect, it } from "vitest";

import { canConnect, wouldCreateCycle } from "./graph";
import type { WorkflowEdge, WorkflowNode } from "../types";

const NODES: WorkflowNode[] = [
  {
    id: "A",
    type: "trigger",
    position: { x: 0, y: 0 },
    data: { label: "A", config: { event: "test" } },
  },
  {
    id: "B",
    type: "action",
    position: { x: 100, y: 0 },
    data: { label: "B", config: { action: "test" } },
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

describe("wouldCreateCycle", () => {
  it("detects a direct cycle", () => {
    const edges: WorkflowEdge[] = [
      {
        id: "edge1",
        source: "A",
        target: "B",
      },
    ];

    expect(wouldCreateCycle(edges, "B", "A")).toBe(true);
  });
  it("detects an indirect cycle", () => {
    const edges: WorkflowEdge[] = [
      {
        id: "edge-1",
        source: "A",
        target: "B",
      },
      {
        id: "edge-2",
        source: "B",
        target: "C",
      },
    ];
    expect(wouldCreateCycle(edges, "C", "A")).toBe(true);
  });

  it("allows a valid connection", () => {
    const edges: WorkflowEdge[] = [
      {
        id: "edge1",
        source: "A",
        target: "B",
      },
    ];
    expect(wouldCreateCycle(edges, "A", "C")).toBe(false);
  });

  it("allows connecting two disconnected branches", () => {
    const edges: WorkflowEdge[] = [
      {
        id: "edge1",
        source: "A",
        target: "B",
      },
      {
        id: "edge2",
        source: "C",
        target: "D",
      },
    ];
    expect(wouldCreateCycle(edges, "B", "C")).toBe(false);
  });
  it("handles a longer chain", () => {
    const edges: WorkflowEdge[] = [
      {
        id: "edge-1",
        source: "A",
        target: "B",
      },
      {
        id: "edge-2",
        source: "B",
        target: "C",
      },
      {
        id: "edge-3",
        source: "C",
        target: "D",
      },
    ];

    expect(wouldCreateCycle(edges, "D", "A")).toBe(true);
    expect(wouldCreateCycle(edges, "D", "E")).toBe(false);
  });

  it("handles branching without revisiting nodes", () => {
    const edges: WorkflowEdge[] = [
      {
        id: "edge-1",
        source: "A",
        target: "B",
      },
      {
        id: "edge-2",
        source: "A",
        target: "C",
      },
      {
        id: "edge-3",
        source: "B",
        target: "D",
      },
      {
        id: "edge-4",
        source: "C",
        target: "D",
      },
    ];
    expect(wouldCreateCycle(edges, "D", "A")).toBe(true);
  });
});

describe("canConnect", () => {
  it("allows a valid connection between two non-trigger-target nodes", () => {
    expect(canConnect(NODES, [], "A", "B")).toBe(true);
  });

  it("rejects a self-connection", () => {
    expect(canConnect(NODES, [], "B", "B")).toBe(false);
  });

  it("rejects a connection where either endpoint does not exist", () => {
    expect(canConnect(NODES, [], "does-not-exist", "B")).toBe(false);
    expect(canConnect(NODES, [], "A", "does-not-exist")).toBe(false);
  });

  it("rejects a connection into a trigger node", () => {
    expect(canConnect(NODES, [], "B", "A")).toBe(false);
  });

  it("rejects a duplicate connection", () => {
    const edges: WorkflowEdge[] = [{ id: "edge-1", source: "A", target: "B" }];
    expect(canConnect(NODES, edges, "A", "B")).toBe(false);
  });

  it("rejects a connection that would create a cycle", () => {
    const edges: WorkflowEdge[] = [
      { id: "edge-1", source: "B", target: "C" },
    ];
    expect(canConnect(NODES, edges, "C", "B")).toBe(false);
  });
});
