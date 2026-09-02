import { wouldCreateCycle } from "./graph";
import type {
  Workflow,
  WorkflowEdgeId,
  WorkflowNodeId,
} from "../types";

export interface ValidationError {
  code:
    | "dangling-edge"
    | "self-loop"
    | "duplicate-edge"
    | "cycle"
    | "trigger-has-incoming-edge";
  message: string;
  nodeId?: WorkflowNodeId;
  edgeId?: WorkflowEdgeId;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

/**
 * Checks a whole workflow against the same structural rules `canConnect`
 * enforces incrementally when a single edge is drawn.
 *
 * Unlike `canConnect`, this collects every problem it finds rather than
 * stopping at the first one -- it's a diagnostic over a `Workflow` value
 * from any source, not a gate on one proposed connection.
 */
export function validateWorkflow(workflow: Workflow): ValidationResult {
  const errors: ValidationError[] = [];
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const seenPairCounts = new Map<string, number>();

  for (const edge of workflow.edges) {
    const targetNode = nodesById.get(edge.target);

    if (!nodesById.has(edge.source) || !targetNode) {
      errors.push({
        code: "dangling-edge",
        message: `Edge ${edge.id} references a node that no longer exists.`,
        edgeId: edge.id,
      });
    }

    if (edge.source === edge.target) {
      errors.push({
        code: "self-loop",
        message: `Edge ${edge.id} connects a node to itself.`,
        edgeId: edge.id,
      });
    }

    if (targetNode?.type === "trigger") {
      errors.push({
        code: "trigger-has-incoming-edge",
        message: `Trigger node ${edge.target} has an incoming edge.`,
        nodeId: edge.target,
        edgeId: edge.id,
      });
    }

    const pairKey = `${edge.source}->${edge.target}`;
    const seenCount = seenPairCounts.get(pairKey) ?? 0;
    if (seenCount > 0) {
      errors.push({
        code: "duplicate-edge",
        message: `Edge ${edge.id} duplicates an existing connection from ${edge.source} to ${edge.target}.`,
        edgeId: edge.id,
      });
    }
    seenPairCounts.set(pairKey, seenCount + 1);
  }

  // A given edge is part of a cycle exactly when the rest of the graph,
  // without it, would recreate a cycle by adding it back.
  for (const edge of workflow.edges) {
    const otherEdges = workflow.edges.filter(
      (candidate) => candidate.id !== edge.id,
    );
    if (wouldCreateCycle(otherEdges, edge.source, edge.target)) {
      errors.push({
        code: "cycle",
        message: `Edge ${edge.id} is part of a cycle.`,
        edgeId: edge.id,
      });
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
