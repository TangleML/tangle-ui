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
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("initial set of folders", async () => {
    const expectedFirstLevelFolders = ["Inputs & Outputs", "Standard library"];

    // expect to see all the folders
    for (const folder of expectedFirstLevelFolders) {
      const folderContainer = await locateFolderByName(page, folder);
      expect(folderContainer).toBeVisible();
    }

    // special folders are not rendered from the beginning
    const countOfFoldersByDefault = await page.locator("[data-folder-name]");
    expect(countOfFoldersByDefault).toHaveCount(
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
      expect(folderContainer).toBeVisible();
    }
  });

  test("library can be searched", async () => {
    // search for a component
    await searchForComponent(page, "GCS");

    const searchResultsHeader = await page.getByTestId("search-results-header");
    expect(await searchResultsHeader.isVisible()).toBe(true);
    expect(await searchResultsHeader).toHaveText("Search Results (5)");
    const componentItem = await page.getByTestId("component-item");
    expect(componentItem).toHaveCount(5);

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
    expect(await favoritesFolder.locator("li")).toHaveCount(1);

    // unstar the component
    const downloadFromGCSFavorite = await locateComponentInFolder(
      favoritesFolder,
      "Download from GCS",
    );
    await downloadFromGCSFavorite.getByTestId("favorite-star").click();

    // giving time for the component to be removed from the favorites folder
    // todo: find a better way to do this
    await page.waitForTimeout(200);

    // expect the component to be removed from the favorites folder
    expect(await favoritesFolder.locator("li")).toHaveCount(0);
  });

  test("component details can be opened as a dialog", async () => {
    await searchForComponent(page, "GCS");

    const downloadFromGCS = await findComponentFromSearchResults(
      page,
      "Download from GCS",
    );
    await downloadFromGCS.getByTestId("info-icon-button").click();

    await page.waitForSelector(`[data-testid="component-details-tabs"]`);

    const dialogHeader = await page.locator('[data-slot="dialog-header"]');
    expect(dialogHeader).toBeVisible();

    expect(dialogHeader).toHaveText("Download from GCS");

    await page.locator('button[data-slot="dialog-close"]').click();

    await page.waitForTimeout(200);

    await clearSearch(page);
  });

  test("components from search results can be dragged to the canvas and appear in the used in pipeline folder", async () => {
    await searchForComponent(page, "GCS");

    const downloadFromGCS = await findComponentFromSearchResults(
      page,
      "Download from GCS",
    );
    // drop component on the canvas
    await dragComponentToCanvas(page, downloadFromGCS);

    await clearSearch(page);

    const usedOnCanvasFolder = await openComponentLibFolder(
      page,
      "Used in Pipeline",
    );
    expect(await usedOnCanvasFolder.locator("li")).toHaveCount(1);

    // remove the component from the canvas
    await removeComponentFromCanvas(page, "Download from GCS");
    expect(await usedOnCanvasFolder.locator("li")).toHaveCount(0);
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

    // click on component output pin
    await page.getByTestId("input-handle-table").click();
    await page.waitForTimeout(200);

    // assert that the output handle is highlighted
    const outputConnection = await page.getByTestId(
      "output-connection-transformed_table",
    );
    const inputConnection = await page.getByTestId("input-connection-table");

    // assert highlighting
    expect(await outputConnection.getAttribute("data-highlighted")).toBe(
      "true",
    );
    expect(await inputConnection.getAttribute("data-highlighted")).toBe(
      "false",
    );
    expect(await inputConnection.getAttribute("data-selected")).toBe("true");

    // reset highlighting after clicking on the canvas
    await locateFlowCanvas(page).click();
    await page.waitForTimeout(200);

    // resets selection after clicking on the canvas
    expect(await inputConnection.getAttribute("data-highlighted")).toBe(
      "false",
    );
    expect(await outputConnection.getAttribute("data-highlighted")).toBe(
      "false",
    );

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

    // drop component on the canvas
    await dropComponentFromLibraryOnCanvas(
      page,
      "CSV",
      "Select columns using Pandas on CSV data",
    );

    // click on component output pin
    await page.getByTestId("output-handle-transformed_table").click();
    await page.waitForTimeout(200);

    // assert that the output handle is selected
    const outputConnection = await page.getByTestId(
      "output-connection-transformed_table",
    );
    const inputConnection = await page.getByTestId("input-connection-table");

    // assert highlighting
    expect(await outputConnection.getAttribute("data-highlighted")).toBe(
      "false",
    );
    expect(await outputConnection.getAttribute("data-selected")).toBe("true");
    expect(await inputConnection.getAttribute("data-highlighted")).toBe("true");

    // reset highlighting after clicking on the canvas
    await locateFlowCanvas(page).click();
    await page.waitForTimeout(200);

    // resets selection after clicking on the canvas
    expect(await inputConnection.getAttribute("data-highlighted")).toBe(
      "false",
    );
    expect(await outputConnection.getAttribute("data-selected")).toBe("false");

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
  await page.waitForSelector(`[data-testid="search-results-container"]`);
}

async function clearSearch(page: Page) {
  await page.getByTestId("search-input").clear();

  await page.waitForTimeout(200);
}

async function findComponentFromSearchResults(
  page: Page,
  componentName: string,
) {
  const container = await page.getByTestId("search-results-container");
  const component = await container.locator(
    `[data-component-name="${componentName}"]`,
  );
  return component;
}
