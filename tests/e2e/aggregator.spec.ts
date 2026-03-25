import { expect, test } from "@playwright/test";

import {
  createNewPipeline,
  dropComponentFromLibraryOnCanvas,
  openComponentLibFolder,
  setBetaFlag,
} from "./helpers";

test.describe("Input Aggregator Component", () => {
  test.beforeEach(async ({ page }) => {
    await setBetaFlag(page, "pipeline-aggregator", true);
  });

  test("should render aggregator component with custom UI elements", async ({
    page,
  }) => {
    await createNewPipeline(page);
    await openComponentLibFolder(page, "Standard library");

    const node = await dropComponentFromLibraryOnCanvas(
      page,
      "Beta",
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
      { targetPosition: { x: 400, y: 200 } },
    );

    const aggregatorNode = await dropComponentFromLibraryOnCanvas(
      page,
      "Beta",
      "Input Aggregator",
      { targetPosition: { x: 400, y: 550 } },
    );

    await expect(sourceNode).toBeVisible();
    await expect(aggregatorNode).toBeVisible();

    const initialInputs = await aggregatorNode
      .locator('[data-testid^="input-connection-"]')
      .count();

    const sourceHandle = sourceNode.locator('[data-handleid="output_Table"]');
    const targetHandle = aggregatorNode.locator(
      '[data-handleid="input___add_aggregator_input__"]',
    );

    await sourceHandle.dragTo(targetHandle);

    await expect(
      aggregatorNode.locator('[data-testid^="input-connection-"]'),
    ).toHaveCount(initialInputs + 1);
  });

  test("should change output type when selector is used", async ({ page }) => {
    await createNewPipeline(page);
    await openComponentLibFolder(page, "Standard library");

    const node = await dropComponentFromLibraryOnCanvas(
      page,
      "Beta",
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
