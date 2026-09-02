/**
 * Core domain model for Canvas workflows.
 *
 * These types describe a workflow as the product understands it, and are
 * deliberately independent of any rendering library (including
 * `@xyflow/react`). Adapters map between this model and view-layer shapes.
 */

/** Identifier of a {@link Workflow}. */
export type WorkflowId = string;

/** Identifier of a {@link WorkflowNode}, unique within its workflow. */
export type WorkflowNodeId = string;

/** Identifier of a {@link WorkflowEdge}, unique within its workflow. */
export type WorkflowEdgeId = string;

/** ISO 8601 timestamp, e.g. `"2026-08-19T21:05:00.000Z"`. */
export type IsoDateString = string;

/** The kind of work a node performs. */
export type NodeType = "trigger" | "action" | "condition";

/** A point on the canvas, in workflow coordinate space. */
export interface NodePosition {
  x: number;
  y: number;
}

/** Configuration specific to each node type. */
export interface TriggerConfig {
  event: string;
}

export interface ActionConfig {
  action: string;
  recipient?: string;
}

/** The comparisons a Condition node's branch can test for. */
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than";

/** Every value {@link ConditionOperator} allows, in display order. */
export const CONDITION_OPERATORS: readonly ConditionOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "greater_than",
  "less_than",
];

export interface ConditionConfig {
  field: string;
  operator: ConditionOperator;
  value: string;
}

/** Which output of a Condition node an edge leaves from. */
export type ConditionBranch = "true" | "false";

/** Every value {@link ConditionBranch} allows, in display order. */
export const CONDITION_BRANCHES: readonly ConditionBranch[] = [
  "true",
  "false",
];

export interface TriggerNode {
  id: WorkflowNodeId;
  type: "trigger";
  position: NodePosition;
  data: {
    label: string;
    description?: string;
    config: TriggerConfig;
  };
}

export interface ActionNode {
  id: WorkflowNodeId;
  type: "action";
  position: NodePosition;
  data: {
    label: string;
    description?: string;
    config: ActionConfig;
  };
}

export interface ConditionNode {
  id: WorkflowNodeId;
  type: "condition";
  position: NodePosition;
  data: {
    label: string;
    description?: string;
    config: ConditionConfig;
  };
}

export type WorkflowNode = TriggerNode | ActionNode | ConditionNode;
/** A directed connection describing flow from one node to another. */
export interface WorkflowEdge {
  id: WorkflowEdgeId;
  source: WorkflowNodeId;
  target: WorkflowNodeId;
  /**
   * Which of a Condition node's outputs this edge leaves from. Undefined for
   * trigger and action sources, which have a single unnamed output.
   */
  sourceHandle?: ConditionBranch;
  /** Optional display caption drawn on the edge. */
  label?: string;
}

/** A complete, persistable workflow document. */
export interface Workflow {
  id: WorkflowId;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}
