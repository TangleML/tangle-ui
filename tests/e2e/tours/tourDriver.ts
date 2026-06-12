import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import type {
  TourDefinition,
  TourStep,
} from "@/components/Learn/tours/registry";
import type { TourInteraction } from "@/providers/TourProvider/tourActions";

import { fitToView, locateFlowCanvas } from "../helpers";

const TOURS_DIR = join(process.cwd(), "src/components/Learn/tours");

// Runtime mirror of the app's TourInteraction union. Typed as
// Record<TourInteraction, true> so renaming or removing an interaction in the
// app is a compile error here rather than a tour JSON that loads fine and then
// dies mid-run on an unhandled interaction.
const TOUR_INTERACTIONS: Record<TourInteraction, true> = {
  "undock-window": true,
  "redock-window": true,
  "select-task": true,
  "add-task": true,
  "add-input": true,
  "add-output": true,
  "connect-edge": true,
  "expand-folder": true,
  "library-search": true,
  "set-argument": true,
  "navigate-into-subgraph": true,
  "navigate-to-root": true,
  "unpack-subgraph": true,
  "multi-select-tasks": true,
  "create-subgraph": true,
  "open-secret-dialog": true,
  "open-settings-panel": true,
  "open-submit-dialog": true,
  "assign-secret-argument": true,
  "assign-secret-submit": true,
};

function isTourInteraction(value: unknown): value is TourInteraction {
  return typeof value === "string" && value in TOUR_INTERACTIONS;
}

/**
 * Validates the JSON the driver actually relies on — a string `id`, a non-empty
 * `steps` array, and per-step a string `selector` plus a known `interaction` —
 * so a malformed tour file fails here, naming the file and the offending step,
 * instead of surfacing as a cryptic crash or a 20s step-timeout deep in the run.
 */
function assertTourDef(
  value: unknown,
  fileName: string,
): asserts value is TourDef {
  const fail = (reason: string): never => {
    throw new Error(`Invalid tour definition in ${fileName}: ${reason}`);
  };

  if (typeof value !== "object" || value === null)
    fail("expected a JSON object");
  const tour = value as Record<string, unknown>;

  if (typeof tour.id !== "string" || tour.id.length === 0) {
    fail('missing a string "id"');
  }
  if (!Array.isArray(tour.steps)) fail('"steps" must be an array');
  const steps = tour.steps as unknown[];
  if (steps.length === 0) fail('"steps" must not be empty');

  steps.forEach((step, index) => {
    if (typeof step !== "object" || step === null) {
      fail(`step ${index} must be an object`);
    }
    const { selector, interaction, targetEdge } = step as Record<
      string,
      unknown
    >;
    if (typeof selector !== "string" || selector.length === 0) {
      fail(`step ${index} is missing a string "selector"`);
    }
    if (interaction !== undefined && !isTourInteraction(interaction)) {
      fail(`step ${index} has unknown interaction "${String(interaction)}"`);
    }
    if (interaction === "connect-edge") {
      const edge =
        typeof targetEdge === "object" && targetEdge !== null
          ? (targetEdge as Record<string, unknown>)
          : undefined;
      if (
        !edge ||
        typeof edge.sourceTaskName !== "string" ||
        typeof edge.sourcePortName !== "string"
      ) {
        fail(
          `step ${index} (connect-edge) needs a "targetEdge" with string sourceTaskName/sourcePortName`,
        );
      }
    }
  });
}

/**
 * Loads a tour definition straight from its JSON source so these tests track
 * the real tour the app ships, not a copy that can drift.
 */
export function loadTour(fileName: string): TourDef {
  const parsed: unknown = JSON.parse(
    readFileSync(join(TOURS_DIR, fileName), "utf8"),
  );
  assertTourDef(parsed, fileName);
  return parsed;
}

/**
 * Drives a guided tour end to end the same way a user would: it walks every
 * step in the tour's JSON definition, asserts each step's spotlight anchor
 * resolves in the DOM, performs the real interaction that gates the step, and
 * waits for the tour to advance. If a UI change removes or renames an anchor a
 * tour depends on, the matching step assertion fails and points at the tour and
 * step that needs updating.
 */

// Edge shape comes straight from the app's TourStep, so a field rename there is
// a compile error here.
type TargetEdge = NonNullable<TourStep["targetEdge"]>;

// JSON-shaped view of a tour step. The interaction and target* fields are picked
// from the app's TourStep so renaming one in the app breaks compilation here
// rather than surfacing as a silent runtime test failure. selector/content/etc.
// are re-typed as the plain values the JSON carries (the app widens `content` to
// a ReactNode at load time, so it can't be reused directly).
type TourStepDef = Pick<
  TourStep,
  | "interaction"
  | "targetTaskName"
  | "targetComponentName"
  | "targetFolderName"
  | "targetSearchTerm"
  | "targetArgumentName"
  | "targetWindowId"
  | "targetWindowName"
  | "targetMinCount"
  | "targetEdge"
> & {
  selector: string;
  content?: string;
  position?: unknown;
  stepInteraction?: boolean;
  highlightedSelectors?: string[];
  // Test-only: the value the driver types for a `set-argument` step. Not part
  // of the app's TourStep — tours that need a specific value set it in their
  // JSON; otherwise the driver falls back to a default.
  targetArgumentValue?: string;
};

export type TourDef = Pick<TourDefinition, "id" | "displayName"> & {
  steps: TourStepDef[];
};

// Sentinel selector tours use to mean "no spotlight, center the popover". No
// such element exists in the DOM, so anchor assertions skip it.
const NO_SPOTLIGHT = '[data-tour-anchor="no-spotlight"]';
const POPOVER = ".reactour__popover";

function urlStep(page: Page): number {
  const match = /[?&]step=(\d+)/.exec(page.url());
  return match ? Number.parseInt(match[1], 10) : 0;
}

async function waitForStep(
  page: Page,
  tourId: string,
  step: number,
): Promise<void> {
  await expect
    .poll(() => urlStep(page), {
      message: `[${tourId}] expected tour to be on step ${step}`,
      timeout: 20_000,
    })
    .toBe(step);
}

async function clickNext(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Go to next step" }).click();
}

/**
 * Opens a tour and waits for the editor and the reactour popover to appear.
 * Each Playwright test runs in a fresh context, so the tour always starts from
 * step 0 with freshly seeded tour-pipeline state.
 */
async function startTour(page: Page, tourId: string): Promise<void> {
  await page.goto(`/tour/${tourId}`);

  await expect(
    locateFlowCanvas(page),
    `[${tourId}] editor canvas should load for the tour`,
  ).toBeVisible({ timeout: 30_000 });

  await expect(
    page.locator(POPOVER),
    `[${tourId}] tour popover should open`,
  ).toBeVisible({ timeout: 30_000 });
}

async function assertStepAnchor(
  page: Page,
  tourId: string,
  index: number,
  step: TourStepDef,
): Promise<void> {
  if (step.selector === NO_SPOTLIGHT) {
    return;
  }

  const anchor = page.locator(step.selector).first();
  await expect(
    anchor,
    `[${tourId}] step ${index}: anchor "${step.selector}" should resolve to a visible element`,
  ).toBeVisible();
}

/**
 * Walks an entire tour: assert anchor, perform the gating interaction (or click
 * Next), and confirm advancement, finishing on the completion step.
 */
export async function runTour(page: Page, tour: TourDef): Promise<void> {
  await startTour(page, tour.id);

  const popover = page.locator(POPOVER);
  const lastIndex = tour.steps.length - 1;

  for (let index = 0; index < tour.steps.length; index++) {
    const step = tour.steps[index];

    await waitForStep(page, tour.id, index);
    await expect(
      popover,
      `[${tour.id}] step ${index}: popover should be visible`,
    ).toBeVisible();

    await assertStepAnchor(page, tour.id, index, step);

    if (index === lastIndex) {
      break;
    }

    if (step.interaction) {
      await performInteraction(page, tour.id, index, step);
    } else {
      await clickNext(page);
    }

    await waitForStep(page, tour.id, index + 1);
  }

  await expect(
    page.getByRole("button", { name: "Finish Tour" }),
    `[${tour.id}] completion actions should appear on the final step`,
  ).toBeVisible();
}

/* -------------------------------------------------------------------------- */
/* Interaction handlers                                                       */
/* -------------------------------------------------------------------------- */

function searchInput(page: Page): Locator {
  return page.getByTestId("search-input");
}

function libraryItem(page: Page, name: string): Locator {
  return page.locator(`[data-component-name="${name}" i]`).first();
}

/**
 * Adds a component to the canvas by dragging it from the library, surfacing it
 * via search if it isn't already visible. Nodes are spread across the canvas so
 * later edge-connection steps have non-overlapping handles to target.
 */
async function addComponentByDrag(
  page: Page,
  name: string,
  { search }: { search: boolean } = { search: true },
): Promise<void> {
  if (search) {
    // Surface task components through search so the draggable item appears at a
    // predictable spot (top of the results list) clear of the step popover.
    await searchInput(page).fill(name);
  } else {
    // Input/Output nodes are not indexed by search; they only exist in the
    // (already-expanded) "Inputs & Outputs" folder, so clear any active filter
    // and drag the folder item directly.
    await searchInput(page).fill("");
  }

  const item = libraryItem(page, name);
  await expect(
    item,
    `library should surface a draggable "${name}" component`,
  ).toBeVisible();

  // Drop at a canvas cell that is clear of both the (per-step) tour popover and
  // any existing nodes, so the drop lands on empty canvas and later
  // edge-connection steps have separated handles to target.
  await dropLibraryItemOnCanvas(page, item);
}

/**
 * Drops a library item onto the canvas by driving the HTML5 transfer directly.
 *
 * A real mouse drag (locator.dragTo) is unreliable headless: Chromium
 * intermittently fails to turn the mouse gesture into a native dragstart/drop
 * pair, so the canvas's onDrop never fires, no task is added, and the gated
 * tour step never advances (the step only completes once the task lands in the
 * spec). Instead, dispatch dragstart on the real library item — letting the
 * app's own onDragStart populate the DataTransfer with the component payload —
 * then dispatch the drop on the canvas with that same transfer at a clear drop
 * point. This exercises the identical app code path (onDragStart -> onDrop ->
 * addTask) deterministically, the way the rest of the suite drives canvas drops.
 */
async function dropLibraryItemOnCanvas(
  page: Page,
  item: Locator,
): Promise<void> {
  const canvas = locateFlowCanvas(page);
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error("Unable to locate canvas bounding box for drop");
  }

  // pickDropPoint returns a canvas-relative point; the dispatched drag events
  // need absolute viewport coordinates for screenToFlowPosition to place the
  // node where we intend.
  const point = await pickDropPoint(page);
  const clientX = canvasBox.x + point.x;
  const clientY = canvasBox.y + point.y;

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  try {
    await item.dispatchEvent("dragstart", { dataTransfer });
    await canvas.dispatchEvent("dragenter", { dataTransfer, clientX, clientY });
    await canvas.dispatchEvent("dragover", { dataTransfer, clientX, clientY });
    await canvas.dispatchEvent("drop", { dataTransfer, clientX, clientY });
    await item.dispatchEvent("dragend", { dataTransfer });
  } finally {
    await dataTransfer.dispose();
  }
}

type Box = { x: number; y: number; width: number; height: number };

function boxesIntersect(a: Box, b: Box): boolean {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

/**
 * Returns a canvas-relative drop position that avoids the tour popover and any
 * existing nodes, scanning a grid of candidate cells and scoring each by its
 * distance from the popover and the nearest node.
 */
async function pickDropPoint(page: Page): Promise<{ x: number; y: number }> {
  const canvas = await locateFlowCanvas(page).boundingBox();
  if (!canvas) throw new Error("Unable to locate canvas bounding box for drop");

  const popover = await page.locator(POPOVER).boundingBox();
  const nodes = page.locator(".react-flow__node");
  const nodeCount = await nodes.count();
  const nodeBoxes: Box[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const box = await nodes.nth(i).boundingBox();
    if (box) nodeBoxes.push(box);
  }

  const cols = [0.12, 0.32, 0.52, 0.72, 0.9];
  const rows = [0.14, 0.34, 0.54, 0.76];
  const footprint = { w: 120, h: 90 };

  let best: { x: number; y: number; clear: boolean; margin: number } | null =
    null;
  for (const ry of rows) {
    for (const cx of cols) {
      const absX = canvas.x + canvas.width * cx;
      const absY = canvas.y + canvas.height * ry;
      const rect: Box = {
        x: absX - footprint.w / 2,
        y: absY - footprint.h / 2,
        width: footprint.w,
        height: footprint.h,
      };

      const hitsPopover = popover ? boxesIntersect(rect, popover) : false;
      const hitsNode = nodeBoxes.some((n) => boxesIntersect(rect, n));
      const clear = !hitsPopover && !hitsNode;

      // Margin: distance to the popover edge (bigger is safer).
      const margin = popover
        ? Math.hypot(
            absX - (popover.x + popover.width / 2),
            absY - (popover.y + popover.height / 2),
          )
        : Number.MAX_SAFE_INTEGER;

      if (
        !best ||
        (clear && !best.clear) ||
        (clear === best.clear && margin > best.margin)
      ) {
        best = { x: absX, y: absY, clear, margin };
      }
    }
  }

  if (!best) {
    return { x: canvas.width * 0.5, y: canvas.height * 0.5 };
  }
  return { x: best.x - canvas.x, y: best.y - canvas.y };
}

/**
 * Clicks a task node by its display name, targeting the card body (not the
 * container, whose center can fall on a connection handle or empty padding).
 */
async function selectTaskByName(page: Page, name: string): Promise<void> {
  const card = page
    .locator(`[data-tour-card="task"][data-tour-card-name="${name}" i]`)
    .first();
  await expect(card, `task card "${name}" should be visible`).toBeVisible();
  await card.click({ position: { x: 12, y: 10 } });
}

/**
 * Selects at least `minCount` task cards with a Shift+drag marquee, the same
 * box-select gesture the tour suggests. Additive Cmd/Ctrl-click is unreliable
 * across platforms (the modifier React Flow expects flips with the reported
 * OS), whereas Shift+drag selection works the same everywhere. Cards behind the
 * tour popover are excluded, and the marquee fully encloses the chosen cards
 * (SelectionMode.Full) starting from empty canvas just outside them.
 */
async function multiSelectTasks(page: Page, minCount: number): Promise<void> {
  await fitToView(page);

  // Restrict to plain (non-subgraph) task cards: packing tasks that are already
  // subgraphs wouldn't raise the top-level subgraph count the create-subgraph
  // step waits on. Subgraph cards carry the lucide "Workflow" glyph.
  const cards = page
    .locator('[data-tour-card="task"]')
    .filter({ hasNot: page.locator("svg.lucide-workflow") });
  const count = await cards.count();

  if (count < minCount) {
    throw new Error(
      `multi-select needs ${minCount} non-subgraph task cards but found ${count}`,
    );
  }

  // The step's popover sits in the top-left corner and overlaps the upper task
  // cards. A card handles its own click as a single selection (so additive
  // Cmd/Ctrl-click can't build a multi-selection), which leaves a Shift+drag
  // marquee as the only way in. The marquee must fully enclose the target cards
  // (SelectionMode.Full) without the rectangle reaching under the popover — so
  // first pan the canvas down until the cards clear the popover vertically
  // (panning down avoids the right properties panel).
  const popover = await page.locator(POPOVER).boundingBox();
  let boxes = await cardBoxes(cards, count);
  if (popover) {
    const highest = Math.min(...boxes.map((b) => b.y));
    const popoverBottom = popover.y + popover.height;
    if (highest < popoverBottom) {
      const shift = popoverBottom - highest + 50;
      const grabX = Math.min(
        viewportWidth(page) - 120,
        popover.x + popover.width + 80,
      );
      await panCanvasFrom(
        page,
        { x: grabX, y: popover.y + 20 },
        { x: 0, y: shift },
      );
      boxes = await cardBoxes(cards, count);
    }
  }

  boxes.sort((a, b) => a.x - b.x);
  const chosen = boxes.slice(0, minCount);
  const margin = 28;
  const left = Math.min(...chosen.map((b) => b.x)) - margin;
  const top = Math.min(...chosen.map((b) => b.y)) - margin;
  const right = Math.max(...chosen.map((b) => b.x + b.width)) + margin;
  const bottom = Math.max(...chosen.map((b) => b.y + b.height)) + margin;

  await page.keyboard.down("Shift");
  await page.mouse.move(right, bottom);
  await page.mouse.down();
  await page.mouse.move((left + right) / 2, (top + bottom) / 2, { steps: 8 });
  await page.mouse.move(left, top, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
}

function viewportWidth(page: Page): number {
  return page.viewportSize()?.width ?? 1280;
}

async function cardBoxes(
  cards: Locator,
  count: number,
): Promise<{ x: number; y: number; width: number; height: number }[]> {
  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  for (let k = 0; k < count; k++) {
    const box = await cards.nth(k).boundingBox();
    if (box) boxes.push(box);
  }
  return boxes;
}

async function panCanvasFrom(
  page: Page,
  start: { x: number; y: number },
  delta: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 10 });
  await page.mouse.up();
}

async function connectEdge(page: Page, edge: TargetEdge): Promise<void> {
  await fitToView(page);

  const source = page
    .locator(
      `[data-task-name="${edge.sourceTaskName}"] [data-handleid="output_${edge.sourcePortName}"]`,
    )
    .first();

  const target = edge.targetTaskName
    ? page
        .locator(
          `[data-task-name="${edge.targetTaskName}"] [data-handleid="input_${edge.targetPortName}"]`,
        )
        .first()
    : page
        .locator('[data-tour-card="output"] .react-flow__handle-left')
        .first();

  await expect(source, "edge source handle should be visible").toBeVisible();
  await expect(target, "edge target handle should be visible").toBeVisible();

  await source.hover();
  await page.mouse.down();
  await target.hover();
  await page.mouse.up();
}

async function dragWindowHeaderTo(
  page: Page,
  windowId: string,
  to: { x: number; y: number },
): Promise<void> {
  const win = page.locator(`[data-window-id="${windowId}"]`).first();
  await expect(win, `window "${windowId}" should be present`).toBeVisible();

  const box = await win.boundingBox();
  if (!box) {
    throw new Error(`Unable to locate bounding box for window "${windowId}"`);
  }

  // Grab the header strip at the top of the window (the only drag handle on a
  // floating window), offset from the right edge so we miss the action buttons.
  const fromX = box.x + Math.min(60, box.width / 2);
  const fromY = box.y + 10;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  // Several intermediate moves so the drag passes the activation threshold and
  // the dock can resolve a snap target before release.
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

async function dockAreaCenter(
  page: Page,
  side: "left" | "right",
  fallback: { x: number; y: number },
): Promise<{ x: number; y: number }> {
  const area = page.locator(`[data-dock-area="${side}"]`).first();
  const box = await area.boundingBox().catch(() => null);
  if (!box) return fallback;
  return { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 200) };
}

async function performInteraction(
  page: Page,
  tourId: string,
  index: number,
  step: TourStepDef,
): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };

  switch (step.interaction) {
    case "expand-folder": {
      const folderName = step.targetFolderName;
      if (!folderName) break;
      const folder = page.locator(`[data-folder-name="${folderName}"]`);
      const button = folder
        .locator(`[aria-label="Folder: ${folderName}"][role="button"]`)
        .first();
      await expect(button).toBeVisible();
      if ((await button.getAttribute("aria-expanded")) === "false") {
        await button.click();
      }
      break;
    }

    case "library-search": {
      const input = searchInput(page);
      await input.click();
      await input.fill(step.targetSearchTerm ?? "");
      break;
    }

    case "add-task": {
      if (step.targetTaskName) {
        await addComponentByDrag(page, step.targetTaskName);
      }
      break;
    }

    case "add-output": {
      await addComponentByDrag(
        page,
        step.targetComponentName ?? "Output Node",
        {
          search: false,
        },
      );
      break;
    }

    case "add-input": {
      await addComponentByDrag(page, step.targetComponentName ?? "Input Node", {
        search: false,
      });
      break;
    }

    case "connect-edge": {
      if (step.targetEdge) {
        await connectEdge(page, step.targetEdge);
      }
      break;
    }

    case "select-task": {
      const name = step.targetTaskName;
      if (!name) break;
      await selectTaskByName(page, name);
      break;
    }

    case "set-argument": {
      const argName = step.targetArgumentName;
      if (!argName) break;
      const row = page.locator(`[data-argument-name="${argName}"]`);
      const input = row.getByTestId("argument-input");
      await expect(input).toBeVisible();
      await input.click();
      await input.fill(step.targetArgumentValue ?? "tips");
      await input.blur();
      break;
    }

    case "undock-window": {
      if (!step.targetWindowId) break;
      await dragWindowHeaderTo(page, step.targetWindowId, {
        x: viewport.width / 2,
        y: viewport.height / 2,
      });
      break;
    }

    case "redock-window": {
      if (!step.targetWindowId) break;
      // Drag the floating window back over the right dock area to re-dock it.
      const target = await dockAreaCenter(page, "right", {
        x: viewport.width - 40,
        y: viewport.height / 2,
      });
      await dragWindowHeaderTo(page, step.targetWindowId, target);
      break;
    }

    case "navigate-into-subgraph": {
      const name = step.targetTaskName;
      if (!name) break;
      const card = page
        .locator(`[data-tour-card="task"][data-tour-card-name="${name}" i]`)
        .first();
      await expect(card).toBeVisible();
      await card.dblclick();
      break;
    }

    case "navigate-to-root": {
      await page.locator('[data-tour-crumb="root"]').first().click();
      break;
    }

    case "multi-select-tasks": {
      await multiSelectTasks(page, step.targetMinCount ?? 2);
      break;
    }

    case "unpack-subgraph": {
      await page.locator('[data-tour="node-menu-trigger"]').click();
      const unpack = page.locator('[data-tour="node-menu-unpack"]');
      await expect(unpack).toBeVisible();
      await unpack.click();
      break;
    }

    case "create-subgraph": {
      await page.locator('[data-testid="selection-create-subgraph"]').click();
      const popover = page.locator('[data-tour="create-subgraph-popover"]');
      await expect(popover).toBeVisible();
      await popover.locator("input").first().fill("Tour Subgraph");
      await popover.getByRole("button", { name: /create subgraph/i }).click();
      break;
    }

    default: {
      await assignSecretInteraction(page, tourId, index, step);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Secrets-tour interaction handlers                                          */
/* -------------------------------------------------------------------------- */

const TOUR_SECRET_NAME = "TOUR_E2E_SECRET";
const TOUR_SECRET_VALUE = "tour-e2e-value";

async function assignSecretInteraction(
  page: Page,
  tourId: string,
  index: number,
  step: TourStepDef,
): Promise<void> {
  switch (step.interaction) {
    case "open-secret-dialog": {
      const argName = step.targetArgumentName ?? "token";
      const row = page.locator(`[data-argument-name="${argName}"]`);
      await expect(row).toBeVisible();
      await row.hover();
      await row.getByTestId("thunder-menu-trigger").click();
      await page
        .locator('[data-tour="thunder-menu-content"]')
        .getByText(/dynamic data/i)
        .click();
      await page
        .locator('[data-tour="thunder-menu-submenu-content"]')
        .getByText(/select secret/i)
        .click();
      break;
    }

    case "assign-secret-argument": {
      await createAndPickSecret(page);
      break;
    }

    case "open-settings-panel": {
      await page.locator('[data-tracking-id="v2.header.settings"]').click();
      break;
    }

    case "open-submit-dialog": {
      const button = page
        .locator('[data-dock-window-content="runs-and-submission"]')
        .getByTestId("run-with-arguments-button")
        .first();
      await expect(button).toBeEnabled();
      await button.click();
      break;
    }

    case "assign-secret-submit": {
      const argName = step.targetArgumentName ?? "API_KEY";
      const dialog = page.locator('[data-tour="submit-arguments-dialog"]');
      await expect(dialog).toBeVisible();
      // The "Use Secret" lock button is hidden until its input row is hovered
      // (CSS group-hover) and the row sits under the centered tour popover, so a
      // real hover can't land. The button is in the DOM regardless, so dispatch
      // the click straight to it to open the secret picker.
      const group = dialog.locator(`.group:has(input#${argName})`).first();
      await group.locator("button:has(svg.lucide-lock)").dispatchEvent("click");
      await pickExistingSecret(page);
      break;
    }

    default: {
      throw new Error(
        `[${tourId}] step ${index}: unhandled tour interaction "${step.interaction}"`,
      );
    }
  }
}

async function createAndPickSecret(page: Page): Promise<void> {
  const dialog = page.locator('[data-testid="select-secret-dialog"]');
  await expect(dialog).toBeVisible();

  // If a secret already exists (e.g. one created earlier in the tour), just
  // pick it. Otherwise add one first. The centered tour popover overlaps the
  // dialog's buttons, so dispatch clicks straight to each (React still receives
  // them) rather than real mouse clicks the popover would intercept; the input
  // fields are reachable.
  const existing = page.locator('[data-testid="selectable-secret-item"]');
  if ((await existing.count()) === 0) {
    await clickThrough(dialog.getByTestId("select-secret-add-button"));
    await dialog.getByTestId("secret-name-input").fill(TOUR_SECRET_NAME);
    await dialog.getByTestId("secret-value-input").fill(TOUR_SECRET_VALUE);
    await clickThrough(dialog.getByTestId("add-secret-submit-button"));
  }

  await pickExistingSecret(page);
}

async function pickExistingSecret(page: Page): Promise<void> {
  const item = page.locator('[data-testid="selectable-secret-item"]').first();
  await expect(item).toBeVisible();
  await clickThrough(item);
}

/**
 * Clicks an element by dispatching the event directly to it. Used only where
 * the centered tour popover overlaps a dialog control: a real mouse click would
 * land on the popover, but the underlying React handler still fires on a
 * dispatched click.
 */
async function clickThrough(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  await locator.dispatchEvent("click");
}
