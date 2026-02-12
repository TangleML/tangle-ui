import { expect, test } from "@playwright/test";

import {
  createNewPipeline,
  dropComponentFromLibraryOnCanvas,
  openComponentLibFolder,
} from "./helpers";

test.describe("Pipeline Aggregator Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("settings-button").click();
    await page.getByRole("tab", { name: "Beta Features" }).click();
    const aggregatorCheckbox = page.getByRole("checkbox", {
      name: /Pipeline Aggregator/i,
    });
    await aggregatorCheckbox.check();
    await page.getByRole("button", { name: "Close" }).click();
  });

  test("should render aggregator component with custom UI elements", async ({
    page,
  }) => {
    await createNewPipeline(page);
    await openComponentLibFolder(page, "Standard library");

    const node = await dropComponentFromLibraryOnCanvas(
      page,
      "Beta",
      "Pipeline Aggregator",
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

  test("should add dynamic inputs when connection is made to add-input handle", async ({
    page,
  }) => {
    await createNewPipeline(page);
    await openComponentLibFolder(page, "Standard library");

    const sourceNode = await dropComponentFromLibraryOnCanvas(
      page,
      "Primitives",
      "String",
    );

    const aggregatorNode = await dropComponentFromLibraryOnCanvas(
      page,
      "Beta",
      "Pipeline Aggregator",
    );

    await expect(sourceNode).toBeVisible();
    await expect(aggregatorNode).toBeVisible();

    const initialInputs = await aggregatorNode
      .locator('[data-testid^="input-connection-"]')
      .count();

    const sourceHandle = sourceNode.locator(
      '[data-testid="output-connection-output"]',
    );
    const targetHandle = aggregatorNode.locator(
      '[data-testid="input-connection-__add_aggregator_input__"]',
    );

    const sourceBox = await sourceHandle.boundingBox();
    const targetBox = await targetHandle.boundingBox();

    if (sourceBox && targetBox) {
      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2,
        sourceBox.y + sourceBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2,
      );
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    const updatedInputs = await aggregatorNode
      .locator('[data-testid^="input-connection-"]')
      .count();
    expect(updatedInputs).toBe(initialInputs + 1);
  });

  test("should change output type when selector is used", async ({ page }) => {
    await createNewPipeline(page);
    await openComponentLibFolder(page, "Standard library");

    const node = await dropComponentFromLibraryOnCanvas(
      page,
      "Beta",
      "Pipeline Aggregator",
    );

    await expect(node).toBeVisible();
    await node.click();

    const outputTypeSelector = node.locator('[data-slot="select-trigger"]');
    await outputTypeSelector.click();

    await page.getByRole("option", { name: "Object" }).click();

    await expect(outputTypeSelector).toContainText("Object");
  });
});
