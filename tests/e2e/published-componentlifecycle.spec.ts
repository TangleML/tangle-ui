import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "fs";

import {
  createNewPipeline,
  locateComponentInFolder,
  locateFolderByName,
  openComponentLibFolder,
} from "./helpers";

/**
 * Due to the time it takes to load the library, the tests are run in serial
 *  and one page is used for all the tests.
 *
 * So every test must clean up after itself
 */
test.describe.configure({ mode: "serial" });

test.describe("Published Component Library - Lifecycle", () => {
  let page: Page;

  const componentName = Math.random().toString(36).substring(2, 15);

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // Create new pipeline and wait for it to load
    await createNewPipeline(page);
    await page.waitForTimeout(200);

    // open personal preferences
    await page.getByTestId("personal-preferences-button").click();
    await page.waitForTimeout(200);

    // close personal preferences
    const dialog = await page.getByTestId("personal-preferences-dialog");
    await dialog.getByTestId("remote-component-library-search-switch").click();
    await dialog.getByTestId("close-button").click();

    await locateFolderByName(page, "Standard library");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("drop new component to canvas and publish it", async () => {
    // Read your file into a buffer.
    const buffer = readFileSync(
      "tests/e2e/fixtures/components/test-component-a.component.v1.yaml",
    );

    /**
     * This test requires component to be generated dynamically, so no backend mock is needed
     */
    const modifiedComponentText = buffer
      .toString()
      .replace(
        "{VERSION_PLACEHOLDER}",
        Math.random().toString(36).substring(2, 15),
      )
      .replace("{NAME_PLACEHOLDER}", componentName);

    const base64ModifiedComponentText = Buffer.from(
      modifiedComponentText,
    ).toString("base64");

    // Create the DataTransfer and File
    const dataTransfer = await page.evaluateHandle(
      async ({ bufferData, localFileName, localFileType }) => {
        const dt = new DataTransfer();

        const blobData = await fetch(bufferData).then((res) => res.blob());

        const file = new File([blobData], localFileName, {
          type: localFileType,
        });
        dt.items.add(file);
        return dt;
      },
      {
        bufferData: `data:application/octet-stream;base64,${base64ModifiedComponentText}`,
        localFileName: "test-component-a.component.v1.yaml",
        localFileType: "application/yaml",
      },
    );
    // Now dispatch
    await page.dispatchEvent(`[data-testid="rf__wrapper"]`, "drop", {
      dataTransfer,
    });

    const userComponentsFolder = await openComponentLibFolder(
      page,
      "User Components",
    );
    const component = await locateComponentInFolder(
      userComponentsFolder,
      `Test component ${componentName}`,
    );
    expect(component).toBeVisible();

    const infoButton = await component.getByTestId("info-icon-button");
    await infoButton.click();

    await page.waitForSelector(`[data-testid="component-details-tabs"]`);
    const dialog = await page.getByRole("dialog");

    const dialogHeader = await dialog.locator('[data-slot="dialog-header"]');

    expect(dialogHeader).toHaveText(`Test component ${componentName}`);

    const publishButton = await page
      .locator(`[role="tablist"]`)
      .getByText("Publish");
    await publishButton.click();

    await dialog.getByTestId("component-review-container");

    await page.waitForSelector(`[data-testid="publish-component-button"]`);

    const publishComponentButton = await dialog.getByTestId(
      "publish-component-button",
    );
    expect(publishComponentButton).toBeVisible();

    await dialog.locator('[data-slot="dialog-close"]').click();
  });
});
