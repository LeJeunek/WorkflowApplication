import type { Workflow, WorkflowId, WorkflowSummary } from "../types";

/** The parts of a Workflow the client sends -- `createdAt`/`updatedAt` are server-stamped. */
export interface WorkflowInput {
  name: string;
  description?: string;
  nodes: Workflow["nodes"];
  edges: Workflow["edges"];
}

async function expectOk(response: Response, action: string): Promise<Response> {
  if (!response.ok) {
    throw new Error(`Failed to ${action}: ${response.status}`);
  }
  return response;
}

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const response = await fetch("/api/workflows");
  await expectOk(response, "load workflow list");
  return response.json() as Promise<WorkflowSummary[]>;
}

export async function fetchWorkflow(id: WorkflowId): Promise<Workflow> {
  const response = await fetch(`/api/workflows/${encodeURIComponent(id)}`);
  await expectOk(response, `load workflow "${id}"`);
  return response.json() as Promise<Workflow>;
}

export async function createWorkflow(
  id: WorkflowId,
  input: WorkflowInput,
): Promise<Workflow> {
  const response = await fetch("/api/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...input }),
  });
  await expectOk(response, "save new workflow");
  return response.json() as Promise<Workflow>;
}

export async function saveWorkflow(
  id: WorkflowId,
  input: WorkflowInput,
): Promise<Workflow> {
  const response = await fetch(`/api/workflows/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await expectOk(response, `save workflow "${id}"`);
  return response.json() as Promise<Workflow>;
}

export async function deleteWorkflow(id: WorkflowId): Promise<void> {
  const response = await fetch(`/api/workflows/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await expectOk(response, `delete workflow "${id}"`);
}
