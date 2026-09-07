import { useEffect } from 'react';

import { useWorkflowStore } from '../state/workflowStore';
import { CanvasArea } from './CanvasArea';
import { Inspector } from './Inspector';
import { NodePalette } from './NodePalette';
import { RunResultsPanel } from './RunResultsPanel';
import { WorkflowHeader } from './WorkflowHeader';
import { WorkflowStatusBar } from './WorkflowStatusBar';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

// Ctrl/Cmd+Z and Ctrl/Cmd+Y must not fire while the user is mid-edit in a
// text field -- that keystroke belongs to the field's own native undo, not
// the workflow's.
function isEditingText(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable)
  );
}

/**
 * Application shell: fixed header and status bar with a three-column
 * palette / canvas / inspector body between them.
 */
export function WorkflowEditor() {
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isEditingText(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-base text-ink">
      <WorkflowHeader />
      <RunResultsPanel />
      <div className="flex min-h-0 flex-1">
        <NodePalette />
        <CanvasArea />
        <Inspector />
      </div>
      <WorkflowStatusBar />
    </div>
  );
}
