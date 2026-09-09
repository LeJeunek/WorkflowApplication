import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

/**
 * A minimal in-memory stand-in for the real Express+Prisma API (see
 * server/routes/workflows.ts), reimplementing the same five endpoints this
 * test's requests hit. Real Neon credentials aren't available in this test
 * environment (see prisma/schema.prisma's activation notes), and this repo
 * has no CI pipeline that could supply them -- mocking here keeps this spec
 * exercising the real client wiring (remoteWorkflows.ts, workflowStore.ts,
 * WorkflowHeader/WorkflowSwitcher) without requiring a live database.
 */
interface StoredWorkflow {
  id: string;
  name: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
  createdAt: string;
  updatedAt: string;
}

async function mockWorkflowsApi(page: Page) {
  const rows = new Map<string, StoredWorkflow>();
  let nextTimestamp = 0;
  function timestamp(): string {
    nextTimestamp += 1;
    return new Date(2026, 0, 1, 0, 0, nextTimestamp).toISOString();
  }

  await page.route("**/api/workflows", async (route: Route) => {
    if (route.request().method() === "GET") {
      const list = [...rows.values()]
        .map(({ id, name, description, updatedAt }) => ({ id, name, description, updatedAt }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      await route.fulfill({ json: list });
      return;
    }

    // POST
    const body = route.request().postDataJSON() as StoredWorkflow;
    const row: StoredWorkflow = { ...body, createdAt: timestamp(), updatedAt: timestamp() };
    rows.set(row.id, row);
    await route.fulfill({ status: 201, json: row });
  });

  await page.route("**/api/workflows/*", async (route: Route) => {
    const id = decodeURIComponent(route.request().url().split("/").pop() ?? "");
    const method = route.request().method();

    if (method === "GET") {
      const row = rows.get(id);
      if (!row) {
        await route.fulfill({ status: 404 });
        return;
      }
      await route.fulfill({ json: row });
      return;
    }

    if (method === "PUT") {
      const existing = rows.get(id);
      if (!existing) {
        await route.fulfill({ status: 404 });
        return;
      }
      const body = route.request().postDataJSON() as Partial<StoredWorkflow>;
      const updated: StoredWorkflow = { ...existing, ...body, updatedAt: timestamp() };
      rows.set(id, updated);
      await route.fulfill({ json: updated });
      return;
    }

    if (method === "DELETE") {
      const existed = rows.delete(id);
      await route.fulfill({ status: existed ? 204 : 404 });
    }
  });
}

test.beforeEach(async ({ page }) => {
  await mockWorkflowsApi(page);
  await page.goto("/");
  await expect(page.locator('[data-id="trigger-new-customer"]')).toBeVisible();
});

test("saving a new workflow clears the dirty state and lists it in the switcher", async ({
  page,
}) => {
  await page.getByLabel("Workflow name").fill("Signup Flow");
  await expect(page.getByRole("banner").getByText("Unsaved changes")).toBeVisible();

  await page.getByRole("button", { name: "Save workflow" }).click();
  await expect(page.getByRole("banner").getByText("Saved")).toBeVisible();

  await page.getByRole("button", { name: "Switch workflow" }).click();
  await expect(
    page.getByRole("menuitem", { name: /Signup Flow/ }),
  ).toBeVisible();
});

test("a saved workflow survives a reload", async ({ page }) => {
  await page.getByLabel("Workflow name").fill("Reload Survives");
  await page.getByRole("button", { name: "Add Action node" }).click();
  await page.getByRole("button", { name: "Save workflow" }).click();
  await expect(page.getByRole("banner").getByText("Saved")).toBeVisible();

  await page.reload();

  await expect(page.locator('[data-id="trigger-new-customer"]')).toBeVisible();
  await expect(page.getByLabel("Workflow name")).toHaveValue("Reload Survives");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});

test("New workflow, then reopening the original from the switcher, restores its data", async ({
  page,
}) => {
  await page.getByLabel("Workflow name").fill("Original");
  await page.getByRole("button", { name: "Save workflow" }).click();
  await expect(page.getByRole("banner").getByText("Saved")).toBeVisible();

  await page.getByRole("button", { name: "Switch workflow" }).click();
  await page.getByRole("menuitem", { name: "New workflow" }).click();
  await expect(page.getByLabel("Workflow name")).toHaveValue("Untitled Workflow");

  await page.getByRole("button", { name: "Switch workflow" }).click();
  await page.getByRole("menuitem", { name: /Original/ }).click();

  await expect(page.getByLabel("Workflow name")).toHaveValue("Original");
});

test("deleting a workflow from the switcher removes it from the list", async ({
  page,
}) => {
  await page.getByLabel("Workflow name").fill("To Delete");
  await page.getByRole("button", { name: "Save workflow" }).click();
  await expect(page.getByRole("banner").getByText("Saved")).toBeVisible();

  await page.getByRole("button", { name: "Switch workflow" }).click();
  await expect(page.getByRole("menuitem", { name: /To Delete/ })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: 'Delete "To Delete"' }).click();

  await expect(page.getByRole("menuitem", { name: /To Delete/ })).toBeHidden();
});
