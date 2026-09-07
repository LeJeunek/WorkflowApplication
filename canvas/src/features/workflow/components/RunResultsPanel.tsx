import { useState } from 'react';
import { X } from 'lucide-react';

import { RUN_STATUS_PRESENTATION } from './runStatusPresentation';
import { useWorkflowStore } from '../state/workflowStore';

/**
 * A dismissible, full-width report shown the moment Run finishes: every
 * step in order, in plain language, so "what did this actually do" doesn't
 * require hovering each node's badge individually to find out.
 */
export function RunResultsPanel() {
  const lastRun = useWorkflowStore((state) => state.lastRun);
  const nodes = useWorkflowStore((state) => state.workflow.nodes);

  // Tracks the id of a run the user has explicitly closed. Deliberately
  // separate from `lastRun` itself, which stays in the store regardless --
  // WorkflowNode's per-node badges still need it even after this panel is
  // dismissed. A fresh Run always gets a new id (crypto.randomUUID()), so
  // dismissing one run's panel never suppresses the next one's.
  const [dismissedRunId, setDismissedRunId] = useState<string | null>(null);

  if (!lastRun || lastRun.id === dismissedRunId) {
    return null;
  }

  const succeeded = lastRun.steps.filter((step) => step.status === 'success').length;
  const failed = lastRun.steps.filter((step) => step.status === 'failure').length;
  const skipped = lastRun.steps.filter((step) => step.status === 'skipped').length;

  const summary = [
    succeeded > 0 ? `${succeeded} succeeded` : null,
    failed > 0 ? `${failed} failed` : null,
    skipped > 0 ? `${skipped} skipped` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <section
      aria-label="Run results"
      className="border-b border-line bg-surface px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Run results
        </p>
        <p className="text-xs text-ink-muted">{summary || 'Nothing ran'}</p>
        <button
          type="button"
          aria-label="Dismiss run results"
          onClick={() => setDismissedRunId(lastRun.id)}
          className="ml-auto rounded-md p-1 text-ink-faint transition-colors hover:bg-elevated hover:text-ink"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <ol className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
        {lastRun.steps.map((step) => {
          const presentation = RUN_STATUS_PRESENTATION[step.status];
          const Icon = presentation.icon;
          const node = nodes.find((candidate) => candidate.id === step.nodeId);

          return (
            <li key={step.nodeId} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${presentation.badgeClassName}`}
              >
                <Icon className="size-2.5" aria-hidden="true" />
              </span>
              <span className="leading-relaxed">
                <span className="font-medium text-ink">
                  {node?.data.label ?? 'Deleted step'}
                </span>
                <span className="text-ink-faint"> -- {step.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
