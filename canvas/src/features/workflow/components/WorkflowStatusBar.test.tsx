/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWorkflowStore } from "../state/workflowStore";
import type { Workflow } from "../types";
import { WorkflowStatusBar } from "./WorkflowStatusBar";

const VALID_WORKFLOW: Workflow = {
  id: "test-workflow",
  name: "Test Workflow",
  nodes: [
    {
      id: "trigger-1",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { label: "A", config: { kind: "event", event: "test" } },
    },
    {
      id: "action-1",
      type: "action",
      position: { x: 100, y: 0 },
      data: { label: "B", config: { kind: "send_email" } },
    },
  ],
  edges: [{ id: "edge-1", source: "trigger-1", target: "action-1" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  useWorkflowStore.setState({ workflow: VALID_WORKFLOW, selectedNodeId: null });
});

afterEach(cleanup);

describe("WorkflowStatusBar", () => {
  it("shows Valid when the workflow has no structural issues", () => {
    render(<WorkflowStatusBar />);

    expect(screen.getByText("Valid")).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows an issue count and explanatory message for a structurally broken workflow", () => {
    useWorkflowStore.setState({
      workflow: {
        ...VALID_WORKFLOW,
        // A dangling edge: this shape can't arise through the app's own
        // actions (deleteNode cascades edge removal), which is exactly why
        // this check exists -- it's a guard against a Workflow that didn't
        // come from those actions, e.g. hand-edited storage.
        edges: [{ id: "edge-1", source: "trigger-1", target: "does-not-exist" }],
      },
    });
    render(<WorkflowStatusBar />);

    expect(screen.queryByText("Valid")).toBeNull();
    expect(screen.getByText("1 issue")).toBeDefined();

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toContain(
      "references a node that no longer exists",
    );
  });

  it("pluralizes the issue count for more than one problem", () => {
    useWorkflowStore.setState({
      workflow: {
        ...VALID_WORKFLOW,
        edges: [
          { id: "edge-1", source: "trigger-1", target: "does-not-exist" },
          { id: "edge-2", source: "action-1", target: "trigger-1" },
        ],
      },
    });
    render(<WorkflowStatusBar />);

    expect(screen.getByText("2 issues")).toBeDefined();
  });
});
