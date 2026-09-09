import { Router } from "express";
import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";

import { prisma } from "../db.ts";

const router = Router();

/** Body shared by create and update -- the parts of a Workflow the client owns. */
interface WorkflowInput {
  name: string;
  description?: string;
  nodes: Prisma.InputJsonValue;
  edges: Prisma.InputJsonValue;
}

/** Lightweight row for the workflow-switcher list -- no `nodes`/`edges`. */
router.get("/", async (_req: Request, res: Response) => {
  const rows = await prisma.workflow.findMany({
    select: { id: true, name: true, description: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json(rows);
});

router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const row = await prisma.workflow.findUnique({ where: { id: req.params.id } });
  if (!row) {
    res.status(404).end();
    return;
  }
  res.json(row);
});

/**
 * The client generates the id (see workflowStore.ts's `newWorkflow` -- ids
 * are only ever minted in one place in this app), so create takes it from
 * the body rather than relying on the schema's `@default(uuid())` fallback.
 */
router.post("/", async (req: Request, res: Response) => {
  const { id, name, description, nodes, edges } = req.body as WorkflowInput & { id: string };
  const row = await prisma.workflow.create({
    data: { id, name, description, nodes, edges },
  });
  res.status(201).json(row);
});

router.put("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { name, description, nodes, edges } = req.body as WorkflowInput;
  try {
    const row = await prisma.workflow.update({
      where: { id: req.params.id },
      data: { name, description, nodes, edges },
    });
    res.json(row);
  } catch {
    // Prisma throws (P2025) rather than returning null when the row is
    // missing, unlike findUnique -- catching is the only way to 404 here.
    res.status(404).end();
  }
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.workflow.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).end();
  }
});

export default router;
