/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as remoteWorkflows from "../state/remoteWorkflows";
import { useWorkflowStore } from "../state/workflowStore";
import type { Workflow } from "../types";
import { WorkflowHeader } from "./WorkflowHeader";

vi.mock("../state/remoteWorkflows");

const EMPTY_WORKFLOW: Workflow = {
  id: "test-workflow",
  name: "Customer Onboarding",
  nodes: [],
  edges: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const WORKFLOW_WITH_TRIGGER: Workflow = {
  ...EMPTY_WORKFLOW,
  nodes: [
    {
      id: "trigger-1",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { label: "A", config: { kind: "event", event: "test" } },
    },
  ],
};

beforeEach(() => {
  useWorkflowStore.setState({
    workflow: EMPTY_WORKFLOW,
    selectedNodeId: null,
    lastRun: null,
    past: [],
    future: [],
    lastCommit: null,
    workflowList: [],
    isLoadingList: false,
    isSaving: false,
    isDirty: false,
    isNew: true,
    saveError: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkflowHeader", () => {
  it("shows the workflow's current name", () => {
    render(<WorkflowHeader />);

    expect(
      (screen.getByLabelText("Workflow name") as HTMLInputElement).value,
    ).toBe("Customer Onboarding");
  });

  it("editing the name updates the store and the input reflects it", () => {
    render(<WorkflowHeader />);

    const input = screen.getByLabelText("Workflow name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Renamed Workflow" } });

    expect(useWorkflowStore.getState().workflow.name).toBe(
      "Renamed Workflow",
    );
    expect(
      (screen.getByLabelText("Workflow name") as HTMLInputElement).value,
    ).toBe("Renamed Workflow");
  });

  it("disables the Run button when the workflow has no trigger", () => {
    render(<WorkflowHeader />);

    expect(
      screen.getByRole("button", { name: "Run workflow" }),
    ).toHaveProperty("disabled", true);
  });

  it("enables the Run button once a trigger exists", () => {
    useWorkflowStore.setState({ workflow: WORKFLOW_WITH_TRIGGER });
    render(<WorkflowHeader />);

    expect(
      screen.getByRole("button", { name: "Run workflow" }),
    ).toHaveProperty("disabled", false);
  });

  it("clicking Run populates lastRun", () => {
    useWorkflowStore.setState({ workflow: WORKFLOW_WITH_TRIGGER });
    render(<WorkflowHeader />);

    expect(useWorkflowStore.getState().lastRun).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Run workflow" }));

    expect(useWorkflowStore.getState().lastRun).not.toBeNull();
  });

  it("disables Run for a structurally invalid workflow even with a trigger present", () => {
    // This shape can't arise through the app's own actions -- it's the
    // guard against a Workflow that didn't come from them (hand-edited
    // storage, an older schema).
    useWorkflowStore.setState({
      workflow: {
        ...WORKFLOW_WITH_TRIGGER,
        edges: [
          { id: "edge-1", source: "trigger-1", target: "does-not-exist" },
        ],
      },
    });
    render(<WorkflowHeader />);

    const button = screen.getByRole("button", { name: "Run workflow" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("title")).toContain(
      "references a node that no longer exists",
    );
  });

  it("explains via title why Run is disabled when there's no trigger", () => {
    render(<WorkflowHeader />);

    expect(
      screen.getByRole("button", { name: "Run workflow" }).getAttribute("title"),
    ).toBe("Add a trigger node to run this workflow.");
  });

  it("disables Undo and Redo when there is no history", () => {
    render(<WorkflowHeader />);

    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Redo" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("enables Undo once there is a past entry, and clicking it calls undo", () => {
    useWorkflowStore.setState({ past: [EMPTY_WORKFLOW] });
    render(<WorkflowHeader />);

    const undoButton = screen.getByRole("button", { name: "Undo" });
    expect(undoButton).toHaveProperty("disabled", false);

    fireEvent.click(undoButton);

    // The store's own undo() pops `past` -- calling through the button
    // is enough to prove it's wired to the real action, not a stub.
    expect(useWorkflowStore.getState().past).toEqual([]);
  });

  it("enables Redo once there is a future entry, and clicking it calls redo", () => {
    useWorkflowStore.setState({ future: [WORKFLOW_WITH_TRIGGER] });
    render(<WorkflowHeader />);

    const redoButton = screen.getByRole("button", { name: "Redo" });
    expect(redoButton).toHaveProperty("disabled", false);

    fireEvent.click(redoButton);

    expect(useWorkflowStore.getState().workflow).toEqual(WORKFLOW_WITH_TRIGGER);
    expect(useWorkflowStore.getState().future).toEqual([]);
  });

  it("disables Save when there are no unsaved changes", () => {
    render(<WorkflowHeader />);

    expect(screen.getByRole("button", { name: "Save workflow" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("enables Save once the workflow is dirty, and clicking it saves", async () => {
    vi.mocked(remoteWorkflows.createWorkflow).mockResolvedValue({
      ...EMPTY_WORKFLOW,
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    useWorkflowStore.setState({ isDirty: true, isNew: true });
    render(<WorkflowHeader />);

    const saveButton = screen.getByRole("button", { name: "Save workflow" });
    expect(saveButton).toHaveProperty("disabled", false);

    fireEvent.click(saveButton);
    await vi.waitFor(() => expect(useWorkflowStore.getState().isDirty).toBe(false));

    expect(remoteWorkflows.createWorkflow).toHaveBeenCalledWith(
      EMPTY_WORKFLOW.id,
      expect.objectContaining({ name: EMPTY_WORKFLOW.name }),
    );
  });

  it("shows 'Unsaved changes' while dirty and 'Saved' once clean", () => {
    render(<WorkflowHeader />);
    expect(screen.getByText("Saved")).toBeDefined();

    useWorkflowStore.setState({ isDirty: true });
    cleanup();
    render(<WorkflowHeader />);
    expect(screen.getByText("Unsaved changes")).toBeDefined();
  });

  it("shows 'Save failed' when the last save errored", () => {
    useWorkflowStore.setState({ saveError: "Failed to save workflow: 500" });
    render(<WorkflowHeader />);

    expect(screen.getByText("Save failed")).toBeDefined();
  });
});
