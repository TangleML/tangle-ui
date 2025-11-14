import { expect, test } from "@playwright/test";

import {
  clickOnCanvas,
  createNewPipeline,
  dropComponentFromLibraryOnCanvas,
  fitToView,
  locateFlowCanvas,
  locateFlowViewport,
  openComponentLibFolder,
  panCanvas,
  waitForContextPanel,
  zoomIn,
  zoomOut,
} from "./helpers";

test.describe("FlowCanvas Basic Functionality", () => {
  test("should load pipeline editor and allow basic node interaction", async ({
    page,
  }) => {
    // Create new pipeline and verify all components are loaded
    await createNewPipeline(page);

    // Verify main canvas elements
    await expect(locateFlowCanvas(page)).toBeVisible();
    await expect(locateFlowViewport(page)).toBeVisible();

    // Check React Flow UI components
    await expect(page.locator(".react-flow__minimap")).toBeVisible();
    await expect(page.locator(".react-flow__background")).toBeVisible();
    await expect(page.locator(".react-flow__controls")).toBeVisible();

    // Test basic canvas interaction
    await clickOnCanvas(page, 400, 300);

    // Test canvas panning
    await panCanvas(page, 50, 50);

    // Test zoom controls
    await zoomIn(page);
    await zoomOut(page);
  });

  test("should place a node on the canvas after standard library is loaded", async ({
    page,
  }) => {
    // Create new pipeline and wait for it to load
    await createNewPipeline(page);
    await openComponentLibFolder(page, "Standard library");

    // Add a component from the Quick start library
    const node = await dropComponentFromLibraryOnCanvas(
      page,
      "Quick start",
      "Chicago Taxi Trips dataset",
    );

    await expect(node).toBeVisible();

    // Verify the pipeline details panel is visible initially
    await waitForContextPanel(page, "pipeline-details");

    await node.click();

    // Verify the node is selected and the task configuration panel is visible
    await expect(node).toHaveClass(/\bselected\b/);
    await waitForContextPanel(page, "task-overview");
  });

  test("should connect two nodes satisfying the required field requirements", async ({
    page,
  }) => {
    // Create new pipeline and wait for it to load
    await createNewPipeline(page);
    await openComponentLibFolder(page, "Standard library");

    // Add a component from the Quick start library
    const nodeA = await dropComponentFromLibraryOnCanvas(
      page,
      "Quick start",
      "Chicago Taxi Trips dataset",
    );

    // todo: create more reliable way to position nodes
    const nodeABox = await nodeA.boundingBox();

    // position nodeA to the left of the canvas
    await panCanvas(page, -nodeABox!.width, 0);

    // position nodeB to the right of nodeA
    const nodeB = await dropComponentFromLibraryOnCanvas(
      page,
      "Quick start",
      "Train XGBoost model on CSV",
      {
        targetPosition: { x: nodeABox!.width * 1.5, y: nodeABox!.y },
      },
    );

    await expect(nodeA).toBeVisible();
    await expect(nodeB).toBeVisible();

    const outputPin = await nodeA.locator('[data-handleid="output_Table"]');
    const inputPin = await nodeB.locator(
      '[data-handleid="input_training_data"]',
    );

    // ensure both connectors are within viewport
    await fitToView(page);

    await expect(outputPin).toBeInViewport();
    await expect(inputPin).toBeInViewport();
    await expect(inputPin).toHaveAttribute("data-invalid", "true");

    await outputPin.hover();
    await page.mouse.down();
    await inputPin.hover();
    await page.mouse.up();

    await expect(inputPin).toHaveAttribute("data-invalid", "false");

    const edgesContainer = await page.locator(".react-flow__edges");
    const edge = await edgesContainer.locator(
      '[data-testid="rf__edge-Chicago Taxi Trips dataset_Table-Train XGBoost model on CSV_training_data"]',
    );
    await expect(edge).toBeVisible();

    const inputHandle = await nodeB.locator(
      '[data-testid="input-handle-training_data"]',
    );
    await expect(inputHandle).toBeVisible();

    await expect(
      nodeB.locator('[data-testid="input-handle-value-training_data"]'),
    ).toHaveText(`→ Chicago Taxi Trips dataset.Table`);
  });
});
