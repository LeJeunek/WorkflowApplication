import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { Cog, GitBranch, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NodeType } from '../types';

/**
 * The slice of {@link NodeData} the renderer needs.
 *
 * Declared here rather than reusing the domain `NodeData` directly: React
 * Flow constrains node data to `Record<string, unknown>`, and `config` is not
 * something the node body draws. The adapter narrows domain data to this.
 */
export type WorkflowNodeViewData = {
  label: string;
  description?: string;
};

/** A React Flow node backed by our domain model. */
export type WorkflowFlowNode = Node<WorkflowNodeViewData, NodeType>;

interface NodePresentation {
  /** Uppercase kicker shown above the node's label. */
  kicker: string;
  icon: LucideIcon;
  /** Tailwind text colour keyed to the node type. */
  tone: string;
}

/**
 * Exhaustive over {@link NodeType}, so adding a node type to the domain model
 * fails to compile until its presentation is defined here.
 */
const NODE_PRESENTATION: Record<NodeType, NodePresentation> = {
  trigger: { kicker: 'Trigger', icon: Zap, tone: 'text-trigger' },
  action: { kicker: 'Action', icon: Cog, tone: 'text-action' },
  condition: { kicker: 'Condition', icon: GitBranch, tone: 'text-condition' },
};

/**
 * Custom renderer for every workflow node. React Flow supplies the drag,
 * selection and focus behaviour; this component owns only the appearance.
 */
export function WorkflowNode({
  type,
  data,
  selected,
}: NodeProps<WorkflowFlowNode>) {
  const { kicker, icon: Icon, tone } = NODE_PRESENTATION[type];

  return (
    <div
      className={`w-48 rounded-lg border bg-surface transition-colors ${
        selected
          ? 'border-accent ring-1 ring-accent/40'
          : 'border-line hover:border-line-strong'
      }`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center gap-2 border-b border-line px-2.5 py-1.5">
        <span
          className={`grid size-5 shrink-0 place-items-center rounded bg-elevated ring-1 ring-line ${tone}`}
        >
          <Icon className="size-3" aria-hidden="true" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          {kicker}
        </span>
      </div>

      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-medium text-ink">{data.label}</p>
        {data.description ? (
          <p className="mt-0.5 truncate text-[11px] text-ink-faint">
            {data.description}
          </p>
        ) : null}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
