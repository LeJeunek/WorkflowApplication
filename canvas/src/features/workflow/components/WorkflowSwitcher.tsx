import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FilePlus, Trash2 } from 'lucide-react';

import { useWorkflowStore } from '../state/workflowStore';

/** Relative-enough for a switcher row without pulling in a date library for one string. */
function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Header control for moving between saved workflows: open the current
 * document's name to reveal every other saved workflow, start a new one, or
 * delete one. The list itself (`workflowList`) is loaded once, on mount, by
 * WorkflowEditor -- this component only reads it and triggers the
 * open/new/delete actions.
 */
export function WorkflowSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const workflowList = useWorkflowStore((state) => state.workflowList);
  const currentId = useWorkflowStore((state) => state.workflow.id);
  const openWorkflow = useWorkflowStore((state) => state.openWorkflow);
  const newWorkflow = useWorkflowStore((state) => state.newWorkflow);
  const deleteWorkflow = useWorkflowStore((state) => state.deleteWorkflow);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Switch workflow"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-ink-faint transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Saved workflows"
          className="absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              newWorkflow();
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-elevated"
          >
            <FilePlus className="size-3.5 text-ink-faint" aria-hidden="true" />
            New workflow
          </button>

          {workflowList.length > 0 ? (
            <div className="my-1 border-t border-line" />
          ) : null}

          <ul>
            {workflowList.map((row) => (
              <li key={row.id} className="group flex items-center">
                <button
                  type="button"
                  role="menuitem"
                  aria-current={row.id === currentId}
                  onClick={() => {
                    openWorkflow(row.id).catch(() => {
                      // saveError (surfaced in the header/status bar) already
                      // reflects the failure -- nothing further to do here.
                    });
                    setIsOpen(false);
                  }}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-elevated ${
                    row.id === currentId ? "font-medium text-ink" : "text-ink-muted"
                  }`}
                >
                  <span className="min-w-0 truncate">{row.name}</span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {formatUpdatedAt(row.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete "${row.name}"`}
                  onClick={() => {
                    if (window.confirm(`Delete "${row.name}"? This can't be undone.`)) {
                      deleteWorkflow(row.id).catch(() => {
                        // saveError already reflects the failure.
                      });
                    }
                  }}
                  className="mr-1 shrink-0 rounded p-1 text-ink-faint opacity-0 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
