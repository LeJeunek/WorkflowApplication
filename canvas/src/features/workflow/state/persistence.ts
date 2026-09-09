/**
 * The full workflow document is no longer auto-saved to `localStorage` --
 * with multiple saved workflows now living on the server (see
 * `remoteWorkflows.ts` and `prisma/schema.prisma`), the server is the
 * source of truth and saving is an explicit action (`workflowStore.ts`'s
 * `saveWorkflow`), not a side effect of every edit.
 *
 * The one thing still worth remembering locally is *which* workflow was
 * open last, purely so a reload lands back where the user left off instead
 * of always starting from a blank document. This is a single string, not a
 * whole document, so a couple of plain functions over `localStorage` are
 * enough -- no need for zustand's `persist` middleware (or JSON
 * (de)serialization) for one field.
 */
const LAST_OPENED_WORKFLOW_ID_KEY = "canvas:lastWorkflowId";

export function getLastOpenedWorkflowId(): string | null {
  return localStorage.getItem(LAST_OPENED_WORKFLOW_ID_KEY);
}

export function setLastOpenedWorkflowId(id: string): void {
  localStorage.setItem(LAST_OPENED_WORKFLOW_ID_KEY, id);
}
