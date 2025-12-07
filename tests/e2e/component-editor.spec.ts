import { expect, type Page, test } from "@playwright/test";

import {
  createNewPipeline,
  dropComponentFromLibraryOnCanvas,
  locateFolderByName,
  openComponentLibFolder,
  removeComponentFromCanvas,
} from "./helpers";

/**
 * Due to the time it takes to load the library, the tests are run in serial
 *  and one page is used for all the tests.
 *
 * So every test must clean up after itself
 */
test.describe.configure({ mode: "serial" });

test.describe("Component Editor", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    // Create new pipeline and wait for it to load
    await createNewPipeline(page);

    // in-app component editor is enabled by default
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("create new component from template", async () => {
    const expectedFirstLevelFolders = ["Inputs & Outputs", "Standard library"];

    // expect to see all the folders
    for (const folder of expectedFirstLevelFolders) {
      const folderContainer = await locateFolderByName(page, folder);
      expect(folderContainer).toBeVisible();
    }

    await page.getByTestId("import-component-button").click();

    await page.waitForTimeout(200);

    const dialog = await page.getByTestId("import-component-dialog");
    await dialog.getByRole("tab", { name: "New" }).click();

    await page
      .getByTestId("new-component-template-selector-option-python")
      .click();

    await page.waitForSelector(`[data-testid="python-editor"]`);

    await page.getByRole("button", { name: "Save" }).click();

    // drop component on the canvas
    await dropComponentFromLibraryOnCanvas(
      page,
      "User Components",
      "Filter text",
    );

    const usedOnCanvasFolder = await openComponentLibFolder(
      page,
      "Used in Pipeline",
    );
    expect(await usedOnCanvasFolder.locator("li")).toHaveCount(1);

    // remove the component from the canvas
    await removeComponentFromCanvas(page, "Filter text");
    expect(await usedOnCanvasFolder.locator("li")).toHaveCount(0);

    const userComponentsFolder = await openComponentLibFolder(
      page,
      "User Components",
    );

    // remove the component from the user components folder
    await userComponentsFolder
      .locator("li")
      .first()
      .getByTestId("favorite-star")
      .click();

    await page.getByRole("button", { name: "Continue" }).click();
  });
});
