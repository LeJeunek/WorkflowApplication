/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as remoteWorkflows from "../state/remoteWorkflows";
import { useWorkflowStore } from "../state/workflowStore";
import type { Workflow, WorkflowSummary } from "../types";
import { WorkflowSwitcher } from "./WorkflowSwitcher";

vi.mock("../state/remoteWorkflows");

const CURRENT_WORKFLOW: Workflow = {
  id: "current",
  name: "Current Workflow",
  nodes: [],
  edges: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const OTHER_ROW: WorkflowSummary = {
  id: "other",
  name: "Other Workflow",
  updatedAt: "2026-02-03T00:00:00.000Z",
};

beforeEach(() => {
  useWorkflowStore.setState({
    workflow: CURRENT_WORKFLOW,
    workflowList: [
      { id: "current", name: "Current Workflow", updatedAt: "2026-01-01T00:00:00.000Z" },
      OTHER_ROW,
    ],
    selectedNodeId: null,
    lastRun: null,
    past: [],
    future: [],
    lastCommit: null,
    isDirty: false,
    isNew: false,
    saveError: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkflowSwitcher", () => {
  it("does not show the list until opened", () => {
    render(<WorkflowSwitcher />);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("lists every saved workflow when opened", () => {
    render(<WorkflowSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "Switch workflow" }));

    expect(screen.getByRole("menuitem", { name: /Current Workflow/ })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: /Other Workflow/ })).toBeDefined();
  });

  it("clicking a row opens that workflow", () => {
    vi.mocked(remoteWorkflows.fetchWorkflow).mockResolvedValue({
      ...CURRENT_WORKFLOW,
      id: "other",
      name: "Other Workflow",
    });
    render(<WorkflowSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "Switch workflow" }));

    fireEvent.click(screen.getByRole("menuitem", { name: /Other Workflow/ }));

    expect(remoteWorkflows.fetchWorkflow).toHaveBeenCalledWith("other");
  });

  it("clicking New workflow replaces the current document with a blank one", () => {
    render(<WorkflowSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "Switch workflow" }));

    fireEvent.click(screen.getByRole("menuitem", { name: "New workflow" }));

    expect(useWorkflowStore.getState().workflow.id).not.toBe("current");
    expect(useWorkflowStore.getState().workflow.nodes).toEqual([]);
  });

  it("deleting a row calls deleteWorkflow after confirmation", () => {
    vi.mocked(remoteWorkflows.deleteWorkflow).mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<WorkflowSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "Switch workflow" }));

    fireEvent.click(screen.getByRole("button", { name: 'Delete "Other Workflow"' }));

    expect(remoteWorkflows.deleteWorkflow).toHaveBeenCalledWith("other");
  });

  it("does not delete when the confirmation is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<WorkflowSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "Switch workflow" }));

    fireEvent.click(screen.getByRole("button", { name: 'Delete "Other Workflow"' }));

    expect(remoteWorkflows.deleteWorkflow).not.toHaveBeenCalled();
  });

  it("closes when clicking outside", () => {
    render(
      <div>
        <WorkflowSwitcher />
        <button type="button">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Switch workflow" }));
    expect(screen.getByRole("menu")).toBeDefined();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));

    expect(screen.queryByRole("menu")).toBeNull();
  });
});
