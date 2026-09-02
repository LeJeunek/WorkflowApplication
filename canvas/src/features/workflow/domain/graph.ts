import type {
  ConditionBranch,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeId,
} from "../types";

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
 * Checked in order, first failing reason wins: a node can't connect to
 * itself, both ends must be real nodes, a trigger can never receive an
 * incoming edge (it's a workflow's entry point by definition), the branch
 * must match the source's shape (a Condition names which output it leaves
 * from; every other type has one unnamed output), the same
 * (source, branch, target) triple can't be connected twice, and the new
 * edge must not complete a cycle.
 */
export function canConnect(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
  source: WorkflowNodeId,
  target: WorkflowNodeId,
  sourceHandle?: ConditionBranch,
): boolean {
  if (source === target) {
    return false;
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const sourceNode = byId.get(source);
  const targetNode = byId.get(target);
  if (!sourceNode || !targetNode) {
    return false;
  }

  if (targetNode.type === "trigger") {
    return false;
  }

  // A condition's edges must say which branch they leave from; every other
  // node type has a single unnamed output and must not claim one.
  const branchRequired = sourceNode.type === "condition";
  if (branchRequired !== (sourceHandle !== undefined)) {
    return false;
  }

  const alreadyConnected = edges.some(
    (edge) =>
      edge.source === source &&
      edge.target === target &&
      edge.sourceHandle === sourceHandle,
  );
  if (alreadyConnected) {
    return false;
  }

  return !wouldCreateCycle(edges, source, target);
}
