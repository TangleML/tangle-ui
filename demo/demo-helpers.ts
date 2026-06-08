import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** Natural human pause between actions. */
export async function humanDelay(page: Page, ms = 900): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Longer pause — hold on a result so the viewer can take it in. */
export async function dwell(page: Page, ms = 1800): Promise<void> {
  await page.waitForTimeout(ms);
}

// ---------------------------------------------------------------------------
// Caption overlay
// ---------------------------------------------------------------------------

/**
 * Show a caption on the DemoCaptionOverlay and wait for it to fully type out
 * before continuing (so the next action happens only after the viewer has read).
 *
 * @param text       Caption text
 * @param holdMs     How long to hold the caption after typing before the NEXT
 *                   action begins (default 1 200 ms — captions auto-clear at
 *                   durationMs but we move on sooner).
 * @param durationMs How long the overlay shows before auto-clearing itself.
 */
export async function caption(
  page: Page,
  text: string,
  holdMs = 1200,
  durationMs = 5000,
): Promise<void> {
  await page.evaluate(
    ({ t, d }) => {
      window.dispatchEvent(
        new CustomEvent("__demo_caption__", {
          detail: { text: t, durationMs: d },
        }),
      );
    },
    { t: text, d: durationMs },
  );
  // Wait for the typewriter to finish + hold time.
  const typeMs = text.length * 26;
  await page.waitForTimeout(typeMs + holdMs);
}

/** Clear the caption immediately. */
export async function clearCaption(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("__demo_caption__", { detail: { text: "" } }),
    );
  });
}

// ---------------------------------------------------------------------------
// Typing with visible per-keystroke delay
// ---------------------------------------------------------------------------

export async function slowType(
  _page: Page,
  locator: Locator,
  text: string,
  delayMs = 55,
): Promise<void> {
  await locator.click();
  await locator.fill("");
  for (const char of text) {
    await locator.pressSequentially(char, { delay: delayMs });
  }
}

// ---------------------------------------------------------------------------
// Navigation + pipeline creation
// ---------------------------------------------------------------------------

export async function waitForCanvas(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
    timeout: 30_000,
  });
}

/** Navigate home and create a new blank pipeline; waits for canvas. */
export async function createPipeline(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("new-pipeline-button").click();
  await waitForCanvas(page);
}

/** Name the current pipeline via the header or File > Rename menu. */
export async function renamePipeline(
  page: Page,
  newName: string,
): Promise<void> {
  // Try clicking the pipeline name in the menu bar, which opens an inline editor.
  const nameButton = page.locator('[data-testid="pipeline-name-button"]');
  if (await nameButton.isVisible().catch(() => false)) {
    await nameButton.click();
    const input = page.locator('[data-testid="pipeline-name-input"]');
    await input.fill(newName);
    await input.press("Enter");
    return;
  }
  // Fallback: File > Rename
  await page.click("text=File");
  await page.click("text=Rename");
  const dialog = page.locator('[role="dialog"]');
  await dialog.locator("input").fill(newName);
  await dialog.locator('button:has-text("Rename")').click();
}

// ---------------------------------------------------------------------------
// Component library drag-and-drop
// ---------------------------------------------------------------------------

/**
 * Opens a library folder and drags the named component to the canvas.
 * Reuses the same pattern as tests/e2e/helpers.ts.
 *
 * @param targetPosition  Canvas-relative position for the drop (pixels).
 */
export async function dropFromLibrary(
  page: Page,
  folderName: string,
  componentName: string,
  targetPosition = { x: 600, y: 300 },
): Promise<void> {
  // Make sure the left panel (component library) is open.
  const leftDock = page.locator('[data-testid="dock-area-left"]');
  if (!(await leftDock.isVisible().catch(() => false))) {
    // Try the "Components" menu entry to open the library window.
    await page.click("text=Components").catch(() => {});
    await humanDelay(page, 400);
  }

  // Wait for the folder to appear (library loading can take a moment).
  await page.waitForSelector(`[data-folder-name="${folderName}"]`, {
    timeout: 25_000,
  });
  const folder = page.locator(`[data-folder-name="${folderName}"]`);

  // Open the folder if collapsed.
  const toggle = folder.locator(
    `[aria-label="Folder: ${folderName}"][role="button"]`,
  );
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
    await humanDelay(page, 300);
  }

  const component = folder.locator(`li:has-text("${componentName}")`);
  const canvas = page.locator('[data-testid="rf__wrapper"]');
  await component.dragTo(canvas, { targetPosition });
  await humanDelay(page, 600);
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

/** Click a task node by its visible name. */
export async function clickTask(page: Page, taskName: string): Promise<void> {
  // ReactFlow nodes have aria labels or text matching the task name.
  const node = page
    .locator(".react-flow__node")
    .filter({ hasText: taskName })
    .first();
  await node.click();
  await humanDelay(page, 400);
}

/** Shift-click a task to add it to the current selection. */
export async function shiftClickTask(
  page: Page,
  taskName: string,
): Promise<void> {
  const node = page
    .locator(".react-flow__node")
    .filter({ hasText: taskName })
    .first();
  await node.click({ modifiers: ["Shift"] });
  await humanDelay(page, 300);
}

/** Attempt to draw an edge from one task's output to another task's input.
 *  Finds the source handle and drags to the target handle.  */
export async function connectTasks(
  page: Page,
  sourceTaskName: string,
  targetTaskName: string,
): Promise<void> {
  const sourceNode = page
    .locator(".react-flow__node")
    .filter({ hasText: sourceTaskName })
    .first();
  const targetNode = page
    .locator(".react-flow__node")
    .filter({ hasText: targetTaskName })
    .first();

  const sourceHandle = sourceNode.locator(".react-flow__handle-right").first();
  const targetHandle = targetNode.locator(".react-flow__handle-left").first();

  await sourceHandle.dragTo(targetHandle);
  await humanDelay(page, 500);
}

// ---------------------------------------------------------------------------
// Context panel tabs
// ---------------------------------------------------------------------------

export async function openConfigTab(page: Page): Promise<void> {
  await page.click(
    'button[data-testid="tab-configuration"], button:has-text("Config")',
  );
  await humanDelay(page, 300);
}

// ---------------------------------------------------------------------------
// Copy / paste
// ---------------------------------------------------------------------------

const isMac = process.platform === "darwin";
const MOD = isMac ? "Meta" : "Control";

export async function copySelectedTask(page: Page): Promise<void> {
  await page.keyboard.press(`${MOD}+c`);
}

export async function pasteTask(page: Page): Promise<void> {
  await page.keyboard.press(`${MOD}+v`);
  await humanDelay(page, 600);
}

// ---------------------------------------------------------------------------
// Demo-specific: navigate to a named pipeline
// ---------------------------------------------------------------------------

export async function openPipeline(page: Page, name: string): Promise<void> {
  await page.goto("/");
  // Find the pipeline in the home list and click it.
  const link = page.locator(`text="${name}"`).first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click();
  await waitForCanvas(page);
}
