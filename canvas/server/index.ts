import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import app from "./app.ts";

const PORT = 3001;

// Single-deployable story for a non-Vercel host: in production the same
// process serves the built client and the API, so there's no separate
// origin/proxy to configure. Dev keeps using Vite's own dev server for the
// client (see the `/api` proxy in vite.config.ts), so this branch is inert
// until a real deploy. On Vercel, this file never runs at all -- see
// ../api/index.ts, which exports `app` directly as a serverless function.
if (process.env.NODE_ENV === "production") {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.join(dirname, "..", "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
