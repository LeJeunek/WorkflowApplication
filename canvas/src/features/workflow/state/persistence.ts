import { createJSONStorage } from "zustand/middleware";
import type { PersistStorage } from "zustand/middleware";

import type { Workflow } from "../types";

/** Storage key. Bump {@link PERSISTENCE_VERSION} instead of changing this. */
export const PERSISTENCE_KEY = "canvas:workflow";

/**
 * Schema version of the persisted document. `persist`'s default behavior
 * for a mismatch is to discard the stored value and fall back to the
 * store's initial state -- fine for now (there is no `migrate` yet because
 * there is nothing to migrate from), but bump this the first time a saved
 * workflow's shape changes in a way old data can't satisfy.
 */
export const PERSISTENCE_VERSION = 1;

/**
 * The slice of store state that gets saved. Deliberately excludes
 * `selectedNodeId`: it's ephemeral UI state, not part of the document, and
 * has no business surviving a reload (or being carried across two tabs
 * pointed at the same key).
 */
export interface PersistedWorkflowState {
  workflow: Workflow;
}

/**
 * Active storage engine: the browser's `localStorage`, wrapped so
 * `persist` can JSON (de)serialize the workflow through it.
 *
 * This is the seam to change when swapping backends: `PersistStorage` only
 * requires `getItem`/`setItem`/`removeItem`, and `getItem` is allowed to
 * return a `Promise` -- so a network-backed engine (see the commented
 * sketch below) drops in here without `workflowStore.ts` changing at all.
 */
export const workflowStorage: PersistStorage<PersistedWorkflowState> | undefined =
  createJSONStorage(() => localStorage);

/* ------------------------------------------------------------------------
 * FUTURE: Postgres-backed persistence via Prisma
 * ------------------------------------------------------------------------
 * Not wired up, and not meant to run yet -- kept here as the concrete
 * target for when this app grows a server. Left commented rather than
 * deleted so the shape doesn't need to be re-derived from scratch later.
 *
 * Prisma Client is Node-only: it cannot be imported into this Vite client
 * bundle. Swapping to Postgres therefore means two pieces, not one --
 * a client-side storage engine that talks HTTP (below), and a server
 * endpoint it talks to (sketched further down, plus prisma/schema.prisma
 * at the project root for the table shape). The client piece is the only
 * one that belongs in this file.
 *
 * To activate:
 *   1. Stand up a server (a small Node/Express app, or a framework's API
 *      routes -- this repo has neither yet, so that choice is still open).
 *   2. `npm install -D prisma` and `npm install @prisma/client` in the
 *      server project, then `npx prisma migrate dev` against
 *      prisma/schema.prisma.
 *   3. Implement the two routes sketched below.
 *   4. In workflowStore.ts, swap `storage: workflowStorage` for
 *      `storage: remoteWorkflowStorage`.
 *
 * ---
 *
 * const remoteEngine: StateStorage = {
 *   async getItem(name) {
 *     const response = await fetch(`/api/workflows/${encodeURIComponent(name)}`);
 *     if (response.status === 404) return null;
 *     if (!response.ok) {
 *       throw new Error(`Failed to load workflow "${name}": ${response.status}`);
 *     }
 *     return response.text();
 *   },
 *   async setItem(name, value) {
 *     const response = await fetch(`/api/workflows/${encodeURIComponent(name)}`, {
 *       method: "PUT",
 *       headers: { "Content-Type": "application/json" },
 *       body: value,
 *     });
 *     if (!response.ok) {
 *       throw new Error(`Failed to save workflow "${name}": ${response.status}`);
 *     }
 *   },
 *   async removeItem(name) {
 *     await fetch(`/api/workflows/${encodeURIComponent(name)}`, { method: "DELETE" });
 *   },
 * };
 *
 * export const remoteWorkflowStorage: PersistStorage<PersistedWorkflowState> | undefined =
 *   createJSONStorage(() => remoteEngine);
 *
 * ---
 *
 * Server side (illustrative only -- framework choice is not yet decided;
 * this shows the contract the client engine above expects, not a
 * committed implementation). `state`/`version` are exactly what
 * `createJSONStorage` sends and expects back, matching zustand's
 * `StorageValue<PersistedWorkflowState>` shape:
 *
 * import { PrismaClient } from "@prisma/client";
 * const prisma = new PrismaClient();
 *
 * app.put("/api/workflows/:name", async (req, res) => {
 *   const { state } = req.body as { state: PersistedWorkflowState; version: number };
 *   const { workflow } = state;
 *   await prisma.workflow.upsert({
 *     where: { id: req.params.name },
 *     create: {
 *       id: req.params.name,
 *       name: workflow.name,
 *       description: workflow.description,
 *       nodes: workflow.nodes,
 *       edges: workflow.edges,
 *     },
 *     update: {
 *       name: workflow.name,
 *       description: workflow.description,
 *       nodes: workflow.nodes,
 *       edges: workflow.edges,
 *     },
 *   });
 *   res.status(204).end();
 * });
 *
 * app.get("/api/workflows/:name", async (req, res) => {
 *   const row = await prisma.workflow.findUnique({ where: { id: req.params.name } });
 *   if (!row) return res.status(404).end();
 *   res.json({
 *     version: PERSISTENCE_VERSION,
 *     state: {
 *       workflow: {
 *         id: row.id,
 *         name: row.name,
 *         description: row.description ?? undefined,
 *         nodes: row.nodes,
 *         edges: row.edges,
 *         createdAt: row.createdAt.toISOString(),
 *         updatedAt: row.updatedAt.toISOString(),
 *       },
 *     },
 *   });
 * });
 * ------------------------------------------------------------------------ */
