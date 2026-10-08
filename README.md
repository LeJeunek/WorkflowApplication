# Canvas: Visual Workflow Builder

Drag Trigger, Action, and Condition nodes onto a canvas, connect them, and click **Run**. Canvas simulates the execution against sample data and shows which branch each condition took, which steps ran, which were skipped, and why.

**[Live demo](https://workflow-application-nu.vercel.app)**

Built with React 19, TypeScript, React Flow, and an Express and Prisma API on PostgreSQL.

> The app lives in the [`canvas`](canvas) folder. Its [README](canvas/README.md) is the full architecture and feature reference.

## What it does

- **Build workflows visually.** Add nodes from a palette, drag to connect them, and edit each node's settings in an inspector panel.
- **Run a simulated execution.** Conditions are evaluated against the trigger's sample data. Only the matching branch runs, and the skipped branch is marked all the way down.
- **Read results in plain language.** Each node gets a status badge, and a results panel lists every step, for example: `Checked whether "customer.plan" equals "pro" -- it was true, so this took the True path.`
- **Enter sample data without writing JSON.** A row-per-field editor with explicit types (text, number, true/false) sits alongside a raw JSON tab.
- **Undo and redo.** Every change is undoable, and rapid edits to one field collapse into a single step.
- **Save and switch between workflows.** Workflows are stored in PostgreSQL through a REST API, so they are available from any device.
- **Catch invalid graphs.** Cycles, self-loops, duplicate connections, and dangling edges are rejected as you draw, and a whole-graph validator guards against corrupted saved data.

### Node types

| Node | Options |
|---|---|
| **Trigger** | Event, schedule, form submission |
| **Action** | Send email, HTTP request, add tag, Slack message, validate order, calculate order total, manual review, process shipment, cancel order |
| **Condition** | Compare a payload field using equals, not equals, contains, greater than, or less than |

Actions are simulated. A Slack message action reports what it would have sent instead of posting to Slack. The point of the project is the graph: how data flows, which branch a condition takes, and why.

## Engineering highlights

- **Framework-free domain layer.** Graph rules, validation, condition evaluation, and the execution engine are pure TypeScript functions with no React, Zustand, or React Flow imports. The engine was built and fully tested before any UI existed.
- **Strict one-way layering.** The Zustand store holds the canonical state, and React Flow is synced from it through a single adapter file, never the other way around.

  ```
  Zustand store  →  domain model  →  canvas adapter  →  React Flow
  ```

- **Three test layers.** Close to 300 Vitest unit and component tests across 18 files, plus 28 Playwright end-to-end tests in real Chromium for drag-and-drop and connection drawing.
- **One codebase, two deploy targets.** The Express API runs as a normal Node server locally and as a bundled Vercel Function in production.

## Tech stack

| Layer | Tools |
|---|---|
| Client | React 19, TypeScript (strict), Vite, React Flow (`@xyflow/react`), Zustand, Tailwind CSS v4 |
| Server | Express 5, Prisma 6, PostgreSQL (Neon) |
| Testing | Vitest, React Testing Library, Playwright |
| Hosting | Vercel |

## Running locally

**Prerequisites:** Node.js 20 or later. Saving workflows also needs a PostgreSQL database, such as a free Neon project.

```bash
git clone https://github.com/LeJeunek/WorkflowApplication.git
cd WorkflowApplication/canvas
npm install
npm run dev          # client at http://localhost:5173
```

The client runs on its own with no setup, because all execution is simulated in the browser. To enable saving:

```bash
cp .env.example .env                    # then fill in DATABASE_URL and DATABASE_URL_UNPOOLED
npx prisma migrate dev --name init      # first run only
npm run server                          # API at http://localhost:3001, in a second terminal
```

### Tests

```bash
npm test             # Vitest: unit and component tests
npm run test:e2e     # Playwright: end-to-end tests in Chromium
npm run lint
npm run build
```

## Project structure

```
canvas/
  src/features/workflow/
    types.ts         domain model, with no framework imports
    domain/          pure functions: graph rules, validation, evaluation, execution
    state/           Zustand store and the API client
    components/      canvas, palette, inspector, results panel
  server/            Express API and workflow routes
  prisma/            schema and migrations
  api/               bundled server for Vercel Functions
  e2e/               Playwright specs
```

## Roadmap

- Multi-select
- Duplicate node

## Author

Built by Kyle LeJeune ([@LeJeunek](https://github.com/LeJeunek)).
