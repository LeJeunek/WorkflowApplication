import { beforeEach, describe, expect, it } from "vitest";

import {
  COLUMN_SPACING,
  NODES_PER_ROW,
  ROW_SPACING,
  useWorkflowStore,
} from "./workflowStore";

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
                action: "test",
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
      event: "customer.update",
    });
    const nodeA = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "A");
    expect(nodeA?.data.config).toEqual({ event: "customer.update" });
  });

  it("updates an action config", () => {
    useWorkflowStore.getState().updateNodeConfig("B", {
      action: "send_email",
    });
    const nodeB = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "B");
    expect(nodeB?.data.config).toEqual({ action: "send_email" });
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
  // The reducer's own runtime duck-type guard is the only thing standing
  // between this and a trigger node ending up with an action's config.
  it("ignores a config update whose shape does not match the target node's type", () => {
    useWorkflowStore.getState().updateNodeConfig("A", { action: "send_email" });

    const nodeA = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "A");

    expect(nodeA?.data.config).toEqual({ event: "test" });
  });

  it("replaces the config wholesale rather than merging with the previous value", () => {
    const store = useWorkflowStore.getState();
    store.updateNodeConfig("B", {
      action: "send_email",
      recipient: "ops@example.com",
    });
    store.updateNodeConfig("B", { action: "send_sms" });

    const nodeB = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "B");

    expect(nodeB?.data.config).toEqual({ action: "send_sms" });
  });

  it("does nothing when updating config for an unknown node id", () => {
    const before = useWorkflowStore.getState().workflow.nodes;
    useWorkflowStore.getState().updateNodeConfig("does-not-exist", {
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
      config: { event: "test" },
    });

    const node = useWorkflowStore.getState().workflow.nodes[0];
    expect(node.position).toEqual({ x: 0, y: 0 });
    expect(node.data.label).toBe("");
  });

  it("places nodes left to right across a row using the column spacing", () => {
    const store = useWorkflowStore.getState();
    store.addNode({ type: "trigger", label: "N0", config: { event: "test" } });
    store.addNode({ type: "action", label: "N1", config: { action: "test" } });
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
        config: { event: "test" },
      });
    }
    store.addNode({ type: "trigger", label: "overflow", config: { event: "test" } });

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
    store.addNode({ type: "trigger", label: "N0", config: { event: "test" } });
    store.addNode({ type: "action", label: "N1", config: { action: "test" } });
    store.addNode({
      type: "condition",
      label: "N2",
      config: { field: "", operator: "equals", value: "" },
    });

    const middleNodeId = useWorkflowStore.getState().workflow.nodes[1].id;
    store.deleteNode(middleNodeId);

    store.addNode({ type: "trigger", label: "N3", config: { event: "test" } });

    const positions = useWorkflowStore
      .getState()
      .workflow.nodes.map((node) => `${node.position.x},${node.position.y}`);

    expect(new Set(positions).size).toBe(positions.length);
  });

  it("assigns every node a unique id", () => {
    const store = useWorkflowStore.getState();
    store.addNode({ type: "trigger", label: "N0", config: { event: "test" } });
    store.addNode({ type: "trigger", label: "N1", config: { event: "test" } });

    const ids = useWorkflowStore.getState().workflow.nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses an explicit position when provided, bypassing auto-placement", () => {
    useWorkflowStore.getState().addNode({
      type: "trigger",
      label: "Explicit",
      position: { x: 999, y: -50 },
      config: { event: "test" },
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
            data: { label: "A", config: { event: "test" } },
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
