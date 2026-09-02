import { create } from "zustand";

import { canConnect } from "../domain/graph";
import type {
  ActionConfig,
  ConditionConfig,
  IsoDateString,
  NodePosition,
  TriggerConfig,
  Workflow,
  WorkflowEdge,
  WorkflowEdgeId,
  WorkflowNode,
  WorkflowNodeId,
} from "../types";

/**
 * What a caller must supply to create a node.
 *
 * This is a discriminated union:
 * - trigger requires TriggerConfig
 * - action requires ActionConfig
 * - condition requires ConditionConfig
 */
export type NewNodeInput =
  | {
      type: "trigger";
      label: string;
      position?: NodePosition;
      config: TriggerConfig;
    }
  | {
      type: "action";
      label: string;
      position?: NodePosition;
      config: ActionConfig;
    }
  | {
      type: "condition";
      label: string;
      position?: NodePosition;
      config: ConditionConfig;
    };

export interface UpdateNodeInput {
  label?: string;
  description?: string;
}

export interface WorkflowStore {
  /** The canonical workflow. Everything the canvas renders derives from this. */
  workflow: Workflow;

  /** Appends a node with a generated id. */
  addNode: (input: NewNodeInput) => void;

  deleteNode: (id: WorkflowNodeId) => void;

  deleteEdge: (id: WorkflowEdgeId) => void;

  /** Commits a node's position after a drag. */
  moveNode: (id: WorkflowNodeId, position: NodePosition) => void;

  /** Records a connection drawn between two nodes. */
  connectNodes: (source: WorkflowNodeId, target: WorkflowNodeId) => void;

  /** Updates editable properties on an existing node. */
  updateNode: (id: WorkflowNodeId, input: UpdateNodeInput) => void;

  updateNodeConfig: (
    id: WorkflowNodeId,
    config: TriggerConfig | ActionConfig | ConditionConfig,
  ) => void;

  /** Renames the workflow itself, not a node. */
  renameWorkflow: (name: string) => void;

  selectedNodeId: WorkflowNodeId | null;

  setSelectedNodeId: (id: WorkflowNodeId | null) => void;
}

export const COLUMN_SPACING = 240;
export const ROW_SPACING = 150;
export const NODES_PER_ROW = 4;

/** The grid coordinate for the nth auto-placed slot, left to right, wrapping rows. */
function gridSlot(index: number): NodePosition {
  return {
    x: (index % NODES_PER_ROW) * COLUMN_SPACING,
    y: Math.floor(index / NODES_PER_ROW) * ROW_SPACING,
  };
}

/**
 * Placement for palette-created nodes: the first grid slot not already
 * occupied by an existing node.
 *
 * Scanning by occupancy rather than indexing off `nodes.length` matters once
 * deletion is possible: after add, add, delete-the-middle-one, add, a
 * length-based index reuses the deleted node's old slot even though a
 * later-added node already sits there, stacking two nodes on top of each
 * other.
 */
function nextPosition(nodes: readonly WorkflowNode[]): NodePosition {
  const occupied = new Set(
    nodes.map((node) => `${node.position.x},${node.position.y}`),
  );

  let index = 0;
  let candidate = gridSlot(index);
  while (occupied.has(`${candidate.x},${candidate.y}`)) {
    index += 1;
    candidate = gridSlot(index);
  }
  return candidate;
}

function now(): IsoDateString {
  return new Date().toISOString();
}

/** Fixed so the seed workflow is identical on every load. */
const SEED_TIMESTAMP: IsoDateString = "2026-01-01T00:00:00.000Z";

const INITIAL_WORKFLOW: Workflow = {
  id: "workflow-draft",
  name: "Untitled Workflow",

  nodes: [
    {
      id: "trigger-new-customer",
      type: "trigger",
      position: {
        x: 0,
        y: 0,
      },
      data: {
        label: "New Customer",
        description: "Runs when a customer is created",
        config: {
          event: "customer.created",
        },
      },
    },
  ],

  edges: [],

  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
};

export const useWorkflowStore = create<WorkflowStore>()((set) => ({
  workflow: INITIAL_WORKFLOW,

  selectedNodeId: null,

  setSelectedNodeId: (id) =>
    set({
      selectedNodeId: id,
    }),

  addNode: (input) =>
    set((state) => {
      const position =
        input.position ?? nextPosition(state.workflow.nodes);

      const id = crypto.randomUUID();

      const node: WorkflowNode =
        input.type === "trigger"
          ? {
              id,
              type: "trigger",
              position,
              data: {
                label: input.label,
                config: input.config,
              },
            }
          : input.type === "action"
            ? {
                id,
                type: "action",
                position,
                data: {
                  label: input.label,
                  config: input.config,
                },
              }
            : {
                id,
                type: "condition",
                position,
                data: {
                  label: input.label,
                  config: input.config,
                },
              };

      return {
        workflow: {
          ...state.workflow,
          nodes: [...state.workflow.nodes, node],
          updatedAt: now(),
        },
      };
    }),

  moveNode: (id, position) =>
    set((state) => ({
      workflow: {
        ...state.workflow,

        nodes: state.workflow.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                position,
              }
            : node,
        ),

        updatedAt: now(),
      },
    })),

  connectNodes: (source, target) =>
    set((state) => {
      if (!canConnect(state.workflow.nodes, state.workflow.edges, source, target)) {
        return state;
      }

      const edge: WorkflowEdge = {
        id: crypto.randomUUID(),
        source,
        target,
      };

      return {
        workflow: {
          ...state.workflow,
          edges: [...state.workflow.edges, edge],
          updatedAt: now(),
        },
      };
    }),

  updateNode: (id, input) =>
    set((state) => ({
      workflow: {
        ...state.workflow,

        nodes: state.workflow.nodes.map((node) => {
          if (node.id !== id) {
            return node;
          }

          switch (node.type) {
            case "trigger":
              return {
                ...node,
                data: {
                  ...node.data,
                  ...(input.label !== undefined ? { label: input.label } : {}),
                  ...(input.description !== undefined
                    ? { description: input.description }
                    : {}),
                },
              };

            case "action":
              return {
                ...node,
                data: {
                  ...node.data,
                  ...(input.label !== undefined ? { label: input.label } : {}),
                  ...(input.description !== undefined
                    ? { description: input.description }
                    : {}),
                },
              };

            case "condition":
              return {
                ...node,
                data: {
                  ...node.data,
                  ...(input.label !== undefined ? { label: input.label } : {}),
                  ...(input.description !== undefined
                    ? { description: input.description }
                    : {}),
                },
              };
          }
        }),

        updatedAt: now(),
      },
    })),

  updateNodeConfig: (id, config) =>
    set((state) => ({
      workflow: {
        ...state.workflow,

        nodes: state.workflow.nodes.map((node) => {
          if (node.id !== id) {
            return node;
          }

          switch (node.type) {
            case "trigger":
              if ("event" in config) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    config,
                  },
                };
              }
              return node;

            case "action":
              if ("action" in config) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    config,
                  },
                };
              }
              return node;

            case "condition":
              if (
                "field" in config &&
                "operator" in config &&
                "value" in config
              ) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    config,
                  },
                };
              }
              return node;
          }
        }),

        updatedAt: now(),
      },
    })),
  deleteNode: (id) =>
    set((state) => ({
      workflow: {
        ...state.workflow,

        nodes: state.workflow.nodes.filter((node) => node.id !== id),

        edges: state.workflow.edges.filter(
          (edge) => edge.source !== id && edge.target !== id,
        ),

        updatedAt: now(),
      },

      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  deleteEdge: (id) =>
    set((state) => ({
      workflow: {
        ...state.workflow,
        edges: state.workflow.edges.filter((edge) => edge.id !== id),
        updatedAt: now(),
      },
    })),

  renameWorkflow: (name) =>
    set((state) => ({
      workflow: {
        ...state.workflow,
        name,
        updatedAt: now(),
      },
    })),
}));
