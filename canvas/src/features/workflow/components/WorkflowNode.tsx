import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { Check, Cog, GitBranch, Minus, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useWorkflowStore } from '../state/workflowStore';
import { CONDITION_BRANCHES } from '../types';
import type { NodeRunStatus, NodeType } from '../types';

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

interface RunStatusPresentation {
  icon: LucideIcon;
  /** Background + icon colour for the badge itself. */
  badgeClassName: string;
  /** Prefixes the step's own detail text as the badge's accessible name. */
  label: string;
}

/**
 * Exhaustive over {@link NodeRunStatus}, same reasoning as
 * {@link NODE_PRESENTATION}: a new status fails to compile here until it's
 * given an appearance, rather than silently rendering no badge at all.
 *
 * Reuses the `trigger` token's green for "success" -- this codebase
 * already treats that colour as a generic affirmative signal (see the
 * "Saved" checkmarks in WorkflowHeader/WorkflowStatusBar), not something
 * scoped to trigger nodes specifically.
 */
const RUN_STATUS_PRESENTATION: Record<NodeRunStatus, RunStatusPresentation> = {
  success: { icon: Check, badgeClassName: 'bg-trigger text-base', label: 'Succeeded' },
  failure: { icon: X, badgeClassName: 'bg-danger text-base', label: 'Failed' },
  skipped: {
    icon: Minus,
    badgeClassName: 'bg-elevated text-ink-faint ring-1 ring-line',
    label: 'Skipped',
  },
};

/**
 * Custom renderer for every workflow node. React Flow supplies the drag,
 * selection and focus behaviour; this component owns only the appearance.
 */
export function WorkflowNode({
  id,
  type,
  data,
  selected,
}: NodeProps<WorkflowFlowNode>) {
  const { kicker, icon: Icon, tone } = NODE_PRESENTATION[type];

  // The *same* NodeRunResult object reference survives re-renders unless
  // runWorkflow() has produced a new lastRun -- so this node doesn't
  // re-render just because some other node's step changed.
  const runResult = useWorkflowStore((state) =>
    state.lastRun?.steps.find((step) => step.nodeId === id),
  );
  const runStatus = runResult
    ? RUN_STATUS_PRESENTATION[runResult.status]
    : undefined;

  return (
    <div
      className={`relative w-48 rounded-lg border bg-surface transition-colors ${
        selected
          ? 'border-accent ring-1 ring-accent/40'
          : 'border-line hover:border-line-strong'
      }`}
    >
      {runStatus && runResult && (
        <span
          role="status"
          aria-label={`${runStatus.label}: ${runResult.detail}`}
          title={runResult.detail}
          className={`absolute -right-2 -top-2 grid size-5 place-items-center rounded-full ring-2 ring-base ${runStatus.badgeClassName}`}
        >
          <runStatus.icon className="size-3" aria-hidden="true" />
        </span>
      )}

      {/* A trigger starts a workflow, so nothing may connect into it. */}
      {type !== 'trigger' ? (
        <Handle type="target" position={Position.Left} />
      ) : null}

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

      {type === 'condition' ? (
        <div className="border-t border-line">
          {CONDITION_BRANCHES.map((branch, index) => (
            <div
              key={branch}
              className={`relative flex items-center justify-end px-2.5 py-1.5 text-[10px] font-medium text-ink-faint ${
                index > 0 ? 'border-t border-line' : ''
              }`}
            >
              {branch === 'true' ? 'True' : 'False'}
              <Handle type="source" id={branch} position={Position.Right} />
            </div>
          ))}
        </div>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}
