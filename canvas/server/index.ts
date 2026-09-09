import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import workflowsRouter from "./routes/workflows.ts";

const app = express();
const PORT = 3001;

app.use(express.json());
app.use("/api/workflows", workflowsRouter);

// Single-deployable story: in production the same process serves the built
// client and the API, so there's no separate origin/proxy to configure.
// Dev keeps using Vite's own dev server for the client (see the `/api`
// proxy in vite.config.ts), so this branch is inert until a real deploy.
if (process.env.NODE_ENV === "production") {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.join(dirname, "..", "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
