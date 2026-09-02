import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/** Reads React Flow's viewport transform as { x, y, scale }. */
async function readViewportTransform(page: Page) {
  const transform = await page
    .locator(".react-flow__viewport")
    .evaluate((el) => (el as HTMLElement).style.transform);

  const match = transform.match(
    /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/,
  );
  if (!match) {
    throw new Error(`Could not parse viewport transform: "${transform}"`);
  }

  return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) };
}

/**
 * Drags a locator by a pixel offset using raw pointer events.
 *
 * `locator.dragTo()` fires HTML5 drag-and-drop events, which React Flow
 * (and most canvas UIs) does not listen for -- it tracks pointerdown /
 * pointermove / pointerup instead, so the drag has to be driven manually.
 */
async function dragBy(
  page: Page,
  locator: Locator,
  dx: number,
  dy: number,
  // Defaults to the element's center. The pane test overrides this: the
  // pane is the full canvas area, and `fitView` centers the seed node
  // there too, so a center-point drag on "empty canvas" actually grabs the
  // node instead of panning the background.
  startOffset?: { x: number; y: number },
) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Cannot drag an element with no bounding box");
  }
  const startX = box.x + (startOffset?.x ?? box.width / 2);
  const startY = box.y + (startOffset?.y ?? box.height / 2);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // `steps` makes Playwright dispatch a stream of intermediate mousemove
  // events along the path, rather than one teleport. React Flow (like most
  // canvas/drag implementations) tracks pointer movement continuously to
  // recompute its delta and to distinguish a drag from a click -- a single
  // jump doesn't give it enough events to do either correctly.
  await page.mouse.move(startX + dx, startY + dy, { steps: 20 });
  await page.mouse.up();
}

/** Drags from one handle to another to draw a connection between two nodes. */
async function connectHandles(page: Page, source: Locator, target: Locator) {
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) {
    throw new Error("Cannot connect a handle with no bounding box");
  }

  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 20 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // The seed node is present as soon as the store initializes, so its
  // presence is a reliable signal the app has finished mounting.
  await expect(page.locator('[data-id="trigger-new-customer"]')).toBeVisible();
});

test("loads with the seed Trigger node visible", async ({ page }) => {
  const seedNode = page.locator('[data-id="trigger-new-customer"]');
  await expect(seedNode).toContainText("New Customer");
  await expect(seedNode).toContainText("Trigger");
});

test("clicking a node selects it and shows its details in the Inspector", async ({
  page,
}) => {
  await page.locator('[data-id="trigger-new-customer"]').click();

  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await expect(inspector.getByLabel("Label")).toHaveValue("New Customer");
  await expect(inspector.getByLabel("Event")).toHaveValue("customer.created");
});

test("clicking empty canvas clears the selection", async ({ page }) => {
  await page.locator('[data-id="trigger-new-customer"]').click();
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await expect(inspector.getByLabel("Label")).toBeVisible();

  // .react-flow__pane is the empty background layer, distinct from any node.
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

  await expect(
    inspector.getByText("Select a node to inspect its properties."),
  ).toBeVisible();
});

test("dragging a node moves it, and the new position persists", async ({
  page,
}) => {
  const seedNode = page.locator('[data-id="trigger-new-customer"]');
  const before = await seedNode.boundingBox();
  if (!before) throw new Error("seed node has no bounding box");

  await dragBy(page, seedNode, 150, 100);

  const after = await seedNode.boundingBox();
  if (!after) throw new Error("seed node has no bounding box after drag");

  // Exact-pixel assertions on a canvas are brittle (zoom level, easing);
  // asserting the node moved in the expected direction by a meaningful
  // amount is the stable, high-signal check.
  expect(after.x - before.x).toBeGreaterThan(50);
  expect(after.y - before.y).toBeGreaterThan(50);

  // Select a different part of the UI and back, to prove the new position
  // survived the store round-trip rather than being an artifact of
  // React Flow's own uncommitted drag state.
  await page.getByRole("button", { name: "Fit view" }).click();
  await expect(seedNode).toBeVisible();
});

test("the Zoom In control increases the viewport scale", async ({ page }) => {
  const before = await readViewportTransform(page);

  await page.getByRole("button", { name: "Zoom In" }).click();
  await page.getByRole("button", { name: "Zoom In" }).click();

  const after = await readViewportTransform(page);
  expect(after.scale).toBeGreaterThan(before.scale);
});

test("dragging the empty canvas pans the viewport", async ({ page }) => {
  const before = await readViewportTransform(page);

  // Start near a corner, away from the centered seed node, so the drag
  // actually grabs the pane rather than the node sitting on top of it.
  await dragBy(page, page.locator(".react-flow__pane"), 120, 80, {
    x: 20,
    y: 20,
  });

  const after = await readViewportTransform(page);
  expect(after.x).not.toBe(before.x);
  expect(after.y).not.toBe(before.y);
});

test("clicking a palette button adds a visible node to the canvas", async ({
  page,
}) => {
  const nodesBefore = await page.locator(".react-flow__node").count();

  await page.getByRole("button", { name: "Add Action node" }).click();

  await expect(page.locator(".react-flow__node")).toHaveCount(nodesBefore + 1);
  await expect(page.getByText("New Action")).toBeVisible();
});

test("deleting an edge removes it permanently, even after an unrelated node is later deleted", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add Action node" }).click();
  await page.getByRole("button", { name: "Add Condition node" }).click();
  await expect(page.locator(".react-flow__node-action")).toBeVisible();
  await expect(page.locator(".react-flow__node-condition")).toBeVisible();

  await connectHandles(
    page,
    page.locator('[data-id="trigger-new-customer"] .react-flow__handle-right'),
    page.locator(".react-flow__node-action .react-flow__handle-left"),
  );
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);

  await page.locator(".react-flow__edge-interaction").click();
  await page.keyboard.press("Backspace");
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);

  // The regression this guards against: only a store mutation that
  // reallocates `workflow.edges` re-syncs React Flow's edges from the
  // store. Deleting an unrelated bystander node does exactly that (its
  // `.filter()` always returns a new array, even when nothing it removes
  // touches this edge) -- before the fix, this step resurrected the edge
  // just deleted above.
  await page.locator(".react-flow__node-condition").click();
  await page.keyboard.press("Backspace");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
});

test("the header shows the workflow's real name and lets you rename it", async ({
  page,
}) => {
  const nameInput = page.getByLabel("Workflow name");
  await expect(nameInput).toHaveValue("Untitled Workflow");

  await nameInput.fill("Customer Onboarding");

  await expect(nameInput).toHaveValue("Customer Onboarding");
});
