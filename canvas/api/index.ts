import app from "../server/app.ts";

// Vercel serverless entry point. vercel.json rewrites every `/api/*`
// request here; Express sees the original path (e.g. `/api/workflows`)
// and routes it internally exactly as it does locally.
export default app;
