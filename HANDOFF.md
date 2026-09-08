# Canvas — session handoff (2026-09-08)

## Repo
- Path: `WorkflowApplication` repo, app lives in `canvas/` subfolder
- Remote: `https://github.com/LeJeunek/WorkflowApplication.git`, branch `main`
- Status: clean working tree, fully pushed as of commit `23e8db0` — nothing in flight, no stashes, no uncommitted work waiting for you

## What shipped this session (4 commits, all on `main`)
1. `b2107ca` — Undo/redo: snapshot-based history in `workflowStore.ts`, coalescing rapid same-field edits (800ms window) into one undo step, header Undo/Redo buttons, Ctrl+Z/Ctrl+Y (suppressed while a text field has focus).
2. `c69409b` — Replaced the raw-JSON "Example data" textarea on Trigger nodes with a Simple field-by-field editor (`domain/samplePayload.ts` + `SamplePayloadEditor.tsx`): dot-path rows instead of hand-typed JSON, with an Advanced (JSON) tab as an escape hatch.
3. `af3f5a6` — Added an explicit per-row type selector (Text/Number/True-False/Empty/JSON) instead of guessing the type from typed text.
4. `23e8db0` — Fixed `equals`/`not_equals` in `domain/evaluate.ts` to coerce non-string payload values (was strict `===`, so a real boolean/number field could never match an equals check against the Condition's string Value field).

Full verification passed at every step: `npx tsc -b --force`, `npx vitest run` (233 tests), `npx eslint .`, `npm run build`, `npx playwright test` (24 e2e tests, real Chromium). README.md was kept current alongside each change — it's the authoritative architecture/feature doc, read it first.

## Getting set up on the laptop
```bash
git pull                 # or clone, if this is a fresh checkout
cd canvas
npm install
npm run dev               # http://localhost:5173
```
Full verification sweep (matches what CI-equivalent checks were run this session):
```bash
npx tsc -b --force && npx vitest run && npx eslint . && npm run build && npx playwright test
```

## `.env` — not in git, needs manual handling
You had `canvas/.env` open in the IDE on the desktop machine — it's gitignored (`.env` / `.env.*`, with `.env.example` explicitly un-ignored as the checked-in template) and never touched by any commit, so it won't show up on the laptop via `git pull`. If you need the same values there, copy the file over yourself or re-derive them from your Neon dashboard — don't commit real credentials into `.env.example`.

**Important: nothing in the app currently reads these vars.** `prisma/schema.prisma` is sketched (matches the client `Workflow` type) but **Prisma isn't an installed dependency yet** (not in `package.json`) and `state/persistence.ts`'s server-backed storage engine is fully commented out. The active persistence is 100% client-side `localStorage` via Zustand's `persist` middleware — none of this session's work touched or needed the database.

## Open thread: wiring up the Postgres/Prisma backend
You mentioned you've mostly got the DB set up with Prisma already — that's the natural next chunk of work if you pick this up on the laptop. Current state to build from:
- `prisma/schema.prisma` — table shape sketched, matches `Workflow`/nodes/edges as JSON
- `.env.example` — documents the Neon pooled/unpooled connection vars
- `state/persistence.ts` — has a commented-out `fetch`-based storage engine already shaped to match the same interface the active `localStorage` engine uses, plus an illustrative server-route sketch
- Since Prisma Client is Node-only, activating this means standing up an actual server in front of the Vite client bundle first — that's the real first decision (which server: a small Node/Express API, a framework's API routes, etc.) before any Prisma code gets wired in for real

## Backlog (README's "Not built (yet)")
Multi-select, `duplicateNode`, and the Postgres backend above.

## Working conventions worth knowing
- Every feature goes store-first (pure `domain/` functions, fully unit-tested) before any UI, then the fixed verification sweep above, then Playwright e2e for anything touching `CanvasArea`/React Flow — jsdom has no `ResizeObserver`, so those interactions are e2e-only, never jsdom component tests.
- Only commit/push when explicitly asked; this session's four commits were each requested.

---
Delete or update this file once the laptop session has picked it up — it's a point-in-time handoff, not living documentation.
