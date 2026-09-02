/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";

import { useWorkflowStore } from "../state/workflowStore";
import type { Workflow } from "../types";
import { NodePalette } from "./NodePalette";

const EMPTY_WORKFLOW: Workflow = {
  id: "test-workflow",
  name: "Test Workflow",
  nodes: [],
  edges: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  useWorkflowStore.setState({ workflow: EMPTY_WORKFLOW, selectedNodeId: null });
});

afterEach(cleanup);

/**
 * The palette reads the canvas viewport to decide where a new node lands, so
 * it needs React Flow's context even though it renders none of the canvas.
 * jsdom reports a zero-sized pane, which the component falls back on.
 */
function renderPalette() {
  return render(
    <ReactFlowProvider>
      <NodePalette />
    </ReactFlowProvider>,
  );
}

describe("NodePalette", () => {
  it("renders one labelled button per node type", () => {
    renderPalette();

    expect(screen.getByRole("button", { name: "Add Trigger node" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add Action node" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add Condition node" })).toBeDefined();
  });

  it("clicking Trigger adds a trigger node with its default label and config", () => {
    renderPalette();

    fireEvent.click(screen.getByRole("button", { name: "Add Trigger node" }));

    const nodes = useWorkflowStore.getState().workflow.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      type: "trigger",
      data: { label: "New Trigger", config: { event: "customer.created" } },
    });
  });

  it("does not change the current selection when adding a node", () => {
    useWorkflowStore.setState({ selectedNodeId: "some-other-node" });
    renderPalette();

    fireEvent.click(screen.getByRole("button", { name: "Add Action node" }));

    expect(useWorkflowStore.getState().selectedNodeId).toBe("some-other-node");
  });

  it("sequential clicks across types create distinct nodes with unique ids, in click order", () => {
    renderPalette();

    fireEvent.click(screen.getByRole("button", { name: "Add Trigger node" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Action node" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Condition node" }));

    const nodes = useWorkflowStore.getState().workflow.nodes;
    expect(nodes.map((node) => node.type)).toEqual([
      "trigger",
      "action",
      "condition",
    ]);
    expect(new Set(nodes.map((node) => node.id)).size).toBe(3);
  });
});
