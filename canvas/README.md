# Canvas

A visual workflow builder: drag Trigger, Action, and Condition nodes onto a canvas, wire them together, and click **Run** to simulate an actual execution — conditions get evaluated against real data, branches get taken or skipped, and every node shows what happened to it.

Everything runs client-side. There's no backend and no real integrations — a "Slack message" action doesn't post to Slack, it *simulates* one and tells you what it would have sent. The point is the graph: how data flows, which branch a condition takes, and why.

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Canvas    [Workflow name]              ✓ Saved         [▶ Run] │
├───────────┬───────────────────────────────────────┬─────────────┤
│           │                                       │             │
│  Nodes    │              Canvas                   │  Inspector  │
│  (palette)│         (drag / zoom / connect)        │  (selected  │
│           │                                       │   node's    │
│           │                                       │   fields)   │
│           │                                       │             │
├───────────┴───────────────────────────────────────┴─────────────┤
│  ✓ Saved   ✓ Valid                                    ⤢ 100%    │
└─────────────────────────────────────────────────────────────────┘
```

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # Vitest — unit + component tests
npm run test:e2e   # Playwright — real Chromium
npm run build      # tsc -b && vite build
npm run lint
```

## Try it

Two walkthroughs, both copied from this repo's own Playwright tests — every step below is something the test suite actually clicks through and asserts on, not just a description.

### 1. A branching workflow that actually runs

The seed workflow's trigger already carries sample data (`{ customer: { id, name, plan: "pro" } }`) so this works without typing any JSON yourself.

1. Click **Condition** in the palette, then **Action** twice.
2. Select the condition node. In the Inspector, set **Field** to `customer.plan` and **Value** to `pro` (Operator defaults to `equals`).
3. Select the first action node. Change its **Kind** to *Slack message*, set **Channel** to `#signups` and **Message** to whatever you like.
4. Select the second action node. Change its **Kind** to *Add tag*, set **Tag** to `needs-follow-up`.
5. Drag a connection from the trigger to the condition, then from the condition's **True** handle to the first action, and **False** to the second.
6. Click **Run**.

The Slack action gets a green *Succeeded* badge — hover it to see the exact message the "run" would have sent. The Add tag action gets a grey *Skipped* badge, since the sample payload's `plan` is `"pro"`, not whatever would make the condition false. Edit the condition's **Value** to something that doesn't match and run again — the badges swap.

### 2. Seeing validation catch a broken workflow

The app's own UI can't actually build an invalid graph — every rule below is already enforced incrementally as you connect nodes (`connectNodes` rejects a dangling connection before it's ever created, `deleteNode` cascades edge removal so nothing is ever left dangling). So the only realistic way to see this fire is the same way it'd happen for real: a workflow saved by an older version of the app, or hand-edited storage.

1. Open your browser's DevTools → Application → Local Storage, and find the `canvas:workflow` key.
2. Edit the JSON: change one edge's `target` to a node id that doesn't exist elsewhere in the document.
3. Reload the page.

The status bar's "Valid" indicator turns into a red "1 issue" with the exact problem in its tooltip, and **Run** disables itself with the same explanation in its own tooltip.

## Architecture

The throughline of this codebase is a strict one-way layering:

```
Zustand store  →  domain model  →  canvas adapter  →  @xyflow/react
```

- **`src/features/workflow/types.ts`** — the domain model. Plain TypeScript types with zero framework imports: no Zustand, no React Flow. `Workflow`, `WorkflowNode` (a `TriggerNode | ActionNode | ConditionNode` discriminated union), `WorkflowEdge`, and the execution types (`NodeRunResult`, `WorkflowRun`) all live here.
- **`src/features/workflow/domain/`** — pure functions over those types. `graph.ts` (cycle detection, connection rules), `validation.ts` (whole-graph structural diagnostics), `evaluate.ts` (condition evaluation), `execution.ts` (the interpreter that walks a workflow and produces a run). None of these touch Zustand or React Flow, and none of them generate an id or a timestamp — that's the store's job, so every one of them is a plain, deterministic function you can unit test with `toEqual(...)` and nothing else.
- **`src/features/workflow/state/workflowStore.ts`** — the canonical state, via Zustand's `persist` middleware (to `localStorage`, see below). Every mutation goes through here; this is the only place `crypto.randomUUID()` or a timestamp gets generated.
- **`src/features/workflow/components/CanvasArea.tsx`** — the adapter. The only file that knows about both the domain model and React Flow's own node/edge shapes. React Flow's internal state (dragging, measured size, selection) is never treated as canonical — it's synced *from* the store, not the other way around.

The payoff: the entire execution engine (evaluate → execute) was built and fully tested without a single line of UI code, then wired into the store, then given a UI — in that order, each layer verified before the next depended on it.

## Domain model

| Node type | Config kinds |
|---|---|
| **Trigger** | `event` (`event: string`) · `schedule` (`cron: string`) · `form_submission` (`formName: string`) — every kind also carries an optional `samplePayload` (raw JSON text) used when running |
| **Action** | `send_email` (`recipient?: string`) · `http_request` (`url`, `method`) · `add_tag` (`tag: string`) · `slack_message` (`channel`, `message`) |
| **Condition** | `field` (dot-path into the payload, e.g. `customer.plan`), `operator` (`equals` / `not_equals` / `contains` / `greater_than` / `less_than`), `value` |

A `WorkflowEdge` connects two nodes; an edge leaving a Condition must name which output it's from (`sourceHandle: "true" | "false"`) — every other node type has exactly one unnamed output. Both branches of a condition are allowed to reach the same downstream node.

## The execution engine

Clicking **Run** does not call anything real — it's a synchronous, in-memory simulation:

1. `runWorkflow` (in `domain/execution.ts`) reads the workflow's first trigger's `samplePayload`, parsing it (falling back to `{}` on invalid or absent JSON — an unconfigured sample payload is a normal state, not an error).
2. It walks the graph from every trigger node. At a Condition node, `evaluateCondition` decides which branch is taken; only that branch is actually followed.
3. Every node reached is recorded as a step with a status (`success` / `failure` / `skipped`) and a human-readable, kind-aware detail written in plain language, not programmer-speak — `Sent a Slack message to "#general".`, `Checked whether "customer.plan" equals "pro" -- it was true, so this took the True path.`.
4. Nodes downstream of the branch that *wasn't* taken are walked separately and recorded as `skipped`, so the whole untaken subtree shows up — not just the first node in it.

The result (`lastRun`) is deliberately excluded from persistence: a stale run showing green checkmarks on nodes that have since been edited or deleted would misrepresent the current workflow, not describe it.

Two places surface it, both reading `lastRun` directly from the store:

- **`RunResultsPanel`** — a dismissible strip that appears below the header the moment Run finishes, listing every step in order with its status and detail. This is the primary "what did that actually do" answer, deliberately hard to miss right after clicking Run.
- **`WorkflowNode`** — a small status badge per node (`role="status"`, `aria-label` built from the step's own detail), for checking one node's result in place on the canvas without opening the panel.

Both read the same `RUN_STATUS_PRESENTATION` map (`components/runStatusPresentation.ts`) for their icon and color per status, so "success" looks identical everywhere rather than two independently-drifting copies of the same mapping.

## Validation

`domain/validation.ts` checks a whole workflow for structural problems: dangling edges, self-loops, duplicate edges, cycles, an edge into a trigger, a condition edge missing its branch, or a branch on an edge that isn't a condition's.

Worth being upfront about: **the app's own UI can never actually produce any of these.** `connectNodes` enforces every one of these rules incrementally, at the moment a connection is drawn, and `deleteNode` cascades edge removal so nothing is ever left dangling. `validateWorkflow` exists as a guard against a `Workflow` that *didn't* come from those actions — a workflow saved by an earlier version of this app, or hand-edited `localStorage`. The status bar and the Run button's disabled state both surface it, but you won't see it fire through ordinary use of the app (see the "Try it" walkthrough above for how to actually trigger it).

## Persistence

The active implementation is `localStorage`, via Zustand's `persist` middleware (`state/persistence.ts`). Only the `workflow` document is persisted — `selectedNodeId` and `lastRun` are both deliberately excluded as ephemeral/stale-prone state.

A Postgres-backed persistence layer is sketched but **not installed or wired to anything**: `prisma/schema.prisma` defines the eventual table shape (`nodes`/`edges` as JSON, mirroring the client's `Workflow` type exactly), and `state/persistence.ts` has a fully commented-out `fetch`-based storage engine matching the same interface the active `localStorage` engine uses, plus an illustrative server-route sketch. `.env.example` documents the Neon connection variables it would need. None of this runs today; Prisma Client is Node-only and can't execute in this Vite client bundle, so activating it means standing up a server first.

## Testing

Three layers, each testing what the layer below it can't:

- **Vitest**, on `domain/` — pure functions, no rendering, no environment needed beyond Node/jsdom depending on the file.
- **Vitest + React Testing Library**, on `components/` — jsdom, but explicitly *not* the canvas itself: jsdom has no `ResizeObserver`, which React Flow depends on to measure nodes, so `CanvasArea`/`WorkflowNode` interaction tests that need a real, measured canvas belong to the next layer instead.
- **Playwright**, on the whole app in real Chromium — drag-and-drop, connection-drawing, and anything depending on real layout/measurement. This is also where both "Try it" examples above are actually verified, not just described.

## Tech stack

Vite · React 19 · TypeScript (strict) · [@xyflow/react](https://reactflow.dev/) · Zustand · Tailwind CSS v4 · Lucide React · Vitest · React Testing Library · Playwright.

## Not built (yet)

Undo/redo, multi-select, `duplicateNode`, and the Postgres backend sketched above but not wired up.
