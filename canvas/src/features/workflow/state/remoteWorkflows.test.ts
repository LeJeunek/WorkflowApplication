import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createWorkflow,
  deleteWorkflow,
  fetchWorkflow,
  listWorkflows,
  saveWorkflow,
} from "./remoteWorkflows";
import type { WorkflowInput } from "./remoteWorkflows";

const SUMMARY = { id: "w1", name: "Signup flow", updatedAt: "2026-01-01T00:00:00.000Z" };
const WORKFLOW = {
  id: "w1",
  name: "Signup flow",
  nodes: [],
  edges: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const INPUT: WorkflowInput = { name: "Signup flow", nodes: [], edges: [] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listWorkflows", () => {
  it("GETs the list endpoint and returns the parsed summaries", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([SUMMARY]));

    const result = await listWorkflows();

    expect(fetch).toHaveBeenCalledWith("/api/workflows");
    expect(result).toEqual([SUMMARY]);
  });

  it("throws with the status code when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(null, 500));

    await expect(listWorkflows()).rejects.toThrow("500");
  });
});

describe("fetchWorkflow", () => {
  it("GETs the workflow by id, URL-encoded", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(WORKFLOW));

    const result = await fetchWorkflow("w 1");

    expect(fetch).toHaveBeenCalledWith("/api/workflows/w%201");
    expect(result).toEqual(WORKFLOW);
  });

  it("throws when the workflow is missing", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(null, 404));

    await expect(fetchWorkflow("missing")).rejects.toThrow("404");
  });
});

describe("createWorkflow", () => {
  it("POSTs the id and input as JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(WORKFLOW, 201));

    const result = await createWorkflow("w1", INPUT);

    expect(fetch).toHaveBeenCalledWith("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "w1", ...INPUT }),
    });
    expect(result).toEqual(WORKFLOW);
  });
});

describe("saveWorkflow", () => {
  it("PUTs the input to the workflow's URL", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(WORKFLOW));

    const result = await saveWorkflow("w1", INPUT);

    expect(fetch).toHaveBeenCalledWith("/api/workflows/w1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(INPUT),
    });
    expect(result).toEqual(WORKFLOW);
  });
});

describe("deleteWorkflow", () => {
  it("DELETEs the workflow's URL", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await deleteWorkflow("w1");

    expect(fetch).toHaveBeenCalledWith("/api/workflows/w1", { method: "DELETE" });
  });

  it("throws when the workflow is missing", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));

    await expect(deleteWorkflow("missing")).rejects.toThrow("404");
  });
});
