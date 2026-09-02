/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWorkflowStore } from "../state/workflowStore";
import type { Workflow } from "../types";
import { Inspector } from "./Inspector";

const BASE_WORKFLOW: Workflow = {
  id: "test-workflow",
  name: "Test Workflow",
  nodes: [
    {
      id: "trigger-1",
      type: "trigger" as const,
      position: { x: 0, y: 0 },
      data: {
        label: "Trigger A",
        config: { kind: "event" as const, event: "customer.created" },
      },
    },
    {
      id: "action-1",
      type: "action" as const,
      position: { x: 100, y: 0 },
      data: { label: "Action A", config: { kind: "send_email" as const } },
    },
    {
      id: "condition-1",
      type: "condition" as const,
      position: { x: 200, y: 0 },
      data: {
        label: "Condition A",
        config: { field: "status", operator: "equals", value: "active" },
      },
    },
  ],
  edges: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  useWorkflowStore.setState({ workflow: BASE_WORKFLOW, selectedNodeId: null });
});

afterEach(cleanup);

describe("Inspector", () => {
  it("shows the empty state and no form controls when nothing is selected", () => {
    render(<Inspector />);

    expect(
      screen.getByText("Select a node to inspect its properties."),
    ).toBeDefined();
    expect(screen.queryByLabelText("Label")).toBeNull();
  });

  it("editing the label updates the store and the input reflects the new value", () => {
    useWorkflowStore.setState({ selectedNodeId: "trigger-1" });
    render(<Inspector />);

    const input = screen.getByLabelText("Label") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Renamed trigger" } });

    expect(
      useWorkflowStore
        .getState()
        .workflow.nodes.find((node) => node.id === "trigger-1")?.data.label,
    ).toBe("Renamed trigger");
    expect(
      (screen.getByLabelText("Label") as HTMLInputElement).value,
    ).toBe("Renamed trigger");
  });

  it("shows and edits the trigger's Event field", () => {
    useWorkflowStore.setState({ selectedNodeId: "trigger-1" });
    render(<Inspector />);

    const event = screen.getByLabelText("Event") as HTMLInputElement;
    expect(event.value).toBe("customer.created");

    fireEvent.change(event, { target: { value: "customer.updated" } });

    expect(
      useWorkflowStore
        .getState()
        .workflow.nodes.find((node) => node.id === "trigger-1")?.data.config,
    ).toEqual({ kind: "event", event: "customer.updated" });
  });

  it("shows and edits the action's Recipient field for the default Send email kind", () => {
    useWorkflowStore.setState({ selectedNodeId: "action-1" });
    render(<Inspector />);

    const kind = screen.getByLabelText("Kind") as HTMLSelectElement;
    expect(kind.value).toBe("send_email");

    const recipient = screen.getByLabelText("Recipient") as HTMLInputElement;
    expect(recipient.value).toBe("");

    fireEvent.change(recipient, { target: { value: "ops@example.com" } });

    const nodeAfter = useWorkflowStore
      .getState()
      .workflow.nodes.find((node) => node.id === "action-1");
    expect(nodeAfter?.data.config).toEqual({
      kind: "send_email",
      recipient: "ops@example.com",
    });
  });

  it("switching the action's Kind to HTTP request replaces the config and shows URL and Method", () => {
    useWorkflowStore.setState({ selectedNodeId: "action-1" });
    render(<Inspector />);

    const kind = screen.getByLabelText("Kind") as HTMLSelectElement;
    fireEvent.change(kind, { target: { value: "http_request" } });

    expect(screen.queryByLabelText("Recipient")).toBeNull();

    const url = screen.getByLabelText("URL") as HTMLInputElement;
    const method = screen.getByLabelText("Method") as HTMLSelectElement;
    expect(url.value).toBe("");
    expect(method.value).toBe("GET");

    fireEvent.change(url, { target: { value: "https://example.com/hook" } });
    fireEvent.change(method, { target: { value: "POST" } });

    expect(
      useWorkflowStore
        .getState()
        .workflow.nodes.find((node) => node.id === "action-1")?.data.config,
    ).toEqual({
      kind: "http_request",
      url: "https://example.com/hook",
      method: "POST",
    });
  });

  it("shows and edits the condition's Field, Operator, and Value fields", () => {
    useWorkflowStore.setState({ selectedNodeId: "condition-1" });
    render(<Inspector />);

    const operator = screen.getByLabelText("Operator") as HTMLSelectElement;
    expect(operator.value).toBe("equals");

    fireEvent.change(operator, { target: { value: "contains" } });

    expect(
      useWorkflowStore
        .getState()
        .workflow.nodes.find((node) => node.id === "condition-1")?.data.config,
    ).toEqual({ field: "status", operator: "contains", value: "active" });
  });

  it("reflects a newly selected node's fields instead of stale data from the previous selection", () => {
    useWorkflowStore.setState({ selectedNodeId: "trigger-1" });
    const { rerender } = render(<Inspector />);
    expect(screen.getByLabelText("Label")).toHaveProperty("value", "Trigger A");

    useWorkflowStore.setState({ selectedNodeId: "action-1" });
    rerender(<Inspector />);

    expect(screen.getByLabelText("Label")).toHaveProperty("value", "Action A");
    expect(screen.queryByLabelText("Event")).toBeNull();
    expect(screen.getByLabelText("Recipient")).toBeDefined();
  });

  it("shows the empty state when the selected id has no matching node", () => {
    useWorkflowStore.setState({ selectedNodeId: "does-not-exist" });
    render(<Inspector />);

    expect(
      screen.getByText("Select a node to inspect its properties."),
    ).toBeDefined();
  });
});
