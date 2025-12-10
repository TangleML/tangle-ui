import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Creates a new pipeline by navigating to home and clicking the new pipeline button
 */
export async function createNewPipeline(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("new-pipeline-button").click();
  await locateFlowViewport(page);
}

/**
 * Locates the main React Flow canvas wrapper
 */
export function locateFlowCanvas(page: Page): Locator {
  return page.locator('[data-testid="rf__wrapper"]');
}

/**
 * Locates the React Flow viewport
 */
export function locateFlowViewport(page: Page): Locator {
  return page.locator(".react-flow__viewport");
}

/**
 * Locates the React Flow pane (for canvas interactions)
 */
function locateFlowPane(page: Page): Locator {
  return page.locator(".react-flow__pane");
}

/**
 * Clicks on the canvas at the specified position
 */
export async function clickOnCanvas(
  page: Page,
  x: number = 400,
  y: number = 300,
): Promise<void> {
  await locateFlowPane(page).click({ position: { x, y } });
}

/**
 * Performs a pan gesture on the canvas
 */
export async function panCanvas(
  page: Page,
  deltaX: number = 50,
  deltaY: number = 50,
): Promise<void> {
  const pane = locateFlowPane(page);
  const paneBox = await pane.boundingBox();

  if (paneBox) {
    await page.mouse.move(
      paneBox!.x + paneBox!.width * 0.5,
      // we need to avoid pointing on a node
      // todo: figure out more reliable way to pan
      paneBox!.y + paneBox!.height * 0.25,
    );
    await page.mouse.down();
    // Move pane by 100, 100
    await page.mouse.move(
      paneBox!.x + paneBox!.width * 0.5 + deltaX,
      paneBox!.y + paneBox!.height * 0.25 + deltaY,
    );
    await page.mouse.up();
  }
}

/**
 * Clicks the zoom in button if visible
 */
export async function zoomIn(page: Page): Promise<void> {
  const zoomInButton = page.locator(".react-flow__controls-zoomin");
  if (await zoomInButton.isVisible()) {
    await zoomInButton.click();
    await page.waitForTimeout(200); // Wait for zoom animation
  }
}

/**
 * Clicks the zoom out button if visible
 */
export async function zoomOut(page: Page): Promise<void> {
  const zoomOutButton = page.locator(".react-flow__controls-zoomout");
  if (await zoomOutButton.isVisible()) {
    await zoomOutButton.click();
    await page.waitForTimeout(200); // Wait for zoom animation
  }
}

/**
 * Clicks the fit to view button if visible
 */
export async function fitToView(page: Page): Promise<void> {
  const zoomOutButton = page.locator(".react-flow__controls-fitview");
  if (await zoomOutButton.isVisible()) {
    await zoomOutButton.click();
    await page.waitForTimeout(100);
  }
}

export async function locateFolderByName(
  page: Page,
  folderName: string,
): Promise<Locator> {
  await page.waitForSelector(`[data-folder-name="${folderName}"]`, {
    // loading the library can take a while
    timeout: 25000,
  });
  return page.locator(`[data-folder-name="${folderName}"]`);
}

/**
 * Opens a component library folder by name
 */
export async function openComponentLibFolder(
  page: Page,
  folderName: string,
): Promise<Locator> {
  const folderContainer = await locateFolderByName(page, folderName);
  const button = await folderContainer.locator(
    `[aria-label="Folder: ${folderName}"][role="button"]`,
  );

  if ((await button.getAttribute("aria-expanded")) === "false") {
    await button.click();
  }

  return folderContainer;
}

/**
 * Locates a component item within a folder
 */
export function locateComponentInFolder(
  folder: Locator,
  componentName: string,
): Locator {
  return folder.locator(`li:has-text("${componentName}")`);
}

type DragOptions = Parameters<Locator["dragTo"]>[1];

/**
 * Drags a component from the library to the canvas
 */
export async function dragComponentToCanvas(
  page: Page,
  component: Locator,
  dragOptions: DragOptions = {},
): Promise<void> {
  const canvas = locateFlowCanvas(page);
  await component.dragTo(canvas, dragOptions);
}

/**
 * Node Interaction Helpers
 */

/**
 * Locates a task node by its name
 */
function locateNodeByName(page: Page, nodeName: string): Locator {
  return page.locator(`[data-testid="rf__node-task_${nodeName}"]`);
}

/**
 * Context Panel Helpers
 */

/**
 * Locates the context panel container
 */
function locateContextPanelContainer(page: Page): Locator {
  return page.locator('[data-testid="context-panel-container"]');
}

/**
 * Locates a specific context panel by name
 */
function locateContextPanel(page: Page, panelName: string): Locator {
  const container = locateContextPanelContainer(page);
  return container.locator(`[data-context-panel="${panelName}"]`);
}

/**
 * Waits for a context panel to be visible
 */
export async function waitForContextPanel(
  page: Page,
  panelName: string,
): Promise<Locator> {
  const panel = await locateContextPanel(page, panelName);
  await expect(panel).toBeVisible();
  return panel;
}

/**
 * Complete workflow: Add a component from library to canvas
 */
export async function dropComponentFromLibraryOnCanvas(
  page: Page,
  folderName: string,
  componentName: string,
  dragOptions: DragOptions = {},
): Promise<Locator> {
  const folder = await openComponentLibFolder(page, folderName);
  const component = await locateComponentInFolder(folder, componentName);
  await dragComponentToCanvas(page, component, dragOptions);

  return await locateNodeByName(page, componentName);
}

/**
 * Removes a component from the canvas
 */
export async function removeComponentFromCanvas(
  page: Page,
  componentName: string,
): Promise<void> {
  const node = await locateNodeByName(page, componentName);
  await node.click();

  await node.press("Delete");

  await page.waitForTimeout(100);

  await page.locator('[role="alertdialog"]').getByText("Continue").click();

  await page.waitForTimeout(100);
}

/**
 * todo: helper to position node relatively to another node accounting for the Canvas transform
 */

export async function assertSearchState(
  page: Page,
  options: {
    searchTerm: string;
    searchFilterCount?: string;
    searchResultsCount?: string;
  } = {
    searchTerm: "",
  },
) {
  const { searchTerm, searchFilterCount, searchResultsCount } = options;

  // assert search inputs
  const searchInput = await page.getByTestId("search-input");
  expect(await searchInput).toHaveValue(searchTerm);

  const searchFilterCounter = await page.getByTestId("search-filter-counter");
  if (searchFilterCount) {
    expect(await searchFilterCounter).toHaveText(searchFilterCount);
  } else {
    expect(await searchFilterCounter).not.toBeVisible();
  }

  const searchResultsHeader = await page.getByTestId("search-results-header");
  if (searchResultsCount && Number(searchResultsCount) > 0) {
    expect(await searchResultsHeader).toHaveText(
      `Search Results (${searchResultsCount})`,
    );
    const componentItem = await page.getByTestId("component-item");
    expect(componentItem).toHaveCount(Number(searchResultsCount));
  } else if (searchResultsCount && searchResultsCount === "*") {
    expect(await searchResultsHeader).toBeVisible();
    expect(await searchResultsHeader.textContent()).toContain("Search Results");
  } else {
    expect(await searchResultsHeader).not.toBeVisible();
  }
}
