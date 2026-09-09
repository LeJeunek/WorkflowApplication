import { useMemo } from 'react';
import { Play, Redo2, Save, Undo2, Workflow } from 'lucide-react';

import { validateWorkflow } from '../domain/validation';
import { useWorkflowStore } from '../state/workflowStore';
import { SAVE_STATUS_PRESENTATION, getSaveStatus } from './saveStatusPresentation';
import { WorkflowSwitcher } from './WorkflowSwitcher';

/**
 * Top chrome: product identity, the current workflow's name and save state,
 * and the primary action.
 */
export function WorkflowHeader() {
  const name = useWorkflowStore((state) => state.workflow.name);
  const renameWorkflow = useWorkflowStore((state) => state.renameWorkflow);
  const runWorkflow = useWorkflowStore((state) => state.runWorkflow);
  const saveWorkflow = useWorkflowStore((state) => state.saveWorkflow);
  const isSaving = useWorkflowStore((state) => state.isSaving);
  const isDirty = useWorkflowStore((state) => state.isDirty);
  const saveError = useWorkflowStore((state) => state.saveError);
  const saveStatus = getSaveStatus({ isSaving, isDirty, saveError });
  const saveStatusPresentation = SAVE_STATUS_PRESENTATION[saveStatus];
  const SaveStatusIcon = saveStatusPresentation.icon;
  // A plain boolean, not a derived array -- keeps this selector from
  // triggering a re-render on every workflow change that doesn't actually
  // add or remove a trigger.
  const hasTrigger = useWorkflowStore((state) =>
    state.workflow.nodes.some((node) => node.type === "trigger"),
  );

  // The store's own actions (connectNodes, deleteNode, ...) already
  // maintain every invariant validateWorkflow checks, so a workflow built
  // entirely through this app's UI can never actually fail this. It exists
  // as a guard against a Workflow that *didn't* come from those actions --
  // hand-edited localStorage, or a future schema this version doesn't
  // fully understand (see persistence.ts). useMemo keyed on `workflow`
  // keeps this from re-running on every keystroke of the rename input,
  // which changes `workflow` but never affects validity.
  const workflow = useWorkflowStore((state) => state.workflow);
  const validation = useMemo(() => validateWorkflow(workflow), [workflow]);
  const canRun = hasTrigger && validation.valid;

  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const canUndo = useWorkflowStore((state) => state.past.length > 0);
  const canRedo = useWorkflowStore((state) => state.future.length > 0);

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

      <WorkflowSwitcher />

      <span className="h-5 w-px shrink-0 bg-line" aria-hidden="true" />

      <div className="flex min-w-0 items-center gap-3">
        <input
          type="text"
          aria-label="Workflow name"
          value={name}
          onChange={(event) => renameWorkflow(event.target.value)}
          className="min-w-0 shrink truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-ink-muted outline-none transition-colors hover:border-line-strong focus-visible:border-accent focus-visible:bg-elevated focus-visible:text-ink focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        <span
          className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-faint sm:inline-flex"
          title={saveStatus === "error" ? (saveError ?? undefined) : undefined}
        >
          <SaveStatusIcon
            className={`size-3.5 ${saveStatusPresentation.className}`}
            aria-hidden="true"
          />
          {saveStatusPresentation.label}
        </span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Save workflow"
          title="Save"
          disabled={!isDirty || isSaving}
          onClick={() => void saveWorkflow()}
          className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-faint"
        >
          <Save className="size-3.5" aria-hidden="true" />
        </button>

        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />

        <button
          type="button"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={() => undo()}
          className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-faint"
        >
          <Undo2 className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo (Ctrl+Y)"
          disabled={!canRedo}
          onClick={() => redo()}
          className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-faint"
        >
          <Redo2 className="size-3.5" aria-hidden="true" />
        </button>

        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />

        <button
          type="button"
          aria-label="Run workflow"
          disabled={!canRun}
          title={
            !hasTrigger
              ? "Add a trigger node to run this workflow."
              : !validation.valid
                ? validation.errors.map((error) => error.message).join("\n")
                : undefined
          }
          onClick={() => runWorkflow()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent"
        >
          <Play className="size-3.5 fill-current" aria-hidden="true" />
          Run
        </button>
      </div>
    </header>
  );
}
