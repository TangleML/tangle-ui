import { expect, test } from "@playwright/test";

import {
  createNewPipeline,
  dropComponentFromLibraryOnCanvas,
  openComponentLibFolder,
  setBetaFlag,
} from "./helpers";

test.describe("Input Aggregator Component", () => {
  test.beforeEach(async ({ page }) => {
    await setBetaFlag(page, "input-aggregator", true);
  });

  test.skip("should render aggregator component with custom UI elements", async ({
    page,
  }) => {
    // Input Aggregator is not yet in the sidebar at this point in the stack.
    // It is wired into the "Inputs & Outputs" folder in feat/fixes.
    await createNewPipeline(page);

    const node = await dropComponentFromLibraryOnCanvas(
      page,
      "Inputs & Outputs",
      "Input Aggregator",
    );

    await expect(node).toBeVisible();

    await node.click();

    const addInputHandle = node.locator(
      '[data-testid="input-connection-__add_aggregator_input__"]',
    );
    await expect(addInputHandle).toBeVisible();

    const outputTypeSelector = node.locator('[data-slot="select-trigger"]');
    await expect(outputTypeSelector).toBeVisible();
  });

  test.skip("should add dynamic inputs when connection is made to add-input handle", async ({
    page,
  }) => {
    await createNewPipeline(page);

    await openComponentLibFolder(page, "Standard library");

    const sourceNode = await dropComponentFromLibraryOnCanvas(
      page,
      "Quick start",
      "Chicago Taxi Trips dataset",
      { targetPosition: { x: 300, y: 300 } },
    );

    const aggregatorNode = await dropComponentFromLibraryOnCanvas(
      page,
      "Inputs & Outputs",
      "Input Aggregator",
      { targetPosition: { x: 600, y: 300 } },
    );

    await expect(sourceNode).toBeVisible();
    await expect(aggregatorNode).toBeVisible();

    const initialInputs = await aggregatorNode
      .locator('[data-testid^="input-connection-"]')
      .count();

    const sourceHandle = sourceNode.locator('[data-handleid="output_Table"]');
    const targetHandle = aggregatorNode.locator(
      '[data-handleid="__add_aggregator_input__"]',
    );

    await sourceHandle.hover();
    await page.mouse.down();
    await targetHandle.hover();
    await page.mouse.up();

    const updatedInputs = await aggregatorNode
      .locator('[data-testid^="input-connection-"]')
      .count();
    expect(updatedInputs).toBe(initialInputs + 1);
  });

  test.skip("should change output type when selector is used", async ({
    page,
  }) => {
    // Input Aggregator is not yet in the sidebar at this point in the stack.
    // It is wired into the "Inputs & Outputs" folder in feat/fixes.
    await createNewPipeline(page);

    const node = await dropComponentFromLibraryOnCanvas(
      page,
      "Inputs & Outputs",
      "Input Aggregator",
    );

    await expect(node).toBeVisible();
    await node.click();

    const outputTypeSelector = node.locator('[data-slot="select-trigger"]');
    await outputTypeSelector.click();

    await page.getByRole("option", { name: "Object" }).click();

    await expect(outputTypeSelector).toContainText("Object");
  });
});
