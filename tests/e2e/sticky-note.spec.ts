import { expect, type Locator, type Page, test } from "@playwright/test";
import { promises as fs } from "fs";

import {
  clickOnCanvas,
  createNewPipeline,
  fitToView,
  locateFlowCanvas,
  openComponentLibFolder,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Sticky Note (FlexNode) Functionality", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await createNewPipeline(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("should drop a Sticky Note from Canvas Tools folder", async () => {
    const folder = await openComponentLibFolder(page, "Canvas Tools");
    const stickyNoteItem = folder.getByTestId("sticky-note-sidebar-item");
    await expect(stickyNoteItem).toBeVisible();

    const canvas = locateFlowCanvas(page);
    await stickyNoteItem.dragTo(canvas);

    const stickyNote = locateStickyNote(page);
    await expect(
      stickyNote,
      "Sticky Note should appear on canvas after drop",
    ).toBeVisible();
  });

  test("should resize Sticky Note using resize controls", async () => {
    const stickyNote = locateStickyNote(page);
    await stickyNote.click();

    await expect(stickyNote).toHaveClass(/\bselected\b/);

    const initialBox = await stickyNote.boundingBox();
    // eslint-disable-next-line playwright/no-conditional-in-test -- Necessary null check for boundingBox() return value
    if (!initialBox) {
      throw new Error("Unable to get bounding box for sticky note");
    }

    const resizeHandle = stickyNote.locator(
      ".react-flow__resize-control.bottom.right.handle",
    );
    await expect(resizeHandle).toBeVisible();

    const handleBox = await resizeHandle.boundingBox();
    // eslint-disable-next-line playwright/no-conditional-in-test -- Necessary null check for boundingBox() return value
    if (!handleBox) {
      throw new Error("Unable to get bounding box for resize handle");
    }

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 50);
    await page.mouse.up();

    const newBox = await stickyNote.boundingBox();
    // eslint-disable-next-line playwright/no-conditional-in-test -- Necessary null check for boundingBox() return value
    if (!newBox) {
      throw new Error(
        "Unable to get bounding box for sticky note after resize",
      );
    }

    expect(newBox.width, "Width should increase after resize").toBeGreaterThan(
      initialBox.width,
    );
    expect(
      newBox.height,
      "Height should increase after resize",
    ).toBeGreaterThan(initialBox.height);
  });

  test("should move Sticky Note around the canvas", async () => {
    await clickOnCanvas(page);

    const stickyNote = locateStickyNote(page);

    const initialTransform = await stickyNote.evaluate(
      (el) => el.style.transform,
    );

    const box = await stickyNote.boundingBox();
    // eslint-disable-next-line playwright/no-conditional-in-test -- Necessary null check for boundingBox() return value
    if (!box) {
      throw new Error("Unable to get bounding box for sticky note");
    }

    const startX = box.x + 10;
    const startY = box.y + 10;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 150, startY + 100, { steps: 10 });
    await page.mouse.up();

    const newTransform = await stickyNote.evaluate((el) => el.style.transform);

    expect(newTransform, "Node transform should change after drag").not.toBe(
      initialTransform,
    );
  });

  test("should display FlexNodeEditor in context panel when selected", async () => {
    const stickyNote = locateStickyNote(page);
    await stickyNote.click();

    const contextPanel = page.getByTestId("context-panel-container");
    await expect(contextPanel).toBeVisible();

    await expect(
      contextPanel.locator('text="Sticky Note"').first(),
      "Context panel should show Sticky Note header",
    ).toBeVisible();
  });

  test("should edit title in context panel", async () => {
    const stickyNote = locateStickyNote(page);
    await stickyNote.click();

    const titleInput = page.locator("#flex-node-title");
    await expect(titleInput).toBeVisible();

    await titleInput.clear();
    await titleInput.fill("My Custom Title");
    await titleInput.blur();

    await expect(
      stickyNote.locator('text="My Custom Title"'),
      "Sticky note should display updated title",
    ).toBeVisible();
  });

  test("should edit note content in context panel", async () => {
    const stickyNote = locateStickyNote(page);
    await stickyNote.click();

    const noteTextarea = page.locator("#flex-node-content");
    await expect(noteTextarea).toBeVisible();

    await noteTextarea.fill("This is my test note content");
    await noteTextarea.blur();

    await expect(
      stickyNote.locator('text="This is my test note content"'),
      "Sticky note should display updated content",
    ).toBeVisible();
  });

  test("should change background color using ColorPicker", async () => {
    const stickyNote = locateStickyNote(page);
    await stickyNote.click();

    const backgroundColorPicker = page.getByTestId(
      "color-picker-trigger-background-color",
    );

    await expect(backgroundColorPicker).toBeVisible();
    await backgroundColorPicker.click();

    const popover = page.getByTestId("color-picker-popover");
    await expect(popover).toBeVisible();

    // Select green preset (C8E6C9)
    const greenPreset = page.getByTestId("color-preset-c8e6c9");
    await greenPreset.click();

    // Click the sticky note to close popover while keeping it selected
    // (Escape would deselect the node in React Flow)
    await stickyNote.click();
    await expect(popover).toBeHidden();
  });

  test("should show border color picker when transparent is selected", async () => {
    const stickyNote = locateStickyNote(page);
    await stickyNote.click();

    const borderColorPicker = page.getByTestId(
      "color-picker-trigger-border-color",
    );

    await expect(
      borderColorPicker,
      "Border selector should NOT be visible before selecting transparent",
    ).toBeHidden();

    const backgroundColorPicker = page.getByTestId(
      "color-picker-trigger-background-color",
    );
    await backgroundColorPicker.click();

    const popover = page.getByTestId("color-picker-popover");
    await expect(popover).toBeVisible();

    // Select transparent preset
    const transparentPreset = page.getByTestId("color-preset-transparent");
    await transparentPreset.click();

    // Click the sticky note to close popover while keeping it selected
    // (Escape would deselect the node in React Flow)
    await stickyNote.click();
    await expect(popover).toBeHidden();

    await expect(
      borderColorPicker,
      "Border selector should appear after selecting transparent",
    ).toBeVisible();

    await borderColorPicker.click();

    const borderPopover = page.getByTestId("color-picker-popover");
    await expect(borderPopover).toBeVisible();

    // Select red preset (EF9A9A)
    const redPreset = page.getByTestId("color-preset-ef9a9a");
    await redPreset.click();

    // Click sticky note again to close popover while keeping selection
    await stickyNote.click();
    await expect(borderPopover).toBeHidden();
  });

  test("should drop 5 more sticky notes and test stacking controls", async () => {
    await clickOnCanvas(page);

    for (let i = 0; i < 5; i++) {
      const folder = await openComponentLibFolder(page, "Canvas Tools");
      const stickyNoteItem = folder.getByTestId("sticky-note-sidebar-item");
      const canvas = locateFlowCanvas(page);

      await stickyNoteItem.dragTo(canvas, {
        targetPosition: { x: 300 + i * 30, y: 200 + i * 30 },
      });
    }

    await fitToView(page);

    const allStickyNotes = page.locator(".react-flow__node-flex");
    await expect(allStickyNotes).toHaveCount(6);

    const lastNote = allStickyNotes.last();
    await lastNote.click();

    const contextPanel = page.getByTestId("context-panel-container");
    await expect(contextPanel.locator('text="Stacking"')).toBeVisible();

    const stackingControls = page.getByTestId("stacking-controls");
    await expect(stackingControls).toBeVisible();

    const moveForwardButton = page.getByTestId("stacking-move-forward");
    await expect(moveForwardButton).toBeVisible();
    await moveForwardButton.click();

    const moveBackwardButton = page.getByTestId("stacking-move-backward");
    await expect(moveBackwardButton).toBeVisible();
    await moveBackwardButton.click();

    const bringToFrontButton = page.getByTestId("stacking-bring-to-front");
    await expect(bringToFrontButton).toBeVisible();
    await bringToFrontButton.click();

    const sendToBackButton = page.getByTestId("stacking-send-to-back");
    await expect(sendToBackButton).toBeVisible();
    await sendToBackButton.click();
  });

  test("should duplicate sticky notes using SelectionToolbar", async () => {
    await fitToView(page);

    const allStickyNotes = page.locator(".react-flow__node-flex");
    const initialCount = await allStickyNotes.count();

    const canvas = locateFlowCanvas(page);
    const canvasBox = await canvas.boundingBox();
    // eslint-disable-next-line playwright/no-conditional-in-test -- Necessary null check for boundingBox() return value
    if (!canvasBox) {
      throw new Error("Unable to get bounding box for canvas");
    }

    // Click canvas first to ensure it has focus for keyboard events
    await clickOnCanvas(page);

    const startX = canvasBox.x + 50;
    const startY = canvasBox.y + 50;
    const endX = canvasBox.x + canvasBox.width - 50;
    const endY = canvasBox.y + canvasBox.height - 50;

    // Perform box selection with Shift+drag
    await page.keyboard.down("Shift");
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up("Shift");

    const selectionToolbar = page.getByTestId("selection-toolbar");
    await expect(
      selectionToolbar,
      "Selection toolbar should appear after box selection",
    ).toBeVisible({ timeout: 5000 });

    const duplicateButton = page.getByTestId("selection-duplicate-nodes");
    await expect(
      duplicateButton,
      "Duplicate button should appear in selection toolbar",
    ).toBeVisible();

    await duplicateButton.click();

    const newCount = await allStickyNotes.count();
    expect(
      newCount,
      "Sticky note count should increase after duplication",
    ).toBeGreaterThan(initialCount);
  });

  test("should serialize sticky notes in pipeline annotations (YAML export)", async () => {
    await fitToView(page);

    const exportButton = page.getByTestId("action-Export Pipeline");
    await expect(exportButton).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await exportButton.click();

    const download = await downloadPromise;
    const fileName = download.suggestedFilename();
    expect(fileName).toMatch(/\.yaml$/);

    const filePath = await download.path();
    // eslint-disable-next-line playwright/no-conditional-in-test -- Necessary null check for download.path() return value
    if (!filePath) {
      throw new Error("Download path is null");
    }

    const fileContent = await fs.readFile(filePath, "utf-8");

    expect(
      fileContent,
      "YAML should contain flex-nodes annotation key",
    ).toContain("flex-nodes:");

    expect(
      fileContent,
      "YAML should contain My Custom Title in flex node annotations",
    ).toContain("My Custom Title");

    expect(
      fileContent,
      "YAML should contain test note content in flex node annotations",
    ).toContain("This is my test note content");

    const flexNodesMatch = fileContent.match(/flex-nodes:\s*'([^']+)'/);

    expect(
      flexNodesMatch,
      "Should find flex-nodes annotation in YAML",
    ).toBeTruthy();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Guarded by expect above
    const flexNodesJson = flexNodesMatch![1];
    const flexNodes = JSON.parse(flexNodesJson) as Array<{
      id: string;
      properties: {
        title: string;
        content: string;
        color: string;
        borderColor?: string;
      };
      size: { width: number; height: number };
      position: { x: number; y: number };
      zIndex: number;
      metadata: { createdAt: string; createdBy: string };
    }>;

    expect(Array.isArray(flexNodes)).toBe(true);
    expect(
      flexNodes.length,
      "Should have at least 6 sticky notes serialized",
    ).toBeGreaterThanOrEqual(6);

    const customNote = flexNodes.find(
      (n) => n.properties.title === "My Custom Title",
    );
    expect(customNote, "Should find note with custom title").toBeTruthy();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Guarded by expect above
    const note = customNote!;
    expect(note.properties.content).toBe("This is my test note content");
    expect(note.properties.color).toBe("transparent");
    expect(note.properties.borderColor).toBeDefined();
    expect(note.size).toBeDefined();
    expect(note.position).toBeDefined();
    expect(note.zIndex).toBeDefined();
    expect(note.metadata.createdAt).toBeDefined();
    expect(note.metadata.createdBy).toBeDefined();
  });
});

/**
 * Locates a sticky note (flex node) on the canvas
 * Returns the first flex node if no specific selector is needed
 */
function locateStickyNote(page: Page): Locator {
  return page.locator(".react-flow__node-flex").first();
}
