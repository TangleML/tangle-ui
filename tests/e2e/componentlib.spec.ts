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
    // Create new pipeline and wait for it to load
    await createNewPipeline(page);
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

  test("folder can be expanded and collapsed", async () => {
    // ensure no components are visible in the folder before it is expanded
    const inputsOutputsFolder = await locateFolderByName(
      page,
      "Inputs & Outputs",
    );
    expect(
      await inputsOutputsFolder
        .getByRole("button")
        .getAttribute("aria-expanded"),
    ).toBe("false");
    const inputsOutputsFolderContent = await inputsOutputsFolder.locator("li");

    (await inputsOutputsFolderContent.all()).forEach(async (component) => {
      expect(await component.isVisible()).toBe(false);
    });

    // expand the folder
    await openComponentLibFolder(page, "Inputs & Outputs");

    expect(
      await inputsOutputsFolder
        .getByRole("button")
        .getAttribute("aria-expanded"),
    ).toBe("true");

    // expect only two components in the folder
    const components = await inputsOutputsFolder.locator("li");
    expect(components).toHaveCount(2);

    await inputsOutputsFolder.getByRole("button").click();

    await page.waitForTimeout(200);

    expect(
      await inputsOutputsFolder
        .getByRole("button")
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  test("user can navigate deep into the nested folders", async () => {
    // navigate to the nested folder
    await openComponentLibFolder(page, "Standard library");

    const topFolder = await openComponentLibFolder(page, "ML frameworks");
    const topFolderContent = await topFolder.locator("[data-folder-name]");
    expect(await topFolderContent).toHaveCount(6);

    const nestedFolder = await openComponentLibFolder(page, "XGBoost");

    const nestedFolderContent =
      await nestedFolder.getByTestId("component-item");
    expect(await nestedFolderContent).toHaveCount(4);
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
    expect(await favoritesFolder.locator("li")).toHaveCount(1);

    // unstar the component
    await chicagoTaxiTripsDataset.getByTestId("favorite-star").click();

    // giving time for the component to be removed from the favorites folder
    // todo: find a better way to do this
    await page.waitForTimeout(200);

    // expect the component to be removed from the favorites folder
    expect(await favoritesFolder.locator("li")).toHaveCount(0);
  });

  test("component details can be opened as a dialog", async () => {
    // drop component on the canvas
    await openComponentLibFolder(page, "Standard library");
    const quickStartFolder = await openComponentLibFolder(page, "Quick start");
    const chicagoTaxiTripsDataset = await locateComponentInFolder(
      quickStartFolder,
      "Chicago Taxi Trips dataset",
    );

    await chicagoTaxiTripsDataset.getByTestId("info-icon-button").click();

    await page.waitForTimeout(200);

    const dialogHeader = await page.locator('[data-slot="dialog-header"]');
    expect(dialogHeader).toBeVisible();

    expect(dialogHeader).toHaveText("Chicago Taxi Trips dataset");

    await page.locator('button[data-slot="dialog-close"]').click();

    await page.waitForTimeout(200);
  });

  test("components can be dragged to the canvas and appear in the used in pipeline folder", async () => {
    // drop component on the canvas
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
    expect(await usedOnCanvasFolder.locator("li")).toHaveCount(1);

    // remove the component from the canvas
    await removeComponentFromCanvas(page, "Chicago Taxi Trips dataset");
    expect(await usedOnCanvasFolder.locator("li")).toHaveCount(0);
  });

  test("library can be searched", async () => {
    // search for a component
    await page.getByTestId("search-input").fill("GCS");

    await page.waitForTimeout(200);

    const searchResultsHeader = await page.getByTestId("search-results-header");
    expect(await searchResultsHeader.isVisible()).toBe(true);
    expect(await searchResultsHeader).toHaveText("Search Results (3)");
    const componentItem = await page.getByTestId("component-item");
    expect(componentItem).toHaveCount(3);

    await page.getByTestId("search-input").clear();

    await page.waitForTimeout(200);
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

    assertSearchState(page, {
      searchTerm: "CSV",
      searchFilterCount: "2",
      searchResultsCount: "*",
    });

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

    // assert search inputs
    assertSearchState(page, {
      searchTerm: "CSV",
      searchFilterCount: "2",
      // todo: this can be painful to maintain, find a better way to do this
      searchResultsCount: "*",
    });

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
