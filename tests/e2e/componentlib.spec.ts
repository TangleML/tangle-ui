import { expect, type Page, test } from "@playwright/test";

import {
  assertSearchState,
  createNewPipeline,
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

test.describe("Component Library", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await createNewPipeline(page);
  });

  test.afterAll(async () => {
    await page.close();
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

  test("folder can be expanded and collapsed", async () => {
    // ensure no components are visible in the folder before it is expanded
    const inputsOutputsFolder = await locateFolderByName(
      page,
      "Inputs & Outputs",
    );
    await expect(inputsOutputsFolder.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const inputsOutputsFolderContent = inputsOutputsFolder.locator("li");

    (await inputsOutputsFolderContent.all()).forEach(async (component) => {
      await expect(component).toBeHidden();
    });

    // expand the folder
    await openComponentLibFolder(page, "Inputs & Outputs");

    await expect(inputsOutputsFolder.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // expect only two components in the folder
    const components = inputsOutputsFolder.locator("li");
    await expect(components).toHaveCount(2);

    await inputsOutputsFolder.getByRole("button").click();

    await expect(inputsOutputsFolder.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("user can navigate deep into the nested folders", async () => {
    // navigate to the nested folder
    await openComponentLibFolder(page, "Standard library");

    const topFolder = await openComponentLibFolder(page, "ML frameworks");
    const topFolderContent = topFolder.locator("[data-folder-name]");
    await expect(await topFolderContent).toHaveCount(6);

    const nestedFolder = await openComponentLibFolder(page, "XGBoost");

    const nestedFolderContent = nestedFolder.getByTestId("component-item");
    await expect(await nestedFolderContent).toHaveCount(4);
  });

  test("components can be added and removed from favorites folder", async () => {
    // add component to the favorites by clicking the star icon
    await openComponentLibFolder(page, "Standard library");

    const quickStartFolder = await openComponentLibFolder(page, "Quick start");
    const chicagoTaxiTripsDataset = await locateComponentInFolder(
      quickStartFolder,
      "Chicago Taxi Trips dataset",
    );
    await chicagoTaxiTripsDataset.getByTestId("favorite-star").click();

    // expect the component to be in the favorites folder
    const favoritesFolder = await openComponentLibFolder(
      page,
      "Favorite Components",
    );
    await expect(favoritesFolder.locator("li")).toHaveCount(1);

    // unstar the component
    await chicagoTaxiTripsDataset.getByTestId("favorite-star").click();

    await expect(favoritesFolder.locator("li")).toHaveCount(0);
  });

  test("component details can be opened as a dialog", async () => {
    await openComponentLibFolder(page, "Standard library");
    const quickStartFolder = await openComponentLibFolder(page, "Quick start");
    const chicagoTaxiTripsDataset = await locateComponentInFolder(
      quickStartFolder,
      "Chicago Taxi Trips dataset",
    );

    await chicagoTaxiTripsDataset.getByTestId("info-icon-button").click();

    const dialog = page.getByTestId("component-details-dialog");
    const dialogHeader = dialog.locator('[data-slot="dialog-header"]');
    await expect(dialogHeader).toBeVisible();

    await expect(dialogHeader).toHaveText("Chicago Taxi Trips dataset");

    await page.locator('button[data-slot="dialog-close"]').click();

    await expect(dialogHeader).toBeHidden();
  });

  test("components can be dragged to the canvas and appear in the used in pipeline folder", async () => {
    await openComponentLibFolder(page, "Standard library");
    await dropComponentFromLibraryOnCanvas(
      page,
      "Quick start",
      "Chicago Taxi Trips dataset",
    );

    const usedOnCanvasFolder = await openComponentLibFolder(
      page,
      "Used in Pipeline",
    );
    await expect(usedOnCanvasFolder.locator("li")).toHaveCount(1);

    // remove the component from the canvas
    await removeComponentFromCanvas(page, "Chicago Taxi Trips dataset");
    await expect(usedOnCanvasFolder.locator("li")).toHaveCount(0);
  });

  test("library can be searched", async () => {
    await page.getByTestId("search-input").fill("GCS");

    const searchResultsHeader = page.getByTestId("search-results-header");
    await expect(searchResultsHeader).toBeVisible();
    await expect(searchResultsHeader).toHaveText("Search Results (3)");

    const componentItem = page.getByTestId("component-item");
    await expect(componentItem).toHaveCount(3);

    await page.getByTestId("search-input").clear();

    await expect(searchResultsHeader).toBeHidden();
  });

  test("search results can be highlighted on input pin click", async () => {
    await openComponentLibFolder(page, "Standard library");
    await openComponentLibFolder(page, "Data manipulation");
    await openComponentLibFolder(page, "CSV");

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

    await assertSearchState(page, {
      searchTerm: "CSV",
      searchFilterCount: "2",
      searchResultsCount: "*",
    });

    // reset highlighting after clicking on the canvas
    await locateFlowCanvas(page).click();

    // resets selection after clicking on the canvas
    await expect(inputConnection).toHaveAttribute("data-highlighted", "false");
    await expect(outputConnection).toHaveAttribute("data-highlighted", "false");

    // search should be reset
    await assertSearchState(page, {
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

    // assert search inputs
    await assertSearchState(page, {
      searchTerm: "CSV",
      searchFilterCount: "2",
      // todo: this can be painful to maintain, find a better way to do this
      searchResultsCount: "*",
    });

    // reset highlighting after clicking on the canvas
    await locateFlowCanvas(page).click();

    // resets selection after clicking on the canvas
    await expect(inputConnection).toHaveAttribute("data-highlighted", "false");
    await expect(outputConnection).toHaveAttribute("data-selected", "false");

    // search should be reset
    await assertSearchState(page, {
      searchTerm: "",
    });

    // remove the component from the canvas
    await removeComponentFromCanvas(
      page,
      "Select columns using Pandas on CSV data",
    );
  });
});
