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

    await createNewPipeline(page);

    await expect(page.locator("[data-testid='search-input']")).toBeVisible();

    await page.getByTestId("personal-preferences-button").click();

    const dialog = page.getByTestId("personal-preferences-dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("tab", { name: "Beta Features" }).click();

    const switchElement = dialog.getByTestId(
      "remote-component-library-search-switch",
    );
    await expect(switchElement).toBeVisible({ timeout: 10000 });

    await switchElement.click();
    await expect(switchElement).toHaveAttribute("aria-checked", "true");

    await dialog.press("Escape");
    await expect(dialog).toBeHidden();

    await locateFolderByName(page, "Standard library");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("drop new component to canvas and publish it", async () => {
    const buffer = readFileSync(
      "tests/e2e/fixtures/components/test-component-a.component.v1.yaml",
    );

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

    await page.dispatchEvent(`[data-testid="rf__wrapper"]`, "drop", {
      dataTransfer,
    });

    const userComponentsFolder = await openComponentLibFolder(
      page,
      "User Components",
    );
    const component = locateComponentInFolder(
      userComponentsFolder,
      `Test component ${componentName}`,
    );
    await expect(component).toBeVisible();

    const infoButton = component.getByTestId("info-icon-button");
    await infoButton.click();

    const dialog = page.getByTestId("component-details-dialog");
    await expect(dialog.getByTestId("component-details-tabs")).toBeVisible();

    const dialogHeader = dialog.locator('[data-slot="dialog-header"]');
    await expect(dialogHeader).toHaveText(`Test component ${componentName}`);

    const publishButton = dialog
      .locator(`[role="tablist"]`)
      .getByText("Publish");
    await publishButton.click();

    await expect(
      dialog.getByTestId("component-review-container"),
    ).toBeVisible();

    const publishComponentButton = dialog.getByTestId(
      "publish-component-button",
    );
    await expect(publishComponentButton).toBeVisible();

    await dialog.locator('[data-slot="dialog-close"]').click();
  });
});
