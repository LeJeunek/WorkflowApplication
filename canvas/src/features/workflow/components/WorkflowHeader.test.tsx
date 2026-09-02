/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWorkflowStore } from "../state/workflowStore";
import type { Workflow } from "../types";
import { WorkflowHeader } from "./WorkflowHeader";

const EMPTY_WORKFLOW: Workflow = {
  id: "test-workflow",
  name: "Customer Onboarding",
  nodes: [],
  edges: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  useWorkflowStore.setState({ workflow: EMPTY_WORKFLOW, selectedNodeId: null });
});

afterEach(cleanup);

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
});
