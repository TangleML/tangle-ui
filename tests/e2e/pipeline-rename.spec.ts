import { expect, test } from "@playwright/test";

import { createNewPipeline } from "./helpers";

const RENAME_BUTTON = '[data-tracking-id$="rename_pipeline_click"]';

test.describe("Renaming a pipeline in the legacy editor", () => {
  test("moves the pipeline rather than leaving one under each name", async ({
    page,
  }) => {
    await createNewPipeline(page);

    const originalName = decodeURIComponent(
      new URL(page.url()).pathname.split("/").pop() ?? "",
    );
    expect(originalName).not.toBe("");

    const renamed = `${originalName} renamed`;

    await page.locator(RENAME_BUTTON).click();
    await page.getByRole("textbox").fill(renamed);
    await page.getByRole("button", { name: "Update Title" }).click();

    await expect(page).toHaveURL(new RegExp(encodeURIComponent(renamed)));

    await page.goto("/pipelines");
    await expect(page.getByText(renamed)).toBeVisible();
    await expect(page.getByText(originalName, { exact: true })).toBeHidden();
  });
});
