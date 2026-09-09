/**
 * @vitest-environment jsdom
 *
 * `openWorkflow`/`newWorkflow`/`saveWorkflow` write the last-opened workflow
 * id to the real browser `localStorage` (see persistence.ts), which
 * Vitest's default node environment does not provide (Node itself doesn't
 * expose it as a global either). jsdom implements the actual Storage API,
 * so those tests exercise the same code path production runs through,
 * rather than a hand-rolled stand-in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLastOpenedWorkflowId } from "./persistence";
import * as remoteWorkflows from "./remoteWorkflows";
import {
  COLUMN_SPACING,
  NODES_PER_ROW,
  ROW_SPACING,
  useWorkflowStore,
} from "./workflowStore";
import type { Workflow } from "../types";

vi.mock("./remoteWorkflows");

// Every test in this file resets `workflow` explicitly via its own
// `beforeEach`, so a stale localStorage entry can't change what any single
// test observes -- but clearing it up front keeps the remote-workflow
// describe blocks below from ever reading a leftover value written by a
// previous test file sharing this worker.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
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
    // The exact same object, not just structurally equal -- a genuine
    // no-op doesn't bump updatedAt or reallocate arrays.
    expect(after).toBe(before);
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
    expect(after).toBe(before);
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
    const before = useWorkflowStore.getState().workflow;
    useWorkflowStore.getState().updateNode("does-not-exist", { label: "X" });
    const after = useWorkflowStore.getState().workflow;
    expect(after.nodes).toEqual(before.nodes);
    expect(after).toBe(before);
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
    const before = useWorkflowStore.getState().workflow;
    useWorkflowStore.getState().updateNodeConfig("does-not-exist", {
      kind: "event",
      event: "x",
    });
    const after = useWorkflowStore.getState().workflow;
    expect(after.nodes).toEqual(before.nodes);
    expect(after).toBe(before);
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
    const before = useWorkflowStore.getState().workflow;
    useWorkflowStore.getState().moveNode("does-not-exist", { x: 1, y: 1 });
    const after = useWorkflowStore.getState().workflow;
    expect(after.nodes).toEqual(before.nodes);
    expect(after).toBe(before);
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

describe("runWorkflow", () => {
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
                samplePayload: JSON.stringify({ plan: "pro" }),
              },
            },
          },
          {
            id: "C",
            type: "condition",
            position: { x: 100, y: 0 },
            data: {
              label: "C",
              config: { field: "plan", operator: "equals", value: "pro" },
            },
          },
          {
            id: "True1",
            type: "action",
            position: { x: 200, y: -50 },
            data: { label: "True1", config: { kind: "send_email" } },
          },
          {
            id: "False1",
            type: "action",
            position: { x: 200, y: 50 },
            data: { label: "False1", config: { kind: "send_email" } },
          },
        ],
        edges: [
          { id: "A->C", source: "A", target: "C" },
          { id: "C->True1", source: "C", target: "True1", sourceHandle: "true" },
          { id: "C->False1", source: "C", target: "False1", sourceHandle: "false" },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      selectedNodeId: null,
      lastRun: null,
    });
  });

  it("is null before any run", () => {
    expect(useWorkflowStore.getState().lastRun).toBeNull();
  });

  it("records a step per reached node, taking the branch the trigger's sample payload satisfies", () => {
    useWorkflowStore.getState().runWorkflow();

    const steps = useWorkflowStore.getState().lastRun?.steps ?? [];
    const byId = new Map(steps.map((step) => [step.nodeId, step]));

    expect(byId.get("True1")?.status).toBe("success");
    expect(byId.get("False1")?.status).toBe("skipped");
  });

  it("evaluates against the trigger's current sample payload, not a stale one", () => {
    useWorkflowStore.getState().runWorkflow();
    const firstRun = useWorkflowStore.getState().lastRun;

    useWorkflowStore.getState().updateNodeConfig("A", {
      kind: "event",
      event: "test",
      samplePayload: JSON.stringify({ plan: "free" }),
    });
    useWorkflowStore.getState().runWorkflow();
    const secondRun = useWorkflowStore.getState().lastRun;

    const takenBranch = (run: typeof firstRun) =>
      run?.steps.find((step) => step.nodeId === "True1")?.status;

    expect(takenBranch(firstRun)).toBe("success");
    expect(takenBranch(secondRun)).toBe("skipped");
  });

  it("gives each run a unique id and replaces the previous run", () => {
    useWorkflowStore.getState().runWorkflow();
    const firstId = useWorkflowStore.getState().lastRun?.id;

    useWorkflowStore.getState().runWorkflow();
    const secondId = useWorkflowStore.getState().lastRun?.id;

    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(secondId).not.toBe(firstId);
  });
});

describe("isDirty", () => {
  const CLEAN_WORKFLOW: Workflow = {
    id: "test-workflow",
    name: "Test Workflow",
    nodes: [],
    edges: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: CLEAN_WORKFLOW,
      isDirty: false,
      past: [],
      future: [],
      lastCommit: null,
    });
  });

  it("is set by a real edit going through commitWorkflow", () => {
    useWorkflowStore.getState().renameWorkflow("Renamed");
    expect(useWorkflowStore.getState().isDirty).toBe(true);
  });

  it("is left alone by a no-op edit", () => {
    useWorkflowStore.getState().deleteNode("does-not-exist");
    expect(useWorkflowStore.getState().isDirty).toBe(false);
  });

  it("is set by undo and redo, which bypass commitWorkflow", () => {
    useWorkflowStore.getState().renameWorkflow("Renamed");
    useWorkflowStore.setState({ isDirty: false }); // isolate undo's own effect

    useWorkflowStore.getState().undo();
    expect(useWorkflowStore.getState().isDirty).toBe(true);

    useWorkflowStore.setState({ isDirty: false });
    useWorkflowStore.getState().redo();
    expect(useWorkflowStore.getState().isDirty).toBe(true);
  });
});

describe("loadWorkflowList", () => {
  it("populates workflowList from the server", async () => {
    const rows = [
      { id: "w1", name: "One", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "w2", name: "Two", updatedAt: "2026-01-02T00:00:00.000Z" },
    ];
    vi.mocked(remoteWorkflows.listWorkflows).mockResolvedValue(rows);

    await useWorkflowStore.getState().loadWorkflowList();

    expect(useWorkflowStore.getState().workflowList).toEqual(rows);
    expect(useWorkflowStore.getState().isLoadingList).toBe(false);
  });

  it("clears isLoadingList even when the request fails", async () => {
    vi.mocked(remoteWorkflows.listWorkflows).mockRejectedValue(new Error("500"));

    await useWorkflowStore.getState().loadWorkflowList();

    expect(useWorkflowStore.getState().isLoadingList).toBe(false);
  });
});

describe("openWorkflow", () => {
  const FETCHED_WORKFLOW: Workflow = {
    id: "from-server",
    name: "Loaded From Server",
    nodes: [],
    edges: [],
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  };

  beforeEach(() => {
    useWorkflowStore.setState({
      selectedNodeId: "stale-selection",
      past: [{ ...FETCHED_WORKFLOW, name: "Old past entry" }],
      future: [{ ...FETCHED_WORKFLOW, name: "Old future entry" }],
      lastCommit: { key: "renameWorkflow", at: Date.now() },
      isDirty: true,
      isNew: false,
    });
  });

  it("replaces workflow and resets session state (selection, history, dirty flag)", async () => {
    vi.mocked(remoteWorkflows.fetchWorkflow).mockResolvedValue(FETCHED_WORKFLOW);

    await useWorkflowStore.getState().openWorkflow("from-server");

    const state = useWorkflowStore.getState();
    expect(state.workflow).toEqual(FETCHED_WORKFLOW);
    expect(state.selectedNodeId).toBeNull();
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.lastCommit).toBeNull();
    expect(state.isDirty).toBe(false);
    expect(state.isNew).toBe(false);
  });

  it("remembers the opened id as the last-opened workflow", async () => {
    vi.mocked(remoteWorkflows.fetchWorkflow).mockResolvedValue(FETCHED_WORKFLOW);

    await useWorkflowStore.getState().openWorkflow("from-server");

    expect(getLastOpenedWorkflowId()).toBe("from-server");
  });

  it("records saveError and rethrows on failure, leaving workflow untouched", async () => {
    const currentWorkflow = useWorkflowStore.getState().workflow;
    vi.mocked(remoteWorkflows.fetchWorkflow).mockRejectedValue(new Error("404"));

    await expect(useWorkflowStore.getState().openWorkflow("missing")).rejects.toThrow(
      "404",
    );

    expect(useWorkflowStore.getState().workflow).toBe(currentWorkflow);
    expect(useWorkflowStore.getState().saveError).toBe("404");
  });
});

describe("newWorkflow", () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      selectedNodeId: "stale-selection",
      past: [
        {
          id: "x",
          name: "x",
          nodes: [],
          edges: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      isDirty: true,
      isNew: false,
    });
  });

  it("replaces workflow with a fresh, empty, unsaved document", () => {
    useWorkflowStore.getState().newWorkflow();

    const state = useWorkflowStore.getState();
    expect(state.workflow.nodes).toEqual([]);
    expect(state.workflow.edges).toEqual([]);
    expect(state.selectedNodeId).toBeNull();
    expect(state.past).toEqual([]);
    expect(state.isDirty).toBe(false);
    expect(state.isNew).toBe(true);
  });

  it("gives each new workflow a distinct id", () => {
    useWorkflowStore.getState().newWorkflow();
    const firstId = useWorkflowStore.getState().workflow.id;

    useWorkflowStore.getState().newWorkflow();
    const secondId = useWorkflowStore.getState().workflow.id;

    expect(secondId).not.toBe(firstId);
  });
});

describe("saveWorkflow", () => {
  const DRAFT: Workflow = {
    id: "draft-id",
    name: "Draft",
    nodes: [],
    edges: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("creates (POST) when isNew, and clears isNew/isDirty on success", async () => {
    const saved = { ...DRAFT, updatedAt: "2026-01-01T00:05:00.000Z" };
    vi.mocked(remoteWorkflows.createWorkflow).mockResolvedValue(saved);
    useWorkflowStore.setState({ workflow: DRAFT, isNew: true, isDirty: true });

    await useWorkflowStore.getState().saveWorkflow();

    expect(remoteWorkflows.createWorkflow).toHaveBeenCalledWith(
      "draft-id",
      expect.objectContaining({ name: "Draft" }),
    );
    const state = useWorkflowStore.getState();
    expect(state.workflow).toEqual(saved);
    expect(state.isNew).toBe(false);
    expect(state.isDirty).toBe(false);
    expect(state.isSaving).toBe(false);
  });

  it("updates (PUT) when not isNew", async () => {
    const saved = { ...DRAFT, updatedAt: "2026-01-01T00:05:00.000Z" };
    vi.mocked(remoteWorkflows.saveWorkflow).mockResolvedValue(saved);
    useWorkflowStore.setState({ workflow: DRAFT, isNew: false, isDirty: true });

    await useWorkflowStore.getState().saveWorkflow();

    expect(remoteWorkflows.saveWorkflow).toHaveBeenCalledWith(
      "draft-id",
      expect.objectContaining({ name: "Draft" }),
    );
    expect(remoteWorkflows.createWorkflow).not.toHaveBeenCalled();
  });

  it("records saveError and leaves isDirty untouched on failure", async () => {
    vi.mocked(remoteWorkflows.saveWorkflow).mockRejectedValue(new Error("500"));
    useWorkflowStore.setState({ workflow: DRAFT, isNew: false, isDirty: true });

    await useWorkflowStore.getState().saveWorkflow();

    const state = useWorkflowStore.getState();
    expect(state.saveError).toBe("500");
    expect(state.isDirty).toBe(true);
    expect(state.isSaving).toBe(false);
  });

  it("adds a newly-created workflow to workflowList without a separate fetch", async () => {
    const saved = { ...DRAFT, updatedAt: "2026-01-01T00:05:00.000Z" };
    vi.mocked(remoteWorkflows.createWorkflow).mockResolvedValue(saved);
    useWorkflowStore.setState({ workflow: DRAFT, isNew: true, isDirty: true, workflowList: [] });

    await useWorkflowStore.getState().saveWorkflow();

    expect(useWorkflowStore.getState().workflowList).toEqual([
      { id: "draft-id", name: "Draft", description: undefined, updatedAt: saved.updatedAt },
    ]);
    expect(remoteWorkflows.listWorkflows).not.toHaveBeenCalled();
  });

  it("moves an updated workflow to the front of workflowList, replacing its old row", async () => {
    const saved = { ...DRAFT, name: "Renamed", updatedAt: "2026-01-01T00:05:00.000Z" };
    vi.mocked(remoteWorkflows.saveWorkflow).mockResolvedValue(saved);
    useWorkflowStore.setState({
      workflow: { ...DRAFT, name: "Renamed" },
      isNew: false,
      isDirty: true,
      workflowList: [
        { id: "draft-id", name: "Draft", updatedAt: DRAFT.updatedAt },
        { id: "other-id", name: "Other", updatedAt: "2026-01-01T00:01:00.000Z" },
      ],
    });

    await useWorkflowStore.getState().saveWorkflow();

    expect(useWorkflowStore.getState().workflowList).toEqual([
      { id: "draft-id", name: "Renamed", description: undefined, updatedAt: saved.updatedAt },
      { id: "other-id", name: "Other", updatedAt: "2026-01-01T00:01:00.000Z" },
    ]);
  });
});

describe("deleteWorkflow", () => {
  it("removes the row from workflowList", async () => {
    vi.mocked(remoteWorkflows.deleteWorkflow).mockResolvedValue(undefined);
    useWorkflowStore.setState({
      workflowList: [
        { id: "w1", name: "One", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "w2", name: "Two", updatedAt: "2026-01-02T00:00:00.000Z" },
      ],
    });

    await useWorkflowStore.getState().deleteWorkflow("w1");

    expect(useWorkflowStore.getState().workflowList).toEqual([
      { id: "w2", name: "Two", updatedAt: "2026-01-02T00:00:00.000Z" },
    ]);
  });

  it("falls back to a new blank workflow when the currently-open one is deleted", async () => {
    vi.mocked(remoteWorkflows.deleteWorkflow).mockResolvedValue(undefined);
    useWorkflowStore.setState({
      workflow: {
        id: "open-workflow",
        name: "Open",
        nodes: [],
        edges: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    await useWorkflowStore.getState().deleteWorkflow("open-workflow");

    const state = useWorkflowStore.getState();
    expect(state.workflow.id).not.toBe("open-workflow");
    expect(state.isNew).toBe(true);
  });

  it("leaves the currently-open workflow alone when a different one is deleted", async () => {
    vi.mocked(remoteWorkflows.deleteWorkflow).mockResolvedValue(undefined);
    const openWorkflow: Workflow = {
      id: "open-workflow",
      name: "Open",
      nodes: [],
      edges: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    useWorkflowStore.setState({ workflow: openWorkflow });

    await useWorkflowStore.getState().deleteWorkflow("some-other-workflow");

    expect(useWorkflowStore.getState().workflow).toBe(openWorkflow);
  });

  it("records saveError and rethrows on failure, without touching workflowList", async () => {
    vi.mocked(remoteWorkflows.deleteWorkflow).mockRejectedValue(new Error("404"));
    const list = [{ id: "w1", name: "One", updatedAt: "2026-01-01T00:00:00.000Z" }];
    useWorkflowStore.setState({ workflowList: list });

    await expect(useWorkflowStore.getState().deleteWorkflow("w1")).rejects.toThrow(
      "404",
    );

    expect(useWorkflowStore.getState().workflowList).toEqual(list);
    expect(useWorkflowStore.getState().saveError).toBe("404");
  });
});

describe("undo / redo", () => {
  const FIXTURE_WORKFLOW: Workflow = {
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
    ],
    edges: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: FIXTURE_WORKFLOW,
      selectedNodeId: null,
      past: [],
      future: [],
      lastCommit: null,
    });
  });

  it("starts with empty history", () => {
    expect(useWorkflowStore.getState().past).toEqual([]);
    expect(useWorkflowStore.getState().future).toEqual([]);
  });

  it("undo reverts the last action", () => {
    const store = useWorkflowStore.getState();
    store.renameWorkflow("Renamed");
    expect(useWorkflowStore.getState().workflow.name).toBe("Renamed");

    useWorkflowStore.getState().undo();

    expect(useWorkflowStore.getState().workflow.name).toBe("Test Workflow");
  });

  it("redo re-applies an action that was just undone", () => {
    const store = useWorkflowStore.getState();
    store.renameWorkflow("Renamed");
    store.undo();
    expect(useWorkflowStore.getState().workflow.name).toBe("Test Workflow");

    useWorkflowStore.getState().redo();

    expect(useWorkflowStore.getState().workflow.name).toBe("Renamed");
  });

  it("undo is a no-op when there is nothing to undo", () => {
    const before = useWorkflowStore.getState().workflow;
    useWorkflowStore.getState().undo();
    expect(useWorkflowStore.getState().workflow).toBe(before);
  });

  it("redo is a no-op when there is nothing to redo", () => {
    const before = useWorkflowStore.getState().workflow;
    useWorkflowStore.getState().redo();
    expect(useWorkflowStore.getState().workflow).toBe(before);
  });

  it("a new action after undo discards redo history rather than keeping it around", () => {
    const store = useWorkflowStore.getState();
    store.renameWorkflow("First");
    store.undo();
    expect(useWorkflowStore.getState().future).toHaveLength(1);

    store.renameWorkflow("Second");

    expect(useWorkflowStore.getState().future).toEqual([]);
    useWorkflowStore.getState().redo(); // no-op: nothing to redo anymore
    expect(useWorkflowStore.getState().workflow.name).toBe("Second");
  });

  it("undoes several independent actions one at a time, in reverse order", () => {
    // Three genuinely distinct action *types* -- unlike two renameWorkflow
    // calls in a row, none of these share a coalescing key, so each gets
    // its own undo step regardless of timing.
    const store = useWorkflowStore.getState();
    store.renameWorkflow("First");
    store.moveNode("A", { x: 999, y: 999 });
    store.addNode({ type: "action", label: "N1", config: { kind: "send_email" } });

    store.undo();
    expect(
      useWorkflowStore.getState().workflow.nodes.some((node) => node.data.label === "N1"),
    ).toBe(false);

    store.undo();
    expect(
      useWorkflowStore
        .getState()
        .workflow.nodes.find((node) => node.id === "A")?.position,
    ).toEqual({ x: 0, y: 0 });

    store.undo();
    expect(useWorkflowStore.getState().workflow.name).toBe("Test Workflow");
  });

  it("discrete actions (addNode) never coalesce, even called back to back", () => {
    const store = useWorkflowStore.getState();
    store.addNode({ type: "action", label: "N1", config: { kind: "send_email" } });
    store.addNode({ type: "action", label: "N2", config: { kind: "send_email" } });

    expect(useWorkflowStore.getState().past).toHaveLength(2);
  });

  it("coalesces rapid edits to the same node into a single undo step", () => {
    const store = useWorkflowStore.getState();
    store.updateNode("A", { label: "First edit" });
    store.updateNode("A", { label: "Second edit" });

    expect(useWorkflowStore.getState().past).toHaveLength(1);

    store.undo();

    // One undo restores all the way back to before the *first* keystroke,
    // not just the most recent one -- that's the point of coalescing.
    expect(
      useWorkflowStore
        .getState()
        .workflow.nodes.find((node) => node.id === "A")?.data.label,
    ).toBe("A");
  });

  it("does not coalesce edits to two different nodes", () => {
    const store = useWorkflowStore.getState();
    store.updateNode("A", { label: "Edited A" });
    store.updateNode("B", { label: "Edited B" });

    expect(useWorkflowStore.getState().past).toHaveLength(2);

    store.undo();

    // Only B's edit is undone -- A's is a separate, earlier step.
    const nodes = useWorkflowStore.getState().workflow.nodes;
    expect(nodes.find((node) => node.id === "A")?.data.label).toBe("Edited A");
    expect(nodes.find((node) => node.id === "B")?.data.label).toBe("B");
  });

  it("does not coalesce edits separated by more than the coalescing window", () => {
    vi.useFakeTimers();
    try {
      const store = useWorkflowStore.getState();
      store.updateNode("A", { label: "First edit" });
      vi.advanceTimersByTime(900);
      store.updateNode("A", { label: "Second edit" });

      expect(useWorkflowStore.getState().past).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a different action type in between breaks coalescing, even for the same node", () => {
    const store = useWorkflowStore.getState();
    store.updateNode("A", { label: "Edited label" });
    store.updateNodeConfig("A", { kind: "schedule", cron: "0 9 * * *" });

    expect(useWorkflowStore.getState().past).toHaveLength(2);
  });

  it("clears the selection on undo if the restored workflow no longer has that node", () => {
    const store = useWorkflowStore.getState();
    store.addNode({ type: "action", label: "New", config: { kind: "send_email" } });
    const newNodeId = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.data.label === "New")!.id;
    useWorkflowStore.setState({ selectedNodeId: newNodeId });

    store.undo();

    expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
  });

  it("leaves the selection alone on redo when the restored node still exists", () => {
    const store = useWorkflowStore.getState();
    store.addNode({ type: "action", label: "New", config: { kind: "send_email" } });
    store.undo();
    useWorkflowStore.setState({ selectedNodeId: "A" });

    store.redo(); // "New" comes back; "A" was already there both before and after

    expect(useWorkflowStore.getState().selectedNodeId).toBe("A");
  });

  it("clears the selection on redo if the workflow being restored doesn't have that node", () => {
    const store = useWorkflowStore.getState();
    useWorkflowStore.setState({ selectedNodeId: "A" });
    store.deleteNode("A"); // deleteNode's own logic already clears selection here
    store.undo(); // "A" exists again, but selection stays null -- undo never re-selects
    useWorkflowStore.setState({ selectedNodeId: "A" }); // select it again by hand

    store.redo(); // re-applies the delete: "A" is gone once more

    expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
  });

  it("genuine no-ops (an unknown id) do not create an undo step", () => {
    const store = useWorkflowStore.getState();
    store.updateNode("does-not-exist", { label: "X" });

    expect(useWorkflowStore.getState().past).toEqual([]);
  });
});
