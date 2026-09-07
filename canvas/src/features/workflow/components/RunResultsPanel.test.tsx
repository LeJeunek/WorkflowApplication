/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWorkflowStore } from "../state/workflowStore";
import type { Workflow, WorkflowRun } from "../types";
import { RunResultsPanel } from "./RunResultsPanel";

const WORKFLOW: Workflow = {
  id: "test-workflow",
  name: "Test Workflow",
  nodes: [
    {
      id: "trigger-1",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { label: "New Customer", config: { kind: "event", event: "test" } },
    },
    {
      id: "action-1",
      type: "action",
      position: { x: 100, y: 0 },
      data: { label: "Send Welcome Email", config: { kind: "send_email" } },
    },
  ],
  edges: [{ id: "edge-1", source: "trigger-1", target: "action-1" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buildRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "run-1",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:00.000Z",
    steps: [
      {
        nodeId: "trigger-1",
        status: "success",
        detail: 'Started by the "test" event.',
      },
      {
        nodeId: "action-1",
        status: "success",
        detail: "Sent email.",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  useWorkflowStore.setState({
    workflow: WORKFLOW,
    selectedNodeId: null,
    lastRun: null,
  });
});

afterEach(cleanup);

describe("RunResultsPanel", () => {
  it("renders nothing before any run", () => {
    const { container } = render(<RunResultsPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a summary and every step's node label and detail after a run", () => {
    useWorkflowStore.setState({ lastRun: buildRun() });
    render(<RunResultsPanel />);

    expect(screen.getByText("2 succeeded")).toBeDefined();
    expect(screen.getByText("New Customer")).toBeDefined();
    expect(screen.getByText(/Started by the "test" event\./)).toBeDefined();
    expect(screen.getByText("Send Welcome Email")).toBeDefined();
    expect(screen.getByText(/Sent email\./)).toBeDefined();
  });

  it("summarizes a mix of statuses", () => {
    useWorkflowStore.setState({
      lastRun: buildRun({
        steps: [
          { nodeId: "trigger-1", status: "success", detail: "..." },
          { nodeId: "action-1", status: "skipped", detail: "..." },
        ],
      }),
    });
    render(<RunResultsPanel />);

    expect(screen.getByText("1 succeeded · 1 skipped")).toBeDefined();
  });

  it("falls back to a placeholder label for a step whose node no longer exists", () => {
    useWorkflowStore.setState({
      lastRun: buildRun({
        steps: [
          {
            nodeId: "does-not-exist",
            status: "success",
            detail: "Sent email.",
          },
        ],
      }),
    });
    render(<RunResultsPanel />);

    expect(screen.getByText("Deleted step")).toBeDefined();
  });

  it("hides when dismissed", () => {
    useWorkflowStore.setState({ lastRun: buildRun() });
    render(<RunResultsPanel />);

    expect(screen.getByRole("region", { name: "Run results" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss run results" }));

    expect(screen.queryByRole("region", { name: "Run results" })).toBeNull();
  });

  it("reopens for a new run even after the previous one was dismissed", () => {
    useWorkflowStore.setState({ lastRun: buildRun({ id: "run-1" }) });
    const { rerender } = render(<RunResultsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss run results" }));
    expect(screen.queryByRole("region", { name: "Run results" })).toBeNull();

    useWorkflowStore.setState({ lastRun: buildRun({ id: "run-2" }) });
    rerender(<RunResultsPanel />);

    expect(screen.getByRole("region", { name: "Run results" })).toBeDefined();
  });
});
