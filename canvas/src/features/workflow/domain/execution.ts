import { evaluateCondition } from "./evaluate";
import { validateWorkflow } from "./validation";
import type {
  ActionConfig,
  ConditionBranch,
  ConditionConfig,
  ConditionOperator,
  NodeRunResult,
  NodeRunStatus,
  TriggerConfig,
  Workflow,
  WorkflowEdge,
  WorkflowNodeId,
} from "../types";

/** Exhaustive over {@link TriggerConfig}'s `kind` -- a switch, not a ternary, precisely so a new kind fails to compile here until it's given a description. */
function describeTrigger(config: TriggerConfig): string {
  switch (config.kind) {
    case "event":
      return `Started by the "${config.event}" event.`;
    case "schedule":
      return `Started on schedule ("${config.cron}").`;
    case "form_submission":
      return `Started by the "${config.formName}" form being submitted.`;
  }
}

function validateOrder(
  payload: Record<string, unknown>,
): { valid: boolean; detail: string } {
  const order = payload.order;

  if (!order || typeof order !== "object") {
    return {
      valid: false,
      detail: "Order is missing or invalid.",
    };
  }

  const orderData = order as Record<string, unknown>;

  if (typeof orderData.id !== "string" || orderData.id.trim() === "") {
    return {
      valid: false,
      detail: "Order ID is missing or invalid.",
    };
  }

  if (typeof orderData.total !== "number" || orderData.total <= 0) {
    return {
      valid: false,
      detail: `Order ${orderData.id} validation failed: total is invalid.`,
    };
  }

  if (
    typeof orderData.currency !== "string" ||
    orderData.currency.trim() === ""
  ) {
    return {
      valid: false,
      detail: `Order ${orderData.id} validation failed: currency is missing or invalid.`,
    };
  }

  return {
    valid: true,
    detail: `Order ${orderData.id} validation passed.`,
  };
}

/**
 * Plain-English phrase for each {@link ConditionOperator}, used to narrate a
 * condition step ("customer.plan <phrase> "pro"") rather than showing the
 * raw operator name.
 */
const CONDITION_OPERATOR_PHRASES: Record<ConditionOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  greater_than: "is greater than",
  less_than: "is less than",
};

/** Narrates what a condition checked and which way it went, rather than just reporting the boolean. */
function describeCondition(config: ConditionConfig, matched: boolean): string {
  const branchLabel = matched ? "True" : "False";
  return `Checked whether "${config.field}" ${CONDITION_OPERATOR_PHRASES[config.operator]} "${config.value}" -- it was ${matched}, so this took the ${branchLabel} path.`;
}

/** Exhaustive over {@link ActionConfig}'s `kind`, same reasoning as {@link describeTrigger}. */
function describeAction(config: ActionConfig, payload: Record<string, unknown>): { status: NodeRunStatus; detail: string } {

  switch (config.kind) {
    case "send_email":
      return config.recipient
        ? { status: "success", detail: `Sent email to "${config.recipient}".` }
        : { status: "success", detail: "Sent email." };
    case "http_request":
      return { status: "success", detail: `Sent a ${config.method} request to "${config.url}".` };
    case "add_tag":
      return { status: "success", detail: `Added tag "${config.tag}".` };
    case "slack_message":
      return { status: "success", detail: `Sent a Slack message to "${config.channel}".` };
    case "validate_order": {
      const result = validateOrder(payload);

      return {
        status: result.valid ? "success" : "failure",
        detail: result.detail,
      };
    }
    case "cancel_order": {
      const order = payload.order;
      
      if (!order || typeof order !== "object") {
        return {
          status: "failure",
          detail: "Unable to cancel order: order missing data.",
        };
      }
      const orderData = order as Record<string, unknown>;

      if (typeof orderData.id !== "string" || orderData.id.trim() === "") {
        return {
          status: "failure",
          detail: "Unable to cancel order: order ID missing or invalid.",
        };
      }
      return {
        status: "success",
        detail: `Order ${orderData.id} has been canceled.`,
      };
    }
  }
}

/**
 * Parses a trigger's raw `samplePayload` text into the object conditions
 * get evaluated against. Never throws: missing text, invalid JSON, or JSON
 * that parses to something other than a plain object (an array, a number,
 * `null`) all fall back to `{}` -- an unconfigured or malformed sample is
 * an expected state to run against, not an error to surface here.
 * `evaluateCondition`'s own missing-field handling takes it from there.
 */
/** True when `raw` is JSON text that parses to a plain object (not an array, not a primitive). */
function parsesToPlainObject(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

export function parseSamplePayload(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Whether a trigger's raw `samplePayload` text is safe to show as "fine" in
 * an editor, rather than flagging it as a mistake.
 *
 * Deliberately more forgiving than {@link parsesToPlainObject} alone: an
 * empty or whitespace-only value is treated as valid, not invalid -- an
 * unconfigured sample payload is a normal state (see the doc comment on
 * `TriggerConfig` in types.ts), not something a user typed wrong. This is
 * a UI-feedback concern, separate from {@link parseSamplePayload}'s job of
 * always producing *something* to run against regardless of validity.
 */
export function isSamplePayloadValid(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === "") {
    return true;
  }
  return parsesToPlainObject(raw);
}

/**
 * Simulates one execution of a workflow and returns what happened at
 * every node the run touched.
 *
 * The payload conditions evaluate against comes from the workflow's own
 * first trigger node (`samplePayload` on its config), not a function
 * argument: a trigger owns its own example data now, the same way a real
 * trigger's event carries its own shape. When a workflow has more than one
 * trigger, only the first one's sample data is used for the whole run --
 * resolving *which* trigger's data a run downstream of several triggers
 * "really" has doesn't have a clean answer, and most workflows have
 * exactly one trigger regardless.
 *
 * This never throws and never generates an id or a timestamp -- both
 * belong to whatever calls this (see workflowStore.ts's use of
 * crypto.randomUUID()/now() for the equivalent pattern on the document
 * side), not to a pure function whose whole value is being deterministic.
 *
 * A workflow that fails {@link validateWorkflow} (a dangling edge, a
 * cycle, ...) produces no steps at all rather than a best-effort partial
 * run: there's no sensible execution order over a structurally broken
 * graph, and persistence means a `Workflow` value reaching this function
 * isn't guaranteed to have come from the store's own invariant-preserving
 * actions -- it could be hand-edited storage, or an older schema.
 */
export function runWorkflow(workflow: Workflow): NodeRunResult[] {
  if (!validateWorkflow(workflow).valid) {
    return [];
  }

  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const outgoingByNode = new Map<WorkflowNodeId, WorkflowEdge[]>();
  for (const edge of workflow.edges) {
    const existing = outgoingByNode.get(edge.source);
    if (existing) {
      existing.push(edge);
    } else {
      outgoingByNode.set(edge.source, [edge]);
    }
  }

  const triggerIds = workflow.nodes
    .filter((node) => node.type === "trigger")
    .map((node) => node.id);

  const primaryTrigger = nodesById.get(triggerIds[0] ?? "");
  const payload: Record<string, unknown> =
    primaryTrigger?.type === "trigger"
      ? parseSamplePayload(primaryTrigger.data.config.samplePayload)
      : {};

  const steps: NodeRunResult[] = [];

  // Pass A: what actually runs. Following only each condition's taken
  // branch means order never affects the outcome -- a node already
  // recorded as having run stays that way no matter how many other paths
  // also happen to lead to it (see the two-branches-converge case above).
  const ran = new Set<WorkflowNodeId>();

  function walkTaken(nodeId: WorkflowNodeId) {
    if (ran.has(nodeId)) {
      return;
    }
    ran.add(nodeId);

    const node = nodesById.get(nodeId)!;
    const outgoing = outgoingByNode.get(nodeId) ?? [];

    if (node.type === "condition") {
      const matched = evaluateCondition(node.data.config, payload);
      const takenBranch: ConditionBranch = matched ? "true" : "false";

      steps.push({
        nodeId,
        status: "success",
        detail: describeCondition(node.data.config, matched),
      });

      for (const edge of outgoing) {
        if (edge.sourceHandle === takenBranch) {
          walkTaken(edge.target);
        }
      }
      return;
    }

    if (node.type === "trigger") {
      steps.push({
        nodeId, 
        status: "success",
        detail: describeTrigger(node.data.config),
      });
    } else {
      const result = describeAction(node.data.config, payload);
      
      steps.push({
        nodeId,
        status: result.status, 
        detail: result.detail,
      });

      if (result.status === "failure") {
        return;
      }
    };

    for (const edge of outgoing) {
      walkTaken(edge.target);
    }
  }

  triggerIds.forEach(walkTaken);

  // Pass B: everything structurally reachable, taken branch or not.
  // Anything here but not in `ran` sits downstream of a branch that
  // wasn't taken.
  const reachable = new Set<WorkflowNodeId>();

  function walkAll(nodeId: WorkflowNodeId) {
    if (reachable.has(nodeId)) {
      return;
    }
    reachable.add(nodeId);
    for (const edge of outgoingByNode.get(nodeId) ?? []) {
      walkAll(edge.target);
    }
  }

  triggerIds.forEach(walkAll);

  for (const nodeId of reachable) {
  if (!ran.has(nodeId)) {
    steps.push({
      nodeId,
      status: "skipped",
      detail: "This step was skipped because the workflow took a different path.",
    });
  }
} // closes for loop

return steps;
} 