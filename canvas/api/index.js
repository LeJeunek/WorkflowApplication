// server/app.ts
import express from "express";

// server/routes/workflows.ts
import { Router } from "express";

// server/db.ts
import { PrismaClient } from "@prisma/client";
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// server/routes/workflows.ts
var router = Router();
router.get("/", async (_req, res) => {
  const rows = await prisma.workflow.findMany({
    select: { id: true, name: true, description: true, updatedAt: true },
    orderBy: { updatedAt: "desc" }
  });
  res.json(rows);
});
router.get("/:id", async (req, res) => {
  const row = await prisma.workflow.findUnique({ where: { id: req.params.id } });
  if (!row) {
    res.status(404).end();
    return;
  }
  res.json(row);
});
router.post("/", async (req, res) => {
  const { id, name, description, nodes, edges } = req.body;
  const row = await prisma.workflow.create({
    data: { id, name, description, nodes, edges }
  });
  res.status(201).json(row);
});
router.put("/:id", async (req, res) => {
  const { name, description, nodes, edges } = req.body;
  try {
    const row = await prisma.workflow.update({
      where: { id: req.params.id },
      data: { name, description, nodes, edges }
    });
    res.json(row);
  } catch {
    res.status(404).end();
  }
});
router.delete("/:id", async (req, res) => {
  try {
    await prisma.workflow.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).end();
  }
});
var workflows_default = router;

// server/app.ts
var app = express();
app.use(express.json());
app.use("/api/workflows", workflows_default);
var app_default = app;
export {
  app_default as default
};
