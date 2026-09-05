import { useMemo } from 'react';
import { AlertTriangle, Check, Maximize } from 'lucide-react';

import { validateWorkflow } from '../domain/validation';
import { useWorkflowStore } from '../state/workflowStore';

/** Bottom rail carrying ambient document and viewport state. */
export function WorkflowStatusBar() {
  const workflow = useWorkflowStore((state) => state.workflow);
  const validation = useMemo(() => validateWorkflow(workflow), [workflow]);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface px-3 text-[11px] text-ink-faint">
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-3 text-trigger" aria-hidden="true" />
        Saved
      </span>

      {validation.valid ? (
        <span
          className="inline-flex items-center gap-1.5"
          title="No structural issues found."
        >
          <Check className="size-3 text-trigger" aria-hidden="true" />
          Valid
        </span>
      ) : (
        <span
          role="status"
          aria-label={`${validation.errors.length} validation ${validation.errors.length === 1 ? "issue" : "issues"}: ${validation.errors.map((error) => error.message).join(" ")}`}
          title={validation.errors.map((error) => error.message).join("\n")}
          className="inline-flex items-center gap-1.5 text-danger"
        >
          <AlertTriangle className="size-3" aria-hidden="true" />
          {validation.errors.length}{" "}
          {validation.errors.length === 1 ? "issue" : "issues"}
        </span>
      )}

      <span className="ml-auto inline-flex items-center gap-1.5">
        <Maximize className="size-3" aria-hidden="true" />
        <span className="sr-only">Zoom level</span>
        <span className="tabular-nums">100%</span>
      </span>
    </footer>
  );
}
