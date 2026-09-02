import { useCallback, useEffect } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type { Edge, NodeTypes, OnConnect, OnNodeDrag } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useWorkflowStore } from "../state/workflowStore";
import type {
  ConditionBranch,
  WorkflowEdge,
  WorkflowNode as WorkflowNodeModel,
} from "../types";
import { WorkflowNode } from "./WorkflowNode";
import type { WorkflowFlowNode } from "./WorkflowNode";

/**
 * Must be module scoped: React Flow remounts every node when this object
 * changes identity.
 */
const nodeTypes: NodeTypes = {
  trigger: WorkflowNode,
  action: WorkflowNode,
  condition: WorkflowNode,
};

/** Narrows a domain node to the shape React Flow renders. */
function toFlowNode(node: WorkflowNodeModel): WorkflowFlowNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      label: node.data.label,
      description: node.data.description,
    },
  };
}

/** Narrows a domain edge to the shape React Flow renders. */
function toFlowEdge(edge: WorkflowEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    label: edge.label,
  };
}

/**
 * React Flow types a handle id as `string | null`; the domain only accepts a
 * known branch. Sanitizing at this boundary keeps the loose view-layer type
 * from leaking into the store.
 */
function toConditionBranch(value: string | null): ConditionBranch | undefined {
  return value === "true" || value === "false" ? value : undefined;
}

/**
 * The editing surface.
 *
 * The store holds the workflow; React Flow holds a working copy of it plus
 * the ephemeral interaction flags (`selected`, `dragging`, measured size)
 * that never belong in the domain model. Domain changes flow down through
 * the sync effects below; interactions that alter the workflow itself —
 * dragging a node, drawing a connection — are committed back to the store.
 */
export function CanvasArea() {
  const workflowNodes = useWorkflowStore((state) => state.workflow.nodes);
  const workflowEdges = useWorkflowStore((state) => state.workflow.edges);
  const moveNode = useWorkflowStore((state) => state.moveNode);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const deleteEdge = useWorkflowStore((state) => state.deleteEdge);
  const connectNodes = useWorkflowStore((state) => state.connectNodes);
  const setSelectedNodeId = useWorkflowStore(
    (state) => state.setSelectedNodeId,
  );
  const onNodesDelete = useCallback(
    (deletedNodes: WorkflowFlowNode[]) => {
      deletedNodes.forEach((node) => {
        deleteNode(node.id);
      });
    },
    [deleteNode],
  );
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((edge) => {
        deleteEdge(edge.id);
      });
    },
    [deleteEdge],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>(
    workflowNodes.map(toFlowNode),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    workflowEdges.map(toFlowEdge),
  );

  /**
   * Re-derive the working copy whenever the domain nodes change, preserving
   * each node's interaction flags. Spreading the mapped node last keeps the
   * store authoritative for position, so a committed drag never fights the
   * value React Flow already has.
   */
  useEffect(() => {
    setNodes((current) => {
      const byId = new Map(current.map((node) => [node.id, node]));

      return workflowNodes.map((node) => {
        const existing = byId.get(node.id);
        const mapped = toFlowNode(node);
        return existing ? { ...existing, ...mapped } : mapped;
      });
    });
  }, [workflowNodes, setNodes]);

  useEffect(() => {
    setEdges(workflowEdges.map(toFlowEdge));
  }, [workflowEdges, setEdges]);

  /**
   * Mirror React Flow's selection into the store so the Inspector can read
   * it. Selection stays ephemeral in React Flow; only the id crosses over.
   * Single-select for now: the first selected node wins.
   */
  useEffect(() => {
    setSelectedNodeId(nodes.find((node) => node.selected)?.id ?? null);
  }, [nodes, setSelectedNodeId]);

  const onNodeDragStop = useCallback<OnNodeDrag<WorkflowFlowNode>>(
    (_event, node) => moveNode(node.id, node.position),
    [moveNode],
  );

  const onConnect = useCallback<OnConnect>(
    (connection) =>
      connectNodes(
        connection.source,
        connection.target,
        toConditionBranch(connection.sourceHandle),
      ),
    [connectNodes],
  );

  return (
    <main className="relative min-w-0 flex-1 overflow-hidden bg-base">
      <ReactFlow
        aria-label="Workflow canvas"
        className="workflow-canvas"
        colorMode="dark"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={["Backspace", "Delete"]}
        minZoom={0.25}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.4, maxZoom: 1 }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color="var(--color-line-strong)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </main>
  );
}
