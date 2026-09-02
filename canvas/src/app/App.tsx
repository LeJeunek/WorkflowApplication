import { WorkflowEditor } from "../features/workflow/components/WorkflowEditor";
import { ReactFlowProvider } from "@xyflow/react";

/**
 * `ReactFlowProvider` wraps the whole shell rather than living inside
 * `CanvasArea`: the component that renders `<ReactFlow>` sits *outside* the
 * context that element creates, so it cannot call `useReactFlow`/`useStore`
 * itself. Hoisting the provider lets the canvas -- and sibling panels like the
 * palette -- read viewport state.
 */
export default function App() {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  );
}
