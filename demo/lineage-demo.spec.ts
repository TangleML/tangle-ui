/**
 * Tangle Lineage Feature — Demo Recording Script
 *
 * Run with:
 *   npx playwright test --config demo/playwright.config.ts --headed
 *
 * Prerequisites:
 *   • oasis-frontend running at http://localhost:5000 via local-docker.sh
 *   • The demo/lineage-feature-showcase branch is checked out (includes
 *     DemoCaptionOverlay and the full lineage feature stack)
 *
 * The test intentionally does NOT assert; it drives at human pace for recording.
 */

import { test } from "@playwright/test";

import {
  caption,
  clearCaption,
  clickTask,
  connectTasks,
  copySelectedTask,
  createPipeline,
  dropFromLibrary,
  dwell,
  humanDelay,
  openPipeline,
  pasteTask,
  shiftClickTask,
} from "./demo-helpers";

const PIPELINE_A = "Chicago Taxi Pipeline";
const PIPELINE_B = "Taxi Copy Pipeline";

// ─────────────────────────────────────────────────────────────────────────────

test("Tangle Lineage Feature Demo", async ({ page }) => {
  // Give the app an extra moment to fully initialise.
  await page.goto("/");
  await humanDelay(page, 1500);

  // ──────────────────────────────────────────────────────────────────────────
  // Scene 1 — Create "Chicago Taxi Pipeline" and build a basic flow
  // ──────────────────────────────────────────────────────────────────────────

  await caption(page, "Welcome to Tangle — a visual ML pipeline editor", 1500);

  await createPipeline(page);
  await humanDelay(page, 800);

  // Rename the pipeline so it has a recognisable name.
  // (The new pipeline may already have a placeholder name — we'll use File>Rename.)
  const menuBar = page
    .locator('[aria-label="Pipeline name"], [data-testid="pipeline-name"]')
    .first();
  if (await menuBar.isVisible().catch(() => false)) {
    await menuBar.click();
    await humanDelay(page, 300);
    await page.keyboard.press("Control+a");
    await page.keyboard.type(PIPELINE_A);
    await page.keyboard.press("Enter");
    await humanDelay(page, 500);
  }

  await caption(
    page,
    `Building "${PIPELINE_A}" — dragging components from the Standard Library`,
    1200,
  );

  // Drop first component: Chicago Taxi Trips dataset
  await dropFromLibrary(
    page,
    "Standard library",
    "Chicago Taxi Trips dataset",
    { x: 480, y: 280 },
  );
  await dwell(page, 800);

  await caption(page, "Adding a second component to the pipeline", 1000);

  // Drop second component: Calculate data hash (visually simple, no external deps)
  await dropFromLibrary(page, "Standard library", "Calculate data hash", {
    x: 800,
    y: 280,
  });
  await dwell(page, 800);

  await caption(page, "Connecting components — wiring the data flow", 1000);

  // Connect them.
  await connectTasks(page, "Chicago Taxi Trips dataset", "Calculate data hash");
  await dwell(page, 1000);

  await caption(
    page,
    "Grouping both tasks into a subgraph for organisation",
    1200,
  );

  // Multi-select both tasks and create a subgraph.
  await clickTask(page, "Chicago Taxi Trips dataset");
  await shiftClickTask(page, "Calculate data hash");
  await humanDelay(page, 500);

  // The FloatingSelectionToolbar should appear — click "Create Subgraph".
  const createSubgraphBtn = page
    .locator(
      'button:has-text("Create Subgraph"), [aria-label="Create Subgraph"]',
    )
    .first();
  if (await createSubgraphBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createSubgraphBtn.click();
    await humanDelay(page, 800);
    // Name the subgraph if a dialog appears.
    const subgraphInput = page.locator('[role="dialog"] input').first();
    if (await subgraphInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await subgraphInput.fill("Data Processing");
      await page.keyboard.press("Enter");
      await humanDelay(page, 600);
    }
  }

  await dwell(page, 1200);

  // ──────────────────────────────────────────────────────────────────────────
  // Scene 2 — Copy the dataset component with lineage tracking
  // ──────────────────────────────────────────────────────────────────────────

  // Drill back to root level if we navigated into the subgraph.
  const breadcrumbs = page
    .locator('[data-testid="subgraph-breadcrumbs"] button')
    .first();
  if (await breadcrumbs.isVisible({ timeout: 2000 }).catch(() => false)) {
    await breadcrumbs.click();
    await humanDelay(page, 600);
  }

  await caption(page, "Selecting the dataset component to copy it", 900);
  await clickTask(page, "Chicago Taxi Trips dataset");
  await humanDelay(page, 600);

  await caption(
    page,
    "Pressing Cmd+C — Tangle offers to track changes between the original and any copies",
    1000,
  );
  await copySelectedTask(page);
  await humanDelay(page, 500);

  // The CopyLineageModal should appear.
  const copyModal = page.locator('[role="dialog"]:has-text("Track changes")');
  if (await copyModal.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dwell(page, 800); // Let viewer read the modal.
    await caption(
      page,
      "Enabling 'Track changes' links this component across pipelines",
      1000,
    );
    // Check the tracking checkbox.
    const checkbox = copyModal
      .locator('[role="checkbox"], input[type="checkbox"]')
      .first();
    await checkbox.click();
    await humanDelay(page, 600);
    // Click Copy.
    await copyModal.locator('button:has-text("Copy")').click();
    await humanDelay(page, 500);
  }

  await caption(
    page,
    "Origin recorded. Any future edits will offer to reconcile linked copies",
    1500,
  );
  await dwell(page, 1000);

  // ──────────────────────────────────────────────────────────────────────────
  // Scene 3 — Paste TWICE into "Taxi Copy Pipeline"
  // ──────────────────────────────────────────────────────────────────────────

  await caption(page, `Creating a second pipeline: "${PIPELINE_B}"`, 1000);
  await createPipeline(page);
  await humanDelay(page, 800);

  await caption(
    page,
    "Pasting the component — it inherits the lineage origin",
    900,
  );
  // First paste.
  await pasteTask(page);
  await dwell(page, 800);

  await caption(
    page,
    "And pasting again — two instances now share the same origin",
    900,
  );
  // Second paste (offset so both are visible).
  await pasteTask(page);
  await dwell(page, 1200);

  await caption(
    page,
    `Both copies are now linked to the original in "${PIPELINE_A}"`,
    1500,
  );
  await dwell(page, 1200);

  // ──────────────────────────────────────────────────────────────────────────
  // Scene 4 — Edit the original component and update the task
  // ──────────────────────────────────────────────────────────────────────────

  await caption(
    page,
    `Navigating back to "${PIPELINE_A}" to edit the component`,
    1000,
  );
  await openPipeline(page, PIPELINE_A);
  await humanDelay(page, 800);

  await caption(
    page,
    "Opening the component definition editor for the dataset task",
    1000,
  );
  await clickTask(page, "Chicago Taxi Trips dataset");
  await humanDelay(page, 500);

  // Click the ellipsis menu on the component ref bar → "Edit Component".
  const editCompBtn = page
    .locator(
      'button[aria-label="Edit Component"], [data-testid="edit-component-button"], button:has-text("Edit Component")',
    )
    .first();
  if (await editCompBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await editCompBtn.click();
    await humanDelay(page, 700);
  } else {
    // Try the ⋮ menu on the component bar.
    const moreBtn = page
      .locator('[data-testid="component-ref-more-actions"]')
      .first();
    await moreBtn.click();
    await humanDelay(page, 400);
    await page.locator("text=Edit Component").first().click();
    await humanDelay(page, 700);
  }

  await caption(page, "Adding a description to the component definition", 900);

  // The full-screen editor should now be open. Add a description line near
  // the top of the YAML (after 'name:').
  const editor = page
    .locator(".monaco-editor, [role='textbox'][aria-label*='yaml'], .cm-editor")
    .first();
  if (await editor.isVisible({ timeout: 4000 }).catch(() => false)) {
    // Find the 'name:' line and position after it to add a description.
    await editor.click();
    await humanDelay(page, 400);
    // Use Ctrl/Cmd+G to go to line 2 (after name:) — works in Monaco.
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type(
      "description: Updated dataset — full historical range",
    );
    await humanDelay(page, 600);
  }

  await caption(page, "Saving the edit and choosing 'Update this task'", 900);

  // Click the Save button inside the fullscreen editor.
  await page.locator('button:has-text("Save")').first().click();
  await humanDelay(page, 800);

  // The "Apply your edit" view appears — click "Update this task".
  const updateBtn = page
    .locator(
      'button:has-text("Update this task"), [data-testid="update-task-button"]',
    )
    .first();
  if (await updateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dwell(page, 600);
    await updateBtn.click();
    await humanDelay(page, 800);
  }

  await caption(
    page,
    "Task updated — Tangle is now scanning for linked instances across pipelines",
    1500,
  );
  await dwell(page, 1000);

  // ──────────────────────────────────────────────────────────────────────────
  // Scene 5 — Cross-pipeline reconcile
  // ──────────────────────────────────────────────────────────────────────────

  // The Reconcile overview dialog should appear automatically.
  const reconcileOverview = page.locator(
    '[role="dialog"]:has-text("Reconcile")',
  );
  await reconcileOverview.waitFor({ timeout: 8000 }).catch(() => {});

  if (await reconcileOverview.isVisible().catch(() => false)) {
    await caption(
      page,
      "The reconcile overview — every pipeline sharing this component's origin",
      1500,
    );
    await dwell(page, 1200);

    await caption(
      page,
      `Clicking Reconcile on "${PIPELINE_B}" — two tasks need updating`,
      1000,
    );

    // Click Reconcile next to the copy pipeline row.
    const reconcileBtn = reconcileOverview
      .locator(
        `[key="${PIPELINE_B}"] button:has-text("Reconcile"), button:has-text("Reconcile")`,
      )
      .first();
    await reconcileBtn.click();
    await humanDelay(page, 1000);
  }

  // We're now in reconcile mode on the copy pipeline.
  // Wait for the "Mark Done" button to appear.
  const markDoneBtn = page
    .locator(
      'button:has-text("Mark Done"), button:has-text("Finish Reconciling")',
    )
    .first();
  await markDoneBtn.waitFor({ timeout: 10_000 }).catch(() => {});

  await caption(
    page,
    "Reconcile mode: the changes are staged in memory — reviewing task 1 of 2",
    1200,
  );
  await dwell(page, 1000);

  // Mark Done on task 1 → auto-navigates to task 2.
  if (await markDoneBtn.isVisible().catch(() => false)) {
    await markDoneBtn.click();
    await humanDelay(page, 1000);
  }

  await caption(page, "Advancing to task 2 of 2", 900);
  await dwell(page, 800);

  // Mark Done on task 2 → all done → auto-finish.
  const markDoneBtn2 = page
    .locator(
      'button:has-text("Mark Done"), button:has-text("Finish Reconciling")',
    )
    .first();
  if (await markDoneBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await markDoneBtn2.click();
    await humanDelay(page, 1200);
  }

  // Back on the reconcile overview — both tasks reconciled.
  await caption(
    page,
    "All instances reconciled — both pipelines are now in sync ✓",
    2000,
  );
  await dwell(page, 1500);

  // Click Finish.
  const finishBtn = page.locator('button:has-text("Finish")').first();
  if (await finishBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await finishBtn.click();
    await humanDelay(page, 800);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // End card
  // ──────────────────────────────────────────────────────────────────────────

  await clearCaption(page);
  await humanDelay(page, 500);
  await caption(
    page,
    "Tangle: track, edit, and reconcile components across every pipeline — automatically",
    3500,
  );
  await dwell(page, 3000);
  await clearCaption(page);
  await humanDelay(page, 1000);
});
