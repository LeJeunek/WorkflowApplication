/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

import { useWorkflowStore } from "../state/workflowStore";
import { WorkflowNode } from "./WorkflowNode";
import type { WorkflowFlowNode, WorkflowNodeViewData } from "./WorkflowNode";

beforeEach(() => {
  // WorkflowNode reads lastRun directly from the store (see the badge
  // tests below); resetting it here keeps every other test in this file
  // -- which never touch the store at all -- from seeing a leftover run.
  useWorkflowStore.setState({ lastRun: null });
});

afterEach(cleanup);

/**
 * WorkflowNode is rendered directly rather than inside a full `<ReactFlow>`
 * canvas: only its own props drive what's under test, so the canvas
 * runtime -- and jsdom's lack of ResizeObserver -- would only add
 * flakiness. `ReactFlowProvider` is still required because `<Handle>`
 * reads from React Flow's internal store context.
 */
function renderNode(node: ReactElement) {
  return render(<ReactFlowProvider>{node}</ReactFlowProvider>);
}
function buildProps(
  overrides: Partial<NodeProps<WorkflowFlowNode>> & { data: WorkflowNodeViewData },
): NodeProps<WorkflowFlowNode> {
  return {
    id: "node-1",
    type: "trigger",
    dragging: false,
    zIndex: 0,
    selectable: true,
    deletable: true,
    draggable: true,
    selected: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    ...overrides,
  };
}

describe("WorkflowNode", () => {
  it("renders the node's kicker and label", () => {
    renderNode(
      <WorkflowNode
        {...buildProps({
          type: "action",
          data: { label: "Send welcome email" },
        })}
      />,
    );

    expect(screen.getByText("Action")).toBeDefined();
    expect(screen.getByText("Send welcome email")).toBeDefined();
  });

  it("renders the description when provided", () => {
    renderNode(
      <WorkflowNode
        {...buildProps({
          data: { label: "New Customer", description: "Runs on signup" },
        })}
      />,
    );

    expect(screen.getByText("Runs on signup")).toBeDefined();
  });

  it("omits the description paragraph when absent", () => {
    const { container } = renderNode(
      <WorkflowNode {...buildProps({ data: { label: "New Customer" } })} />,
    );

    // Only the label paragraph should be present in the body section.
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("gives a trigger a source handle but no target handle", () => {
    const { container } = renderNode(
      <WorkflowNode
        {...buildProps({ type: "trigger", data: { label: "New Customer" } })}
      />,
    );

    expect(container.querySelectorAll(".react-flow__handle.target")).toHaveLength(0);
    expect(container.querySelectorAll(".react-flow__handle.source")).toHaveLength(1);
  });

  it("gives an action one target handle and one unnamed source handle", () => {
    const { container } = renderNode(
      <WorkflowNode
        {...buildProps({ type: "action", data: { label: "Send email" } })}
      />,
    );

    expect(container.querySelectorAll(".react-flow__handle.target")).toHaveLength(1);
    const sources = container.querySelectorAll(".react-flow__handle.source");
    expect(sources).toHaveLength(1);
    expect(sources[0].getAttribute("data-handleid")).toBeNull();
  });

  it("gives a condition two source handles named true and false", () => {
    const { container } = renderNode(
      <WorkflowNode
        {...buildProps({ type: "condition", data: { label: "Is active?" } })}
      />,
    );

    const sources = container.querySelectorAll(".react-flow__handle.source");
    expect(
      [...sources].map((handle) => handle.getAttribute("data-handleid")),
    ).toEqual(["true", "false"]);

    expect(screen.getByText("True")).toBeDefined();
    expect(screen.getByText("False")).toBeDefined();
  });

  it("applies the accent border only when selected", () => {
    const { container: unselected } = renderNode(
      <WorkflowNode
        {...buildProps({ data: { label: "New Customer" }, selected: false })}
      />,
    );
    const { container: selected } = renderNode(
      <WorkflowNode
        {...buildProps({ data: { label: "New Customer" }, selected: true })}
      />,
    );

    expect(unselected.firstElementChild?.className).not.toContain("border-accent");
    expect(selected.firstElementChild?.className).toContain("border-accent");
  });

  describe("run status badge", () => {
    function setLastRunStep(
      status: "success" | "failure" | "skipped",
      detail = "test detail",
    ) {
      useWorkflowStore.setState({
        lastRun: {
          id: "run-1",
          startedAt: "2026-01-01T00:00:00.000Z",
          finishedAt: "2026-01-01T00:00:00.000Z",
          steps: [{ nodeId: "node-1", status, detail }],
        },
      });
    }

    it("shows no badge when the workflow has never been run", () => {
      const { container } = renderNode(
        <WorkflowNode {...buildProps({ data: { label: "New Customer" } })} />,
      );

      expect(container.querySelector('[role="status"]')).toBeNull();
    });

    it("shows no badge for a node absent from the last run's steps", () => {
      setLastRunStep("success");

      const { container } = renderNode(
        <WorkflowNode
          {...buildProps({
            id: "some-other-node",
            data: { label: "New Customer" },
          })}
        />,
      );

      expect(container.querySelector('[role="status"]')).toBeNull();
    });

    it("shows a success badge with the step's detail as its accessible name", () => {
      setLastRunStep("success", "Ran action \"Send welcome email\".");

      const { container } = renderNode(
        <WorkflowNode {...buildProps({ data: { label: "New Customer" } })} />,
      );

      const badge = container.querySelector('[role="status"]');
      expect(badge).not.toBeNull();
      expect(badge?.getAttribute("aria-label")).toContain(
        "Ran action \"Send welcome email\".",
      );
    });

    it("shows a distinct badge for a skipped step", () => {
      setLastRunStep("skipped", "Not reached: the branch leading here was not taken.");

      const { container } = renderNode(
        <WorkflowNode {...buildProps({ data: { label: "New Customer" } })} />,
      );

      expect(
        container.querySelector('[role="status"]')?.getAttribute("aria-label"),
      ).toContain("Skipped");
    });

    it("shows a distinct badge for a failure step", () => {
      setLastRunStep("failure", "Something went wrong.");

      const { container } = renderNode(
        <WorkflowNode {...buildProps({ data: { label: "New Customer" } })} />,
      );

      expect(
        container.querySelector('[role="status"]')?.getAttribute("aria-label"),
      ).toContain("Failed");
    });
  });
});
