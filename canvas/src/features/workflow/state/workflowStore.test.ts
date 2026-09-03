/**
 * @vitest-environment jsdom
 *
 * The store's persistence uses the real browser `localStorage`, which
 * Vitest's default node environment does not provide (Node itself doesn't
 * expose it as a global either). jsdom implements the actual Storage API,
 * so the persistence tests below exercise the same code path production
 * runs through, rather than a hand-rolled stand-in.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { PERSISTENCE_KEY, PERSISTENCE_VERSION } from "./persistence";
import {
  COLUMN_SPACING,
  NODES_PER_ROW,
  ROW_SPACING,
  useWorkflowStore,
} from "./workflowStore";
import type { Workflow } from "../types";

// Every test in this file resets `workflow` explicitly via its own
// `beforeEach`, so a stale localStorage entry can't change what any single
// test observes -- but clearing it up front keeps the persistence
// describe block below from ever reading a leftover value written by a
// previous test file sharing this worker.
beforeEach(() => {
  localStorage.clear();
});

// Testing the connectNodes function in the workflowStore

describe("connectNodes", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: {
        id: "test-workflow",
        name: "Test Workflow",
        nodes: [
          {
            id: "A",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: {
              label: "A",
              config: {
                kind: "event",
                event: "test",
              },
            },
          },
          {
            id: "B",
            type: "action",
            position: { x: 100, y: 0 },
            data: {
              label: "B",
              config: {
                kind: "send_email",
              },
            },
          },
          {
            id: "C",
            type: "condition",
            position: { x: 200, y: 0 },
            data: {
              label: "C",
              config: {
                field: "test",
                operator: "equals",
                value: "test",
              },
            },
          },
        ],
        edges: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
    });
  });
  it("adds a valid connection", () => {
    useWorkflowStore.getState().connectNodes("A", "B");
    const edges = useWorkflowStore.getState().workflow.edges;

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: "A",
      target: "B",
    });
  });

  it("rejects a self connection", () => {
    useWorkflowStore.getState().connectNodes("A", "A");

    expect(useWorkflowStore.getState().workflow.edges).toHaveLength(0);
  });

  it("rejects a duplicate connection", () => {
    const store = useWorkflowStore.getState();

    store.connectNodes("A", "B");
    store.connectNodes("A", "B");

    expect(useWorkflowStore.getState().workflow.edges).toHaveLength(1);
  });

  it("rejects a connection that creates a cycle", () => {
    const store = useWorkflowStore.getState();
    store.connectNodes("A", "B");
    store.connectNodes("B", "C");
    store.connectNodes("C", "A");

    const edges = useWorkflowStore.getState().workflow.edges;

    expect(edges).toHaveLength(2);
    expect(edges).not.toContainEqual(
      expect.objectContaining({
        source: "C",
        target: "A",
      }),
    );
  });

  it("rejects a connection when either endpoint does not correspond to a node", () => {
    const store = useWorkflowStore.getState();
    store.connectNodes("does-not-exist", "B");
    store.connectNodes("A", "does-not-exist");

    expect(useWorkflowStore.getState().workflow.edges).toHaveLength(0);
  });

  it("rejects a connection into a trigger node", () => {
    // A is the trigger in this fixture; nothing should ever point into it.
    useWorkflowStore.getState().connectNodes("B", "A");

    expect(useWorkflowStore.getState().workflow.edges).toHaveLength(0);
  });

  it("records the branch an edge leaves a condition from", () => {
    // C is the condition in this fixture.
    useWorkflowStore.getState().connectNodes("C", "B", "true");

    const edges = useWorkflowStore.getState().workflow.edges;
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: "C",
      target: "B",
      sourceHandle: "true",
    });
  });

  it("omits sourceHandle entirely for an unbranched edge", () => {
    useWorkflowStore.getState().connectNodes("A", "B");

    const edge = useWorkflowStore.getState().workflow.edges[0];
    expect(Object.prototype.hasOwnProperty.call(edge, "sourceHandle")).toBe(
      false,
    );
  });

  it("allows both branches of a condition to reach the same node", () => {
    const store = useWorkflowStore.getState();
    store.connectNodes("C", "B", "true");
    store.connectNodes("C", "B", "false");

    expect(useWorkflowStore.getState().workflow.edges).toHaveLength(2);
  });

  it("still rejects the same branch reaching the same node twice", () => {
    const store = useWorkflowStore.getState();
    store.connectNodes("C", "B", "true");
    store.connectNodes("C", "B", "true");

    expect(useWorkflowStore.getState().workflow.edges).toHaveLength(1);
  });

  it("rejects an edge leaving a condition with no branch", () => {
    useWorkflowStore.getState().connectNodes("C", "B");

    expect(useWorkflowStore.getState().workflow.edges).toHaveLength(0);
  });
});

describe("deleteNode", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: {
        id: "test-workflow",
        name: "Test Workflow",
        nodes: [
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
        ],
        edges: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
    });
  });
  it("deletes a node", () => {
    useWorkflowStore.getState().deleteNode("B");
    const nodes = useWorkflowStore.getState().workflow.nodes;
    expect(nodes).toHaveLength(2);
    expect(nodes.some((node) => node.id === "B")).toBe(false);
  });
  it("removes edges connected to the deleted node", () => {
    useWorkflowStore.setState((state) => ({
      workflow: {
        ...state.workflow,
        edges: [
          { id: "edge-1", source: "A", target: "B" },
          { id: "edge-2", source: "B", target: "C" },
          { id: "edge-3", source: "A", target: "C" },
        ],
      },
    }));
    useWorkflowStore.getState().deleteNode("B");
    const edges = useWorkflowStore.getState().workflow.edges;
    expect(edges).toEqual([{ id: "edge-3", source: "A", target: "C" }]);
  });
  it("clears selection when the selected node is deleted", () => {
    useWorkflowStore.setState({ selectedNodeId: "B" });
    useWorkflowStore.getState().deleteNode("B");
    expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
  });
  it("preserves selection when another node is deleted", () => {
    useWorkflowStore.setState({ selectedNodeId: "A" });
    useWorkflowStore.getState().deleteNode("B");
    expect(useWorkflowStore.getState().selectedNodeId).toBe("A");
  });
  it("does nothing when deleting an unknown node", () => {
    const before = useWorkflowStore.getState().workflow;
    useWorkflowStore.getState().deleteNode("does-not-exist");
    const after = useWorkflowStore.getState().workflow;
    expect(after.nodes).toEqual(before.nodes);
    expect(after.edges).toEqual(before.edges);
  });
  it("clears selection and removes connected edges together when the selected node is deleted", () => {
    useWorkflowStore.setState((state) => ({
      workflow: {
        ...state.workflow,
        edges: [
          { id: "edge-1", source: "A", target: "B" },
          { id: "edge-2", source: "B", target: "C" },
        ],
      },
      selectedNodeId: "B",
    }));
    useWorkflowStore.getState().deleteNode("B");
    const state = useWorkflowStore.getState();
    expect(state.workflow.nodes.some((node) => node.id === "B")).toBe(false);
    expect(state.workflow.edges).toEqual([]);
    expect(state.selectedNodeId).toBeNull();
  });
  it("removes the last remaining node, leaving an empty nodes array", () => {
    useWorkflowStore.getState().deleteNode("A");
    useWorkflowStore.getState().deleteNode("B");
    useWorkflowStore.getState().deleteNode("C");
    expect(useWorkflowStore.getState().workflow.nodes).toEqual([]);
  });
});

describe("deleteEdge", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: {
        id: "test-workflow",
        name: "Test Workflow",
        nodes: [
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
        ],
        edges: [
          { id: "edge-1", source: "A", target: "B" },
          { id: "edge-2", source: "B", target: "C" },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
    });
  });
  it("deletes an edge", () => {
    useWorkflowStore.getState().deleteEdge("edge-1");
    const edges = useWorkflowStore.getState().workflow.edges;
    expect(edges).toEqual([{ id: "edge-2", source: "B", target: "C" }]);
  });
  it("does nothing when deleting an unknown edge id", () => {
    const before = useWorkflowStore.getState().workflow;
    useWorkflowStore.getState().deleteEdge("does-not-exist");
    const after = useWorkflowStore.getState().workflow;
    expect(after.edges).toEqual(before.edges);
  });
  it("leaves nodes and the current selection untouched", () => {
    useWorkflowStore.setState({ selectedNodeId: "A" });
    const nodesBefore = useWorkflowStore.getState().workflow.nodes;

    useWorkflowStore.getState().deleteEdge("edge-1");

    const state = useWorkflowStore.getState();
    expect(state.workflow.nodes).toEqual(nodesBefore);
    expect(state.selectedNodeId).toBe("A");
  });
});

//Update node
describe("updateNode", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: {
        id: "test-workflow",
        name: "Test Workflow",
        nodes: [
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
        ],
        edges: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
    });
  });
  it("updates a node's label", () => {
    useWorkflowStore.getState().updateNode("B", {
      label: "Updated B",
    });

    const nodeB = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "B");

    expect(nodeB).toBeDefined();
    expect(nodeB?.data.label).toBe("Updated B");
  });

  it("updates a node's description", () => {
    useWorkflowStore.getState().updateNode("B", {
      description: "This is the updated description for B",
    });

    const nodeB = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "B");

    expect(nodeB?.data.description).toBe(
      "This is the updated description for B",
    );
  });

  it("updating the label preserves a previously set description", () => {
    const store = useWorkflowStore.getState();
    store.updateNode("A", { description: "Fires on signup" });
    store.updateNode("A", { label: "Renamed" });

    const nodeA = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "A");

    expect(nodeA?.data.label).toBe("Renamed");
    expect(nodeA?.data.description).toBe("Fires on signup");
  });

  it("updates label and description together in one call", () => {
    useWorkflowStore.getState().updateNode("C", {
      label: "Renamed C",
      description: "New description",
    });

    const nodeC = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "C");

    expect(nodeC?.data.label).toBe("Renamed C");
    expect(nodeC?.data.description).toBe("New description");
  });

  it("accepts an empty label without rejecting it", () => {
    useWorkflowStore.getState().updateNode("B", { label: "" });

    const nodeB = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "B");

    expect(nodeB?.data.label).toBe("");
  });

  it("does nothing when updating an unknown node id", () => {
    const before = useWorkflowStore.getState().workflow.nodes;
    useWorkflowStore.getState().updateNode("does-not-exist", { label: "X" });
    expect(useWorkflowStore.getState().workflow.nodes).toEqual(before);
  });
});

describe("updateNodeConfig", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: {
        id: "test-workflow",
        name: "Test Workflow",
        nodes: [
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
        ],
        edges: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
    });
  });
  it("updates a trigger config", () => {
    useWorkflowStore.getState().updateNodeConfig("A", {
      kind: "event",
      event: "customer.update",
    });
    const nodeA = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "A");
    expect(nodeA?.data.config).toEqual({
      kind: "event",
      event: "customer.update",
    });
  });

  it("updates an action config", () => {
    useWorkflowStore.getState().updateNodeConfig("B", {
      kind: "send_email",
      recipient: "ops@example.com",
    });
    const nodeB = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "B");
    expect(nodeB?.data.config).toEqual({
      kind: "send_email",
      recipient: "ops@example.com",
    });
  });

  it("updates a condition config", () => {
    useWorkflowStore.getState().updateNodeConfig("C", {
      field: "status",
      operator: "equals",
      value: "active",
    });
    const nodeC = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "C");
    expect(nodeC?.data.config).toEqual({
      field: "status",
      operator: "equals",
      value: "active",
    });
  });

  // The store's signature is `updateNodeConfig(id, config)`, with no type
  // link between `id` and `config` -- TypeScript accepts this call even
  // though node "A" is a trigger and the config shape is an ActionConfig.
  // The reducer's own runtime `isTriggerConfig`/`isActionConfig` guards are
  // the only thing standing between this and a trigger node ending up with
  // an action's config.
  it("ignores a config update whose shape does not match the target node's type", () => {
    useWorkflowStore
      .getState()
      .updateNodeConfig("A", { kind: "send_email" });

    const nodeA = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "A");

    expect(nodeA?.data.config).toEqual({ kind: "event", event: "test" });
  });

  it("replaces the config wholesale rather than merging with the previous value, even across kinds", () => {
    const store = useWorkflowStore.getState();
    store.updateNodeConfig("B", {
      kind: "send_email",
      recipient: "ops@example.com",
    });
    store.updateNodeConfig("B", {
      kind: "http_request",
      url: "https://example.com/hook",
      method: "GET",
    });

    const nodeB = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "B");

    // If this merged instead of replacing, the stale `recipient` field from
    // the send_email variant would still be present alongside url/method.
    expect(nodeB?.data.config).toEqual({
      kind: "http_request",
      url: "https://example.com/hook",
      method: "GET",
    });
  });

  it("does nothing when updating config for an unknown node id", () => {
    const before = useWorkflowStore.getState().workflow.nodes;
    useWorkflowStore.getState().updateNodeConfig("does-not-exist", {
      kind: "event",
      event: "x",
    });
    expect(useWorkflowStore.getState().workflow.nodes).toEqual(before);
  });
});

describe("addNode", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: {
        id: "test-workflow",
        name: "Test Workflow",
        nodes: [],
        edges: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
    });
  });

  it("places the first node at the grid origin and stores an empty label as-is", () => {
    useWorkflowStore.getState().addNode({
      type: "trigger",
      label: "",
      config: { kind: "event", event: "test" },
    });

    const node = useWorkflowStore.getState().workflow.nodes[0];
    expect(node.position).toEqual({ x: 0, y: 0 });
    expect(node.data.label).toBe("");
  });

  it("places nodes left to right across a row using the column spacing", () => {
    const store = useWorkflowStore.getState();
    store.addNode({ type: "trigger", label: "N0", config: { kind: "event", event: "test" } });
    store.addNode({ type: "action", label: "N1", config: { kind: "send_email" } });
    store.addNode({
      type: "condition",
      label: "N2",
      config: { field: "", operator: "equals", value: "" },
    });

    const positions = useWorkflowStore
      .getState()
      .workflow.nodes.map((node) => node.position);

    expect(positions).toEqual([
      { x: 0, y: 0 },
      { x: COLUMN_SPACING, y: 0 },
      { x: COLUMN_SPACING * 2, y: 0 },
    ]);
  });

  it("wraps to a new row exactly at the NODES_PER_ROW boundary", () => {
    const store = useWorkflowStore.getState();
    for (let i = 0; i < NODES_PER_ROW; i += 1) {
      store.addNode({
        type: "trigger",
        label: `N${i}`,
        config: { kind: "event", event: "test" },
      });
    }
    store.addNode({ type: "trigger", label: "overflow", config: { kind: "event", event: "test" } });

    const positions = useWorkflowStore
      .getState()
      .workflow.nodes.map((node) => node.position);

    expect(positions[NODES_PER_ROW - 1]).toEqual({
      x: (NODES_PER_ROW - 1) * COLUMN_SPACING,
      y: 0,
    });
    expect(positions[NODES_PER_ROW]).toEqual({ x: 0, y: ROW_SPACING });
  });

  it("does not place a new node on top of a survivor after deleting a mid-sequence node", () => {
    const store = useWorkflowStore.getState();
    store.addNode({ type: "trigger", label: "N0", config: { kind: "event", event: "test" } });
    store.addNode({ type: "action", label: "N1", config: { kind: "send_email" } });
    store.addNode({
      type: "condition",
      label: "N2",
      config: { field: "", operator: "equals", value: "" },
    });

    const middleNodeId = useWorkflowStore.getState().workflow.nodes[1].id;
    store.deleteNode(middleNodeId);

    store.addNode({ type: "trigger", label: "N3", config: { kind: "event", event: "test" } });

    const positions = useWorkflowStore
      .getState()
      .workflow.nodes.map((node) => `${node.position.x},${node.position.y}`);

    expect(new Set(positions).size).toBe(positions.length);
  });

  it("snaps a supplied origin onto the shared grid instead of using it verbatim", () => {
    useWorkflowStore.getState().addNode({
      type: "trigger",
      label: "N0",
      // 20 and 15 are well inside the nearest grid cell rather than on it,
      // proving the store snaps rather than offsetting by the raw value.
      origin: { x: 20, y: 15 },
      config: { kind: "event", event: "test" },
    });

    const node = useWorkflowStore.getState().workflow.nodes[0];
    expect(node.position).toEqual({ x: 0, y: 0 });
  });

  it("never overlaps an existing node even when successive calls supply drifting origins", () => {
    // Simulates the palette's viewport-derived origin, which shifts by a few
    // pixels between adds as the canvas pans -- without snapping to a shared
    // grid, each call would search its own grid and could place a node
    // directly on top of one placed under a different origin.
    const store = useWorkflowStore.getState();
    store.addNode({
      type: "trigger",
      label: "N0",
      origin: { x: 4, y: -6 },
      config: { kind: "event", event: "test" },
    });
    store.addNode({
      type: "action",
      label: "N1",
      origin: { x: -9, y: 3 },
      config: { kind: "send_email" },
    });
    store.addNode({
      type: "condition",
      label: "N2",
      origin: { x: 118, y: -71 },
      config: { field: "", operator: "equals", value: "" },
    });

    const positions = useWorkflowStore
      .getState()
      .workflow.nodes.map((node) => `${node.position.x},${node.position.y}`);

    expect(new Set(positions).size).toBe(positions.length);
  });

  it("assigns every node a unique id", () => {
    const store = useWorkflowStore.getState();
    store.addNode({ type: "trigger", label: "N0", config: { kind: "event", event: "test" } });
    store.addNode({ type: "trigger", label: "N1", config: { kind: "event", event: "test" } });

    const ids = useWorkflowStore.getState().workflow.nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses an explicit position when provided, bypassing auto-placement", () => {
    useWorkflowStore.getState().addNode({
      type: "trigger",
      label: "Explicit",
      position: { x: 999, y: -50 },
      config: { kind: "event", event: "test" },
    });

    expect(useWorkflowStore.getState().workflow.nodes[0].position).toEqual({
      x: 999,
      y: -50,
    });
  });
});

describe("moveNode", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: {
        id: "test-workflow",
        name: "Test Workflow",
        nodes: [
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
        ],
        edges: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
    });
  });

  it("updates the position of the target node", () => {
    useWorkflowStore.getState().moveNode("B", { x: 321, y: 654 });

    const nodeB = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "B");
    expect(nodeB?.position).toEqual({ x: 321, y: 654 });
  });

  it("leaves other nodes' positions and data unchanged", () => {
    const before = useWorkflowStore.getState().workflow.nodes;
    const nodeABefore = before.find((node) => node.id === "A");
    const nodeCBefore = before.find((node) => node.id === "C");

    useWorkflowStore.getState().moveNode("B", { x: 321, y: 654 });

    const after = useWorkflowStore.getState().workflow.nodes;
    expect(after.find((node) => node.id === "A")).toEqual(nodeABefore);
    expect(after.find((node) => node.id === "C")).toEqual(nodeCBefore);
  });

  it("does nothing when moving an unknown node id", () => {
    const before = useWorkflowStore.getState().workflow.nodes;
    useWorkflowStore.getState().moveNode("does-not-exist", { x: 1, y: 1 });
    expect(useWorkflowStore.getState().workflow.nodes).toEqual(before);
  });
});

describe("setSelectedNodeId", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: {
        id: "test-workflow",
        name: "Test Workflow",
        nodes: [
          {
            id: "A",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: { label: "A", config: { kind: "event", event: "test" } },
          },
        ],
        edges: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
    });
  });

  it("sets the selected node id", () => {
    useWorkflowStore.getState().setSelectedNodeId("A");
    expect(useWorkflowStore.getState().selectedNodeId).toBe("A");
  });

  it("clears the selection when set to null", () => {
    useWorkflowStore.setState({ selectedNodeId: "A" });
    useWorkflowStore.getState().setSelectedNodeId(null);
    expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
  });

  it("accepts an id with no matching node, leaving lookup to the reader", () => {
    useWorkflowStore.getState().setSelectedNodeId("does-not-exist");
    expect(useWorkflowStore.getState().selectedNodeId).toBe("does-not-exist");
  });

  it("does not modify workflow nodes or edges", () => {
    const before = useWorkflowStore.getState().workflow;
    useWorkflowStore.getState().setSelectedNodeId("A");
    expect(useWorkflowStore.getState().workflow).toBe(before);
  });
});

describe("renameWorkflow", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: {
        id: "test-workflow",
        name: "Test Workflow",
        nodes: [],
        edges: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
    });
  });

  it("renames the workflow", () => {
    useWorkflowStore.getState().renameWorkflow("Customer Onboarding");
    expect(useWorkflowStore.getState().workflow.name).toBe(
      "Customer Onboarding",
    );
  });

  it("accepts an empty name without rejecting it", () => {
    useWorkflowStore.getState().renameWorkflow("");
    expect(useWorkflowStore.getState().workflow.name).toBe("");
  });

  it("does not modify nodes or edges", () => {
    const before = useWorkflowStore.getState().workflow;
    useWorkflowStore.getState().renameWorkflow("Renamed");
    const after = useWorkflowStore.getState().workflow;
    expect(after.nodes).toEqual(before.nodes);
    expect(after.edges).toEqual(before.edges);
  });
});

describe("persistence", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: {
        id: "test-workflow",
        name: "Test Workflow",
        nodes: [],
        edges: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
    });
  });

  function readPersistedValue(): { state: { workflow: Workflow; selectedNodeId?: unknown }; version: number } {
    const raw = localStorage.getItem(PERSISTENCE_KEY);
    if (raw === null) {
      throw new Error(`Nothing persisted under "${PERSISTENCE_KEY}"`);
    }
    return JSON.parse(raw);
  }

  it("persists a change under the configured key and version", () => {
    useWorkflowStore.getState().renameWorkflow("Persisted Name");

    const persisted = readPersistedValue();
    expect(persisted.version).toBe(PERSISTENCE_VERSION);
    expect(persisted.state.workflow.name).toBe("Persisted Name");
  });

  it("does not persist selectedNodeId, which is ephemeral UI state", () => {
    useWorkflowStore.getState().setSelectedNodeId("some-node");

    const persisted = readPersistedValue();
    expect(persisted.state.selectedNodeId).toBeUndefined();
    expect(useWorkflowStore.getState().selectedNodeId).toBe("some-node");
  });

  it("rehydrates the store from a previously persisted workflow", async () => {
    const persistedWorkflow: Workflow = {
      id: "from-storage",
      name: "Loaded From Storage",
      nodes: [],
      edges: [],
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    };
    localStorage.setItem(
      PERSISTENCE_KEY,
      JSON.stringify({
        state: { workflow: persistedWorkflow },
        version: PERSISTENCE_VERSION,
      }),
    );

    await useWorkflowStore.persist.rehydrate();

    expect(useWorkflowStore.getState().workflow).toEqual(persistedWorkflow);
  });
});
