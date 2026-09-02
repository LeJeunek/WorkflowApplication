import type { WorkflowEdge, WorkflowNode, WorkflowNodeId } from "../types";

/**
 * Returns true if adding source -> target would create a cycle.
 *
 * Starting from the proposed target, we follow existing edges forward.
 * If we can eventually reach the proposed source, the new edge would
 * complete a cycle.
 */
export function wouldCreateCycle(
  edges: readonly WorkflowEdge[],
  source: WorkflowNodeId,
  target: WorkflowNodeId,
): boolean {
  const visited = new Set<WorkflowNodeId>();
  const stack: WorkflowNodeId[] = [target];

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === undefined || visited.has(current)) {
      continue;
    }

    if (current === source) {
      return true;
    }

    visited.add(current);

    for (const edge of edges) {
      if (edge.source === current && !visited.has(edge.target)) {
        stack.push(edge.target);
      }
    }
  }

  return false;
}

/**
 * Whether drawing an edge from `source` to `target` is allowed.
 *
 * Checked in order, first failing reason wins: both ends must be real
 * nodes, a node can't connect to itself, a trigger can never receive an
 * incoming edge (it's a workflow's entry point by definition), the same
 * (source, target) pair can't be connected twice, and the new edge must
 * not complete a cycle.
 */
export function canConnect(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
  source: WorkflowNodeId,
  target: WorkflowNodeId,
): boolean {
  if (source === target) {
    return false;
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const targetNode = byId.get(target);
  if (!byId.has(source) || !targetNode) {
    return false;
  }

  if (targetNode.type === "trigger") {
    return false;
  }

  const alreadyConnected = edges.some(
    (edge) => edge.source === source && edge.target === target,
  );
  if (alreadyConnected) {
    return false;
  }

  return !wouldCreateCycle(edges, source, target);
}
