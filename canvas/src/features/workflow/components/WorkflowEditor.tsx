import { CanvasArea } from './CanvasArea';
import { Inspector } from './Inspector';
import { NodePalette } from './NodePalette';
import { WorkflowHeader } from './WorkflowHeader';
import { WorkflowStatusBar } from './WorkflowStatusBar';

/**
 * Application shell: fixed header and status bar with a three-column
 * palette / canvas / inspector body between them.
 */
export function WorkflowEditor() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-base text-ink">
      <WorkflowHeader />
      <div className="flex min-h-0 flex-1">
        <NodePalette />
        <CanvasArea />
        <Inspector />
      </div>
      <WorkflowStatusBar />
    </div>
  );
}
