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
 * @param page - Playwright page object
 * @param deltaX - Horizontal pan distance in pixels (default: 50)
 * @param deltaY - Vertical pan distance in pixels (default: 50)
 * @throws Error if pane bounding box cannot be determined
 */
export async function panCanvas(
  page: Page,
  deltaX: number = 50,
  deltaY: number = 50,
): Promise<void> {
  const pane = locateFlowPane(page);
  const paneBox = await pane.boundingBox();

  if (!paneBox) {
    throw new Error("Unable to locate pane bounding box for canvas panning");
  }

  // TODO: Implement more reliable way to pan that accounts for node positions
  const startX = paneBox.x + paneBox.width * 0.5;
  const startY = paneBox.y + paneBox.height * 0.25;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY);
  await page.mouse.up();
}

/**
 * Clicks the zoom in button if visible
 */
export async function zoomIn(page: Page): Promise<void> {
  const zoomInButton = page.locator(".react-flow__controls-zoomin");
  if (await zoomInButton.isVisible()) {
    await zoomInButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- Allow time for zoom animation to complete before subsequent interactions
    await page.waitForTimeout(200);
  }
}

/**
 * Clicks the zoom out button if visible
 */
export async function zoomOut(page: Page): Promise<void> {
  const zoomOutButton = page.locator(".react-flow__controls-zoomout");
  if (await zoomOutButton.isVisible()) {
    await zoomOutButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- Allow time for zoom animation to complete before subsequent interactions
    await page.waitForTimeout(200);
  }
}

/**
 * Clicks the fit to view button if visible
 */
export async function fitToView(page: Page): Promise<void> {
  const zoomOutButton = page.locator(".react-flow__controls-fitview");
  if (await zoomOutButton.isVisible()) {
    await zoomOutButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- Allow time for zoom animation to complete before subsequent interactions
    await page.waitForTimeout(100);
  }
}

export async function locateFolderByName(
  page: Page,
  folderName: string,
): Promise<Locator> {
  // eslint-disable-next-line playwright/no-wait-for-selector -- Using waitForSelector with extended timeout for slow library loading
  await page.waitForSelector(`[data-folder-name="${folderName}"]`, {
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
  const button = folderContainer.locator(
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
 * @param page - Playwright page object
 * @param panelName - Name of the context panel to wait for
 * @returns The located panel element
 */
export async function waitForContextPanel(
  page: Page,
  panelName: string,
): Promise<Locator> {
  const panel = locateContextPanel(page, panelName);
  await expect(panel).toBeVisible();
  return panel;
}

/**
 * Complete workflow: Add a component from library to canvas
 * @param page - Playwright page object
 * @param folderName - Name of the folder containing the component
 * @param componentName - Name of the component to drop
 * @param dragOptions - Optional drag options (position, etc.)
 * @returns The located node element on the canvas
 */
export async function dropComponentFromLibraryOnCanvas(
  page: Page,
  folderName: string,
  componentName: string,
  dragOptions: DragOptions = {},
): Promise<Locator> {
  const folder = await openComponentLibFolder(page, folderName);
  const component = locateComponentInFolder(folder, componentName);
  await dragComponentToCanvas(page, component, dragOptions);

  return locateNodeByName(page, componentName);
}

/**
 * Removes a component from the canvas
 * @param page - Playwright page object
 * @param componentName - Name of the component to remove
 */
export async function removeComponentFromCanvas(
  page: Page,
  componentName: string,
): Promise<void> {
  const node = locateNodeByName(page, componentName);
  await node.click();
  await node.press("Delete");

  // Wait for confirmation dialog to appear and be interactive
  const confirmDialog = page.locator('[role="alertdialog"]');
  const continueButton = confirmDialog.getByText("Continue");
  await expect(continueButton).toBeVisible();
  await continueButton.click();

  // Wait for the node to be removed from the DOM
  await expect(node).toBeHidden();
}

/**
 * todo: helper to position node relatively to another node accounting for the Canvas transform
 */

/**
 * Asserts the current state of the search functionality
 * @param page - Playwright page object
 * @param options - Search state options to verify
 * @param options.searchTerm - Expected search input value
 * @param options.searchFilterCount - Expected filter count badge text (optional)
 * @param options.searchResultsCount - Expected result count or "*" for any (optional)
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

  // Assert search input value
  const searchInput = page.getByTestId("search-input");
  await expect(searchInput).toHaveValue(searchTerm);

  // Assert search filter counter
  const searchFilterCounter = page.getByTestId("search-filter-counter");
  if (searchFilterCount) {
    await expect(searchFilterCounter).toHaveText(searchFilterCount);
  } else {
    await expect(searchFilterCounter).toBeHidden();
  }

  // Assert search results header and count
  const searchResultsHeader = page.getByTestId("search-results-header");
  if (searchResultsCount && Number(searchResultsCount) > 0) {
    await expect(searchResultsHeader).toHaveText(
      `Search Results (${searchResultsCount})`,
    );
    const componentItem = page.getByTestId("component-item");
    await expect(componentItem).toHaveCount(Number(searchResultsCount));
  } else if (searchResultsCount && searchResultsCount === "*") {
    await expect(searchResultsHeader).toBeVisible();
    await expect(searchResultsHeader).toContainText("Search Results");
  } else {
    await expect(searchResultsHeader).toBeHidden();
  }
}
