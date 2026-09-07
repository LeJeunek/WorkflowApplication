import { describe, expect, it } from "vitest";

import { isSamplePayloadValid, runWorkflow } from "./execution";
import type {
  ActionNode,
  ConditionNode,
  ConditionOperator,
  TriggerNode,
  Workflow,
  WorkflowEdge,
} from "../types";

function trigger(
  id: string,
  samplePayload?: Record<string, unknown>,
  label = id,
): TriggerNode {
  return {
    id,
    type: "trigger",
    position: { x: 0, y: 0 },
    data: {
      label,
      config: {
        kind: "event",
        event: "customer.created",
        ...(samplePayload
          ? { samplePayload: JSON.stringify(samplePayload) }
          : {}),
      },
    },
  };
}

function action(id: string, label = id): ActionNode {
  return {
    id,
    type: "action",
    position: { x: 0, y: 0 },
    data: { label, config: { kind: "send_email" } },
  };
}

function condition(
  id: string,
  field: string,
  operator: ConditionOperator,
  value: string,
): ConditionNode {
  return {
    id,
    type: "condition",
    position: { x: 0, y: 0 },
    data: { label: id, config: { field, operator, value } },
  };
}

function edge(
  source: string,
  target: string,
  sourceHandle?: "true" | "false",
): WorkflowEdge {
  return {
    id: `${source}->${target}${sourceHandle ? `:${sourceHandle}` : ""}`,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
  };
}

function buildWorkflow(
  nodes: Workflow["nodes"],
  edges: WorkflowEdge[],
): Workflow {
  return {
    id: "test-workflow",
    name: "Test Workflow",
    nodes,
    edges,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("runWorkflow", () => {
  it("runs a linear trigger -> action -> action chain in order, all succeeding", () => {
    const workflow = buildWorkflow(
      [trigger("A"), action("B"), action("C")],
      [edge("A", "B"), edge("B", "C")],
    );

    const steps = runWorkflow(workflow);

    expect(steps.map((step) => step.nodeId)).toEqual(["A", "B", "C"]);
    expect(steps.every((step) => step.status === "success")).toBe(true);
  });

  it("takes the true branch and marks the false branch's whole subtree skipped", () => {
    const workflow = buildWorkflow(
      [
        trigger("A", { plan: "pro" }),
        condition("C", "plan", "equals", "pro"),
        action("True1"),
        action("False1"),
        action("False2"), // downstream of False1, not directly of C
      ],
      [
        edge("A", "C"),
        edge("C", "True1", "true"),
        edge("C", "False1", "false"),
        edge("False1", "False2"),
      ],
    );

    const steps = runWorkflow(workflow);
    const byId = new Map(steps.map((step) => [step.nodeId, step]));

    expect(byId.get("True1")?.status).toBe("success");
    expect(byId.get("False1")?.status).toBe("skipped");
    // The whole untaken subtree is recorded, not just the branch's first node.
    expect(byId.get("False2")?.status).toBe("skipped");
  });

  it("takes the false branch when the condition evaluates to false", () => {
    const workflow = buildWorkflow(
      [
        trigger("A", { plan: "free" }),
        condition("C", "plan", "equals", "pro"),
        action("True1"),
        action("False1"),
      ],
      [
        edge("A", "C"),
        edge("C", "True1", "true"),
        edge("C", "False1", "false"),
      ],
    );

    const steps = runWorkflow(workflow);
    const byId = new Map(steps.map((step) => [step.nodeId, step]));

    expect(byId.get("False1")?.status).toBe("success");
    expect(byId.get("True1")?.status).toBe("skipped");
  });

  it("records exactly one success step for a node both branches converge on, never a duplicate", () => {
    const workflow = buildWorkflow(
      [
        trigger("A", { plan: "pro" }),
        condition("C", "plan", "equals", "pro"),
        action("D"),
      ],
      [edge("A", "C"), edge("C", "D", "true"), edge("C", "D", "false")],
    );

    const steps = runWorkflow(workflow);
    const dSteps = steps.filter((step) => step.nodeId === "D");

    expect(dSteps).toHaveLength(1);
    expect(dSteps[0].status).toBe("success");
  });

  it("runs every trigger, independently", () => {
    const workflow = buildWorkflow(
      [trigger("A1"), trigger("A2"), action("B1"), action("B2")],
      [edge("A1", "B1"), edge("A2", "B2")],
    );

    const steps = runWorkflow(workflow);
    const ids = steps.map((step) => step.nodeId);

    expect(ids).toEqual(expect.arrayContaining(["A1", "A2", "B1", "B2"]));
    expect(ids).toHaveLength(4);
  });

  it("evaluates conditions against only the first trigger's sample payload, not a later one's", () => {
    // A1 comes first in node order and carries plan: "pro"; A2 carries a
    // conflicting plan: "free". If the second trigger's data leaked in,
    // the condition downstream of A1 would (wrongly) take the false branch.
    const workflow = buildWorkflow(
      [
        trigger("A1", { plan: "pro" }),
        trigger("A2", { plan: "free" }),
        condition("C", "plan", "equals", "pro"),
        action("True1"),
        action("False1"),
      ],
      [
        edge("A1", "C"),
        edge("C", "True1", "true"),
        edge("C", "False1", "false"),
      ],
    );

    const steps = runWorkflow(workflow);
    const byId = new Map(steps.map((step) => [step.nodeId, step]));

    expect(byId.get("True1")?.status).toBe("success");
    expect(byId.get("False1")?.status).toBe("skipped");
  });

  it("produces no steps for a structurally invalid workflow", () => {
    const workflow = buildWorkflow(
      [trigger("A")],
      [edge("A", "does-not-exist")], // dangling edge
    );

    expect(runWorkflow(workflow)).toEqual([]);
  });

  it("falls back to an empty payload when the trigger's sample data is missing or invalid JSON", () => {
    const workflow = buildWorkflow(
      [trigger("A"), condition("C", "plan", "equals", "pro"), action("D")],
      [edge("A", "C"), edge("C", "D", "true")],
    );
    // No samplePayload set at all -- config.samplePayload is undefined.
    (workflow.nodes[0] as TriggerNode).data.config = {
      kind: "event",
      event: "customer.created",
      samplePayload: "{not valid json",
    };

    const steps = runWorkflow(workflow);
    const byId = new Map(steps.map((step) => [step.nodeId, step]));

    // "plan" is absent from an empty payload, so equals "pro" is false --
    // this doesn't throw, it just never takes the true branch.
    expect(byId.get("D")?.status).toBe("skipped");
  });

  it("describes a condition's step with which branch was taken", () => {
    const workflow = buildWorkflow(
      [trigger("A", { plan: "pro" }), condition("C", "plan", "equals", "pro")],
      [edge("A", "C")],
    );

    const steps = runWorkflow(workflow);
    const conditionStep = steps.find((step) => step.nodeId === "C");

    expect(conditionStep?.detail).toContain("true");
  });

  it("narrates a condition's field, operator, and value in plain language", () => {
    const workflow = buildWorkflow(
      [trigger("A", { plan: "pro" }), condition("C", "plan", "equals", "pro")],
      [edge("A", "C")],
    );

    const steps = runWorkflow(workflow);
    const conditionStep = steps.find((step) => step.nodeId === "C");

    expect(conditionStep?.detail).toBe(
      'Checked whether "plan" equals "pro" -- it was true, so this took the True path.',
    );
  });

  it("narrates a failed comparison and the False path taken", () => {
    const workflow = buildWorkflow(
      [
        trigger("A", { plan: "free" }),
        condition("C", "plan", "contains", "pro"),
      ],
      [edge("A", "C")],
    );

    const steps = runWorkflow(workflow);
    const conditionStep = steps.find((step) => step.nodeId === "C");

    expect(conditionStep?.detail).toBe(
      'Checked whether "plan" contains "pro" -- it was false, so this took the False path.',
    );
  });

  it("describes a skipped step in plain language", () => {
    const workflow = buildWorkflow(
      [
        trigger("A", { plan: "pro" }),
        condition("C", "plan", "equals", "pro"),
        action("True1"),
        action("False1"),
      ],
      [
        edge("A", "C"),
        edge("C", "True1", "true"),
        edge("C", "False1", "false"),
      ],
    );

    const steps = runWorkflow(workflow);
    const skippedStep = steps.find((step) => step.nodeId === "False1");

    expect(skippedStep?.detail).toBe(
      "This step was skipped because the workflow took a different path.",
    );
  });
});

describe("isSamplePayloadValid", () => {
  it("accepts JSON that parses to a plain object", () => {
    expect(isSamplePayloadValid('{"plan": "pro"}')).toBe(true);
  });

  it("rejects malformed JSON", () => {
    expect(isSamplePayloadValid("{not valid json")).toBe(false);
  });

  it("rejects JSON that parses but isn't a plain object", () => {
    expect(isSamplePayloadValid("[1, 2, 3]")).toBe(false);
    expect(isSamplePayloadValid("5")).toBe(false);
    expect(isSamplePayloadValid("null")).toBe(false);
  });

  it("treats undefined and empty/whitespace text as valid, not an error", () => {
    // Matches the doc comment on TriggerConfig: an unconfigured sample
    // payload is a normal state, not a mistake the user needs to fix.
    expect(isSamplePayloadValid(undefined)).toBe(true);
    expect(isSamplePayloadValid("")).toBe(true);
    expect(isSamplePayloadValid("   ")).toBe(true);
  });
});

describe("trigger and action step detail text", () => {
  function runSingleNodeWorkflow(node: TriggerNode | ActionNode): string {
    const workflow = buildWorkflow(
      node.type === "trigger" ? [node] : [trigger("A"), node],
      node.type === "trigger" ? [] : [edge("A", node.id)],
    );
    const steps = runWorkflow(workflow);
    const step = steps.find((step) => step.nodeId === node.id);
    if (!step) {
      throw new Error(`No step recorded for node "${node.id}"`);
    }
    return step.detail;
  }

  it("describes a form_submission trigger by its form name", () => {
    const detail = runSingleNodeWorkflow({
      id: "A",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: {
        label: "A",
        config: { kind: "form_submission", formName: "Signup" },
      },
    });

    expect(detail).toBe('Started by the "Signup" form being submitted.');
  });

  it("describes a send_email action, with and without a recipient", () => {
    const withRecipient = runSingleNodeWorkflow({
      id: "B",
      type: "action",
      position: { x: 0, y: 0 },
      data: {
        label: "B",
        config: { kind: "send_email", recipient: "ops@example.com" },
      },
    });
    expect(withRecipient).toBe('Sent email to "ops@example.com".');

    const withoutRecipient = runSingleNodeWorkflow({
      id: "B",
      type: "action",
      position: { x: 0, y: 0 },
      data: { label: "B", config: { kind: "send_email" } },
    });
    expect(withoutRecipient).toBe("Sent email.");
  });

  it("describes an http_request action by method and URL", () => {
    const detail = runSingleNodeWorkflow({
      id: "B",
      type: "action",
      position: { x: 0, y: 0 },
      data: {
        label: "B",
        config: {
          kind: "http_request",
          url: "https://example.com/hook",
          method: "POST",
        },
      },
    });

    expect(detail).toBe('Sent a POST request to "https://example.com/hook".');
  });

  it("describes an add_tag action by the tag name", () => {
    const detail = runSingleNodeWorkflow({
      id: "B",
      type: "action",
      position: { x: 0, y: 0 },
      data: { label: "B", config: { kind: "add_tag", tag: "vip" } },
    });

    expect(detail).toBe('Added tag "vip".');
  });

  it("describes a slack_message action by the channel", () => {
    const detail = runSingleNodeWorkflow({
      id: "B",
      type: "action",
      position: { x: 0, y: 0 },
      data: {
        label: "B",
        config: {
          kind: "slack_message",
          channel: "#general",
          message: "hi",
        },
      },
    });

    expect(detail).toBe('Sent a Slack message to "#general".');
  });
});
