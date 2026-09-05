import { Check, Play, Workflow } from 'lucide-react';

import { useWorkflowStore } from '../state/workflowStore';

/**
 * Top chrome: product identity, the current workflow's name and save state,
 * and the primary action.
 */
export function WorkflowHeader() {
  const name = useWorkflowStore((state) => state.workflow.name);
  const renameWorkflow = useWorkflowStore((state) => state.renameWorkflow);
  const runWorkflow = useWorkflowStore((state) => state.runWorkflow);
  // A plain boolean, not a derived array -- keeps this selector from
  // triggering a re-render on every workflow change that doesn't actually
  // add or remove a trigger.
  const hasTrigger = useWorkflowStore((state) =>
    state.workflow.nodes.some((node) => node.type === "trigger"),
  );

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-md bg-accent/15 text-accent ring-1 ring-accent/25">
          <Workflow className="size-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-ink">
          Canvas
        </span>
      </div>

      <span className="h-5 w-px shrink-0 bg-line" aria-hidden="true" />

      <div className="flex min-w-0 items-center gap-3">
        <input
          type="text"
          aria-label="Workflow name"
          value={name}
          onChange={(event) => renameWorkflow(event.target.value)}
          className="min-w-0 shrink truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-ink-muted outline-none transition-colors hover:border-line-strong focus-visible:border-accent focus-visible:bg-elevated focus-visible:text-ink focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-faint sm:inline-flex">
          <Check className="size-3.5 text-trigger" aria-hidden="true" />
          Saved
        </span>
      </div>

      <button
        type="button"
        aria-label="Run workflow"
        disabled={!hasTrigger}
        onClick={() => runWorkflow()}
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent"
      >
        <Play className="size-3.5 fill-current" aria-hidden="true" />
        Run
      </button>
    </header>
  );
}
