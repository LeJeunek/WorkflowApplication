import express from "express";

import workflowsRouter from "./routes/workflows.ts";

// Just the Express app, with no `listen()` call -- shared between the local
// dev/prod entry point (index.ts) and the Vercel serverless entry point
// (../api/index.ts), which hands this straight to Vercel's Node runtime
// instead of binding a port itself.
const app = express();

app.use(express.json());
app.use("/api/workflows", workflowsRouter);

export default app;
