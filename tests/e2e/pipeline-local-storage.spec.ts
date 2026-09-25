import { expect, test } from "@playwright/test";

import { seedLocallyStoredPipeline } from "./fixtures/pipelineStorageBackend";

/**
 * The open-source path: pipelines the browser already holds, and no backend
 * involved in storing them.
 */
test.describe("browser-stored pipelines", () => {
  test("lists what the browser already held", async ({ page }) => {
    const name = "Kept in the browser";

    await page.goto("/");
    await seedLocallyStoredPipeline(page, name);

    await page.goto("/pipelines");

    await expect(page.getByText(name)).toBeVisible();
  });

  test("files one it has never indexed under the root folder", async ({
    page,
  }) => {
    const name = "Never indexed";

    await page.goto("/");
    await seedLocallyStoredPipeline(page, name);

    await page.goto("/pipeline-folders");

    await expect(page.getByText(name)).toBeVisible();
  });
});
