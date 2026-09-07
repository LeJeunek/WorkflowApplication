import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  isActionConfig,
  isConditionConfig,
  isTriggerConfig,
} from "../domain/config";
import { runWorkflow as runWorkflowDomain } from "../domain/execution";
import { canConnect } from "../domain/graph";
import {
  PERSISTENCE_KEY,
  PERSISTENCE_VERSION,
  workflowStorage,
} from "./persistence";
import type {
  ActionConfig,
  ConditionBranch,
  ConditionConfig,
  IsoDateString,
  NodePosition,
  TriggerConfig,
  Workflow,
  WorkflowEdge,
  WorkflowEdgeId,
  WorkflowNode,
  WorkflowNodeId,
  WorkflowRun,
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
      /**
       * Where to begin the free-slot search. Defaults to the flow origin, so
       * callers that do not care about the viewport keep the old behaviour.
       */
      origin?: NodePosition;
      config: TriggerConfig;
    }
  | {
      type: "action";
      label: string;
      position?: NodePosition;
      /**
       * Where to begin the free-slot search. Defaults to the flow origin, so
       * callers that do not care about the viewport keep the old behaviour.
       */
      origin?: NodePosition;
      config: ActionConfig;
    }
  | {
      type: "condition";
      label: string;
      position?: NodePosition;
      /**
       * Where to begin the free-slot search. Defaults to the flow origin, so
       * callers that do not care about the viewport keep the old behaviour.
       */
      origin?: NodePosition;
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
  connectNodes: (
    source: WorkflowNodeId,
    target: WorkflowNodeId,
    sourceHandle?: ConditionBranch,
  ) => void;

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

  /**
   * The most recent simulated run, or null before the first one. Not
   * persisted (see `partialize` below) -- a stale run showing success on
   * nodes since edited or deleted would be misleading, not useful.
   */
  lastRun: WorkflowRun | null;

  /**
   * Simulates one run of the current workflow. Takes no argument: the
   * payload comes from the workflow's own primary trigger's sample data
   * (see domain/execution.ts).
   */
  runWorkflow: () => void;

  /**
   * Undo/redo history, as full document snapshots rather than an inverse
   * per action -- a workflow is small enough that this is dramatically
   * simpler than a command pattern's inverses, and cheap enough that the
   * simplicity is free. Neither is persisted (same reasoning as `lastRun`):
   * ephemeral session state, not part of the saved document. The most
   * recent entry is always at the end of the array in both.
   */
  past: Workflow[];
  future: Workflow[];

  /**
   * Bookkeeping for `commitWorkflow`'s coalescing (see there) -- which edit
   * was last committed, and when, so the next same-field keystroke can
   * decide whether to merge into it or start a fresh undo step. Not
   * meaningful to read outside the store itself; exists as real state
   * (rather than a module-level variable) purely so tests can reset it.
   */
  lastCommit: { key: string; at: number } | null;

  undo: () => void;
  redo: () => void;
}

export const COLUMN_SPACING = 240;
export const ROW_SPACING = 150;
export const NODES_PER_ROW = 4;

/** The grid coordinate for the nth auto-placed slot, left to right, wrapping rows. */
function gridSlot(index: number, origin: NodePosition): NodePosition {
  return {
    x: origin.x + (index % NODES_PER_ROW) * COLUMN_SPACING,
    y: origin.y + Math.floor(index / NODES_PER_ROW) * ROW_SPACING,
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
/** The flow-space origin, used when a caller supplies no anchor of its own. */
const FLOW_ORIGIN: NodePosition = { x: 0, y: 0 };

/**
 * Snaps an arbitrary origin onto the fixed lattice `gridSlot` already uses.
 *
 * `nextPosition`'s occupancy check compares exact coordinates, which only
 * catches a collision when two calls land on the *same* grid. A viewport-
 * derived origin (see `NodePalette`) drifts with every pan and zoom, so
 * without snapping, two adds a moment apart would search two different
 * grids and could place a node directly on top of an existing one without
 * either being detected as occupied.
 */
function snapToGrid(origin: NodePosition): NodePosition {
  return {
    x: Math.round(origin.x / COLUMN_SPACING) * COLUMN_SPACING,
    y: Math.round(origin.y / ROW_SPACING) * ROW_SPACING,
  };
}

function nextPosition(
  nodes: readonly WorkflowNode[],
  origin: NodePosition,
): NodePosition {
  const occupied = new Set(
    nodes.map((node) => `${node.position.x},${node.position.y}`),
  );

  let index = 0;
  let candidate = gridSlot(index, origin);
  while (occupied.has(`${candidate.x},${candidate.y}`)) {
    index += 1;
    candidate = gridSlot(index, origin);
  }
  return candidate;
}

function now(): IsoDateString {
  return new Date().toISOString();
}

interface CoalesceOptions {
  /** Edits sharing a key merge into one undo step if they land within `windowMs` of each other. */
  key: string;
  windowMs: number;
}

/**
 * Every mutating action's single path to actually changing `workflow`. Two
 * responsibilities live here rather than in each action, because both are
 * easy to get subtly wrong if repeated by hand:
 *
 * - Only pushes an undo step when `computeNext` returns a genuinely
 *   *different* `Workflow` object. An action that turns out to be a no-op
 *   (an unknown id, a rejected connection) must return the same reference
 *   it was given for this to work -- which is also what finally fixes the
 *   older "updatedAt bumps even on a no-op delete" issue, for the same
 *   reason.
 * - Coalesces rapid edits sharing a `coalesce.key` (every keystroke in the
 *   Inspector calls updateNode/updateNodeConfig) into a single undo step,
 *   rather than one step per character typed. Discrete actions
 *   (add/delete/connect/move) pass no `coalesce` and always get their own
 *   step.
 *
 * The coalescing bookkeeping (`state.lastCommit`) lives in the store's own
 * state, not a module-level variable: a bare closure variable can't be
 * reset by `setState`, which would let a test's leftover coalescing key
 * silently bleed into a later, unrelated test that happens to touch the
 * same node id within the same window.
 */
function commitWorkflow(
  state: WorkflowStore,
  computeNext: (workflow: Workflow) => Workflow,
  coalesce?: CoalesceOptions,
): Pick<WorkflowStore, "workflow" | "past" | "future" | "lastCommit"> {
  const nextWorkflow = computeNext(state.workflow);

  if (nextWorkflow === state.workflow) {
    return {
      workflow: state.workflow,
      past: state.past,
      future: state.future,
      lastCommit: state.lastCommit,
    };
  }

  const at = Date.now();
  const shouldCoalesce =
    coalesce !== undefined &&
    state.lastCommit !== null &&
    state.lastCommit.key === coalesce.key &&
    at - state.lastCommit.at < coalesce.windowMs;

  return {
    workflow: nextWorkflow,
    past: shouldCoalesce ? state.past : [...state.past, state.workflow],
    future: [],
    lastCommit: coalesce ? { key: coalesce.key, at } : null,
  };
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
          kind: "event",
          event: "customer.created",
          samplePayload: JSON.stringify(
            { customer: { id: "cust_001", name: "Jordan Lee", plan: "pro" } },
            null,
            2,
          ),
        },
      },
    },
  ],

  edges: [],

  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
};

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set) => ({
      workflow: INITIAL_WORKFLOW,

      selectedNodeId: null,

      setSelectedNodeId: (id) =>
        set({
          selectedNodeId: id,
        }),

      lastRun: null,

      runWorkflow: () =>
        set((state) => ({
          lastRun: {
            id: crypto.randomUUID(),
            startedAt: now(),
            finishedAt: now(),
            steps: runWorkflowDomain(state.workflow),
          },
        })),

      past: [],
      future: [],
      lastCommit: null,

      undo: () =>
        set((state) => {
          if (state.past.length === 0) {
            return state;
          }

          const previous = state.past[state.past.length - 1];
          return {
            workflow: previous,
            past: state.past.slice(0, -1),
            future: [...state.future, state.workflow],
            lastCommit: null,
            selectedNodeId: previous.nodes.some(
              (node) => node.id === state.selectedNodeId,
            )
              ? state.selectedNodeId
              : null,
          };
        }),

      redo: () =>
        set((state) => {
          if (state.future.length === 0) {
            return state;
          }

          const next = state.future[state.future.length - 1];
          return {
            workflow: next,
            past: [...state.past, state.workflow],
            future: state.future.slice(0, -1),
            lastCommit: null,
            selectedNodeId: next.nodes.some(
              (node) => node.id === state.selectedNodeId,
            )
              ? state.selectedNodeId
              : null,
          };
        }),

      addNode: (input) =>
        set((state) =>
          commitWorkflow(state, (workflow) => {
            const position =
              input.position ??
              nextPosition(
                workflow.nodes,
                snapToGrid(input.origin ?? FLOW_ORIGIN),
              );

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
              ...workflow,
              nodes: [...workflow.nodes, node],
              updatedAt: now(),
            };
          }),
        ),

      moveNode: (id, position) =>
        set((state) =>
          commitWorkflow(state, (workflow) =>
            workflow.nodes.some((node) => node.id === id)
              ? {
                  ...workflow,
                  nodes: workflow.nodes.map((node) =>
                    node.id === id ? { ...node, position } : node,
                  ),
                  updatedAt: now(),
                }
              : workflow,
          ),
        ),

      connectNodes: (source, target, sourceHandle) =>
        set((state) =>
          commitWorkflow(state, (workflow) => {
            if (
              !canConnect(workflow.nodes, workflow.edges, source, target, sourceHandle)
            ) {
              return workflow;
            }

            const edge: WorkflowEdge = {
              id: crypto.randomUUID(),
              source,
              target,
              // Spread conditionally so unbranched edges have no
              // `sourceHandle` key at all, rather than an explicit `undefined`.
              ...(sourceHandle ? { sourceHandle } : {}),
            };

            return {
              ...workflow,
              edges: [...workflow.edges, edge],
              updatedAt: now(),
            };
          }),
        ),

      updateNode: (id, input) =>
        set((state) =>
          commitWorkflow(
            state,
            (workflow) => {
              if (!workflow.nodes.some((node) => node.id === id)) {
                return workflow;
              }

              return {
                ...workflow,
                nodes: workflow.nodes.map((node) => {
                  if (node.id !== id) {
                    return node;
                  }

                  // A per-type switch, not one generic branch: spreading
                  // ...node.data (a union of three shapes) and returning it
                  // as WorkflowNode only type-checks when each branch stays
                  // inside the one node type it started as.
                  switch (node.type) {
                    case "trigger":
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          ...(input.label !== undefined
                            ? { label: input.label }
                            : {}),
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
                          ...(input.label !== undefined
                            ? { label: input.label }
                            : {}),
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
                          ...(input.label !== undefined
                            ? { label: input.label }
                            : {}),
                          ...(input.description !== undefined
                            ? { description: input.description }
                            : {}),
                        },
                      };
                  }
                }),
                updatedAt: now(),
              };
            },
            { key: `updateNode:${id}`, windowMs: 800 },
          ),
        ),

      updateNodeConfig: (id, config) =>
        set((state) =>
          commitWorkflow(
            state,
            (workflow) => {
              if (!workflow.nodes.some((node) => node.id === id)) {
                return workflow;
              }

              const nodes = workflow.nodes.map((node) => {
                if (node.id !== id) {
                  return node;
                }

                // The type-predicate check happens inside each branch, not
                // hoisted above the map: that's what lets it narrow `config`
                // to the exact shape each branch returns.
                switch (node.type) {
                  case "trigger":
                    return isTriggerConfig(config)
                      ? { ...node, data: { ...node.data, config } }
                      : node;

                  case "action":
                    return isActionConfig(config)
                      ? { ...node, data: { ...node.data, config } }
                      : node;

                  case "condition":
                    return isConditionConfig(config)
                      ? { ...node, data: { ...node.data, config } }
                      : node;
                }
              });

              // Every node is unchanged (the shape didn't match) --
              // genuinely a no-op, so don't record an undo step or bump
              // updatedAt for a change that didn't happen.
              if (nodes.every((node, index) => node === workflow.nodes[index])) {
                return workflow;
              }

              return { ...workflow, nodes, updatedAt: now() };
            },
            { key: `updateNodeConfig:${id}`, windowMs: 800 },
          ),
        ),

      deleteNode: (id) =>
        set((state) => ({
          ...commitWorkflow(state, (workflow) =>
            workflow.nodes.some((node) => node.id === id)
              ? {
                  ...workflow,
                  nodes: workflow.nodes.filter((node) => node.id !== id),
                  edges: workflow.edges.filter(
                    (edge) => edge.source !== id && edge.target !== id,
                  ),
                  updatedAt: now(),
                }
              : workflow,
          ),
          selectedNodeId:
            state.selectedNodeId === id ? null : state.selectedNodeId,
        })),

      deleteEdge: (id) =>
        set((state) =>
          commitWorkflow(state, (workflow) =>
            workflow.edges.some((edge) => edge.id === id)
              ? {
                  ...workflow,
                  edges: workflow.edges.filter((edge) => edge.id !== id),
                  updatedAt: now(),
                }
              : workflow,
          ),
        ),

      renameWorkflow: (name) =>
        set((state) =>
          commitWorkflow(
            state,
            (workflow) =>
              workflow.name === name
                ? workflow
                : { ...workflow, name, updatedAt: now() },
            { key: "renameWorkflow", windowMs: 800 },
          ),
        ),
    }),
    {
      name: PERSISTENCE_KEY,
      version: PERSISTENCE_VERSION,
      storage: workflowStorage,
      // selectedNodeId/past/future are ephemeral UI/session state, not
      // part of the saved document.
      partialize: (state) => ({ workflow: state.workflow }),
    },
  ),
);
