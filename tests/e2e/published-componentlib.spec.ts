import { expect, type Page, test } from "@playwright/test";

import {
  assertSearchState,
  createNewPipeline,
  dragComponentToCanvas,
  dropComponentFromLibraryOnCanvas,
  locateComponentInFolder,
  locateFlowCanvas,
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

test.describe("Published Component Library", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    await createNewPipeline(page);

    await expect(page.locator("[data-testid='search-input']")).toBeVisible();

    await page.getByTestId("personal-preferences-button").click();

    const dialog = page.getByTestId("personal-preferences-dialog");
    await expect(dialog).toBeVisible();

    const switchElement = dialog.getByTestId(
      "remote-component-library-search-switch",
    );
    await expect(switchElement).toBeVisible({ timeout: 10000 });

    await switchElement.click();
    await expect(switchElement).toHaveAttribute("aria-checked", "true");

    await dialog.getByTestId("close-button").click();
    await expect(dialog).toBeHidden();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("initial set of folders", async () => {
    const expectedFirstLevelFolders = ["Inputs & Outputs", "Standard library"];

    // expect to see all the folders
    for (const folder of expectedFirstLevelFolders) {
      const folderContainer = await locateFolderByName(page, folder);
      await expect(folderContainer).toBeVisible();
    }

    // special folders are not rendered from the beginning
    const countOfFoldersByDefault = page.locator("[data-folder-name]");
    await expect(countOfFoldersByDefault).toHaveCount(
      expectedFirstLevelFolders.length,
    );
  });

  test("standard library successfully loads", async () => {
    await openComponentLibFolder(page, "Standard library");

    const standardLibraryFolders = [
      "Quick start",
      "Basics",
      "Datasets",
      "Data manipulation",
      "Upload/Download",
      "ML frameworks",
      "ML Metrics",
      "Converters",
    ];

    // expect to see all the folders
    for (const folder of standardLibraryFolders) {
      const folderContainer = await locateFolderByName(page, folder);
      await expect(folderContainer).toBeVisible();
    }
  });

  test("library can be searched", async () => {
    // search for a component
    await searchForComponent(page, "GCS");

    const searchResultsHeader = page.getByTestId("search-results-header");
    await expect(searchResultsHeader).toBeVisible();
    await expect(searchResultsHeader).toHaveText("Search Results (5)");

    const componentItem = page.getByTestId("component-item");
    await expect(componentItem).toHaveCount(5);

    await clearSearch(page);
  });

  test("components from search results can be added and removed from favorites folder", async () => {
    // add component to the favorites by clicking the star icon
    await searchForComponent(page, "GCS");

    const downloadFromGCS = await findComponentFromSearchResults(
      page,
      "Download from GCS",
    );

    await downloadFromGCS.getByTestId("favorite-star").click();

    await clearSearch(page);

    // expect the component to be in the favorites folder
    const favoritesFolder = await openComponentLibFolder(
      page,
      "Favorite Components",
    );
    await expect(favoritesFolder.locator("li")).toHaveCount(1);

    // unstar the component
    const downloadFromGCSFavorite = locateComponentInFolder(
      favoritesFolder,
      "Download from GCS",
    );
    await downloadFromGCSFavorite.getByTestId("favorite-star").click();

    await expect(favoritesFolder.locator("li")).toHaveCount(0);
  });

  test("component details can be opened as a dialog", async () => {
    await searchForComponent(page, "GCS");

    const downloadFromGCS = await findComponentFromSearchResults(
      page,
      "Download from GCS",
    );
    await downloadFromGCS.getByTestId("info-icon-button").click();

    await expect(page.getByTestId("component-details-tabs")).toBeVisible();

    const dialogHeader = page.locator('[data-slot="dialog-header"]');
    await expect(dialogHeader).toBeVisible();
    await expect(dialogHeader).toHaveText("Download from GCS");

    await page.locator('button[data-slot="dialog-close"]').click();

    await expect(dialogHeader).toBeHidden();

    await clearSearch(page);
  });

  test("components from search results can be dragged to the canvas and appear in the used in pipeline folder", async () => {
    await searchForComponent(page, "GCS");

    const downloadFromGCS = await findComponentFromSearchResults(
      page,
      "Download from GCS",
    );
    await dragComponentToCanvas(page, downloadFromGCS);

    await clearSearch(page);

    const usedOnCanvasFolder = await openComponentLibFolder(
      page,
      "Used in Pipeline",
    );
    await expect(usedOnCanvasFolder.locator("li")).toHaveCount(1);

    // remove the component from the canvas
    await removeComponentFromCanvas(page, "Download from GCS");
    await expect(usedOnCanvasFolder.locator("li")).toHaveCount(0);
  });

  test("search results can be highlighted on input pin click", async () => {
    await openComponentLibFolder(page, "Standard library");
    await openComponentLibFolder(page, "Data manipulation");
    await openComponentLibFolder(page, "CSV");

    // drop component on the canvas
    await dropComponentFromLibraryOnCanvas(
      page,
      "CSV",
      "Select columns using Pandas on CSV data",
    );

    await page.getByTestId("input-handle-table").click();

    const outputConnection = page.getByTestId(
      "output-connection-transformed_table",
    );
    const inputConnection = page.getByTestId("input-connection-table");
    await expect(outputConnection).toHaveAttribute("data-highlighted", "true");

    // assert highlighting
    await expect(outputConnection).toHaveAttribute("data-highlighted", "true");
    await expect(inputConnection).toHaveAttribute("data-highlighted", "false");
    await expect(inputConnection).toHaveAttribute("data-selected", "true");

    // reset highlighting after clicking on the canvas
    await locateFlowCanvas(page).click();

    // resets selection after clicking on the canvas
    await expect(inputConnection).toHaveAttribute("data-highlighted", "false");
    await expect(outputConnection).toHaveAttribute("data-highlighted", "false");

    // search should be reset
    assertSearchState(page, {
      searchTerm: "",
    });

    // remove the component from the canvas
    await removeComponentFromCanvas(
      page,
      "Select columns using Pandas on CSV data",
    );
  });

  test("search results can be highlighted on output pin click", async () => {
    await openComponentLibFolder(page, "Standard library");
    await openComponentLibFolder(page, "Data manipulation");
    await openComponentLibFolder(page, "CSV");

    await dropComponentFromLibraryOnCanvas(
      page,
      "CSV",
      "Select columns using Pandas on CSV data",
    );

    await page.getByTestId("output-handle-transformed_table").click();

    const outputConnection = page.getByTestId(
      "output-connection-transformed_table",
    );
    const inputConnection = page.getByTestId("input-connection-table");
    await expect(outputConnection).toHaveAttribute("data-selected", "true");

    // assert highlighting
    await expect(outputConnection).toHaveAttribute("data-highlighted", "false");
    await expect(outputConnection).toHaveAttribute("data-selected", "true");
    await expect(inputConnection).toHaveAttribute("data-highlighted", "true");

    // reset highlighting after clicking on the canvas
    await locateFlowCanvas(page).click();

    // resets selection after clicking on the canvas
    await expect(inputConnection).toHaveAttribute("data-highlighted", "false");
    await expect(outputConnection).toHaveAttribute("data-selected", "false");

    // search should be reset
    assertSearchState(page, {
      searchTerm: "",
    });

    // remove the component from the canvas
    await removeComponentFromCanvas(
      page,
      "Select columns using Pandas on CSV data",
    );
  });
});

async function searchForComponent(page: Page, componentName: string) {
  await page.getByTestId("search-input").fill(componentName);
  await expect(page.getByTestId("search-results-container")).toBeVisible();
}

async function clearSearch(page: Page) {
  await page.getByTestId("search-input").clear();

  const searchResultsHeader = page.getByTestId("search-results-header");
  await expect(searchResultsHeader).toBeHidden();
}

async function findComponentFromSearchResults(
  page: Page,
  componentName: string,
) {
  const container = page.getByTestId("search-results-container");
  const component = container.locator(
    `[data-component-name="${componentName}"]`,
  );
  return component;
}
