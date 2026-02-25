import { expect, type Locator, type Page, test } from "@playwright/test";

import {
  createNewPipeline,
  dropComponentFromLibraryOnCanvas,
  fitToView,
  openComponentLibFolder,
  panCanvas,
  waitForContextPanel,
} from "./helpers";

const CHICAGO_TAXI_COMPONENT = "Chicago Taxi Trips dataset";
const XGBOOST_COMPONENT = "Train XGBoost model on CSV";

function locateTaskNode(page: Page, taskName: string): Locator {
  return page.locator(`[data-testid="rf__node-task_${taskName}"]`);
}

async function assertValidationState(
  page: Page,
  expectedTitle: string,
): Promise<void> {
  await page.keyboard.press("Escape");
  await waitForContextPanel(page, "pipeline-details");
  await expect(
    page.getByTestId("info-box-title"),
    `Validation should show "${expectedTitle}"`,
  ).toHaveText(expectedTitle);
}

test.describe.configure({ mode: "serial" });

test.describe("Pipeline Validation UI", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await createNewPipeline(page);
    await openComponentLibFolder(page, "Standard library");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("shows no validation issues for single component without required inputs", async () => {
    await dropComponentFromLibraryOnCanvas(
      page,
      "Quick start",
      CHICAGO_TAXI_COMPONENT,
    );

    await waitForContextPanel(page, "pipeline-details");

    const validationInfoBox = page.getByTestId("info-box-success");
    await expect(validationInfoBox).toBeVisible();
    await expect(page.getByTestId("info-box-title")).toHaveText(
      "No validation issues found",
    );
  });

  test("shows 2 errors when adding component with missing required inputs", async () => {
    const taxiNode = locateTaskNode(page, CHICAGO_TAXI_COMPONENT);
    const taxiNodeBox = await taxiNode.boundingBox();

    // eslint-disable-next-line playwright/no-conditional-in-test -- Explicit null check for boundingBox() per Playwright best practices
    if (!taxiNodeBox) {
      throw new Error("Unable to get bounding box for Chicago Taxi node");
    }

    await panCanvas(page, -taxiNodeBox.width, 0);

    await dropComponentFromLibraryOnCanvas(
      page,
      "Quick start",
      XGBOOST_COMPONENT,
      {
        targetPosition: { x: taxiNodeBox.width * 1.5, y: taxiNodeBox.y },
      },
    );

    await waitForContextPanel(page, "pipeline-details");

    const validationInfoBox = page.getByTestId("info-box-error");
    await expect(
      validationInfoBox,
      "Validation info box should show errors",
    ).toBeVisible();
    await expect(page.getByTestId("info-box-title")).toHaveText(
      "2 errors detected",
    );
  });

  test("shows expanded view of validation errors", async () => {
    const validationGroup = page.getByTestId("validation-group");
    await expect(validationGroup).toBeVisible();

    const groupTrigger = page.getByTestId("validation-group-trigger");
    await groupTrigger.click();

    const validationIssues = page.getByTestId("validation-issue");
    await expect(validationIssues).toHaveCount(2);

    await expect(validationIssues.first()).toHaveAttribute(
      "data-issue-level",
      "error",
    );
  });

  test("clicking validation error navigates to task on canvas", async () => {
    const xgboostNode = locateTaskNode(page, XGBOOST_COMPONENT);

    const validationIssues = page.getByTestId("validation-issue");
    await validationIssues.first().click();

    await expect(
      xgboostNode,
      "Node should be in viewport after clicking validation issue",
    ).toBeInViewport();
  });

  test("connecting nodes reduces validation errors to 1", async () => {
    await fitToView(page);

    const taxiNode = locateTaskNode(page, CHICAGO_TAXI_COMPONENT);
    const xgboostNode = locateTaskNode(page, XGBOOST_COMPONENT);

    const outputPin = taxiNode.locator('[data-handleid="output_Table"]');
    const inputPin = xgboostNode.locator(
      '[data-handleid="input_training_data"]',
    );

    await expect(outputPin).toBeInViewport();
    await expect(inputPin).toBeInViewport();

    await outputPin.hover();
    await page.mouse.down();
    await inputPin.hover();
    await page.mouse.up();

    const edge = page.locator(
      `[data-testid="rf__edge-${CHICAGO_TAXI_COMPONENT}_Table-${XGBOOST_COMPONENT}_training_data"]`,
    );
    await expect(edge, "Edge should be created after connection").toBeVisible();

    await assertValidationState(page, "1 error detected");
  });

  test("creating input node via CMD+drag changes validation to 1 warning", async () => {
    await fitToView(page);

    const xgboostNode = locateTaskNode(page, XGBOOST_COMPONENT);

    const labelColumnHandle = xgboostNode.locator(
      '[data-handleid="input_label_column_name"]',
    );

    await expect(labelColumnHandle).toBeInViewport();

    const handleBox = await labelColumnHandle.boundingBox();
    // eslint-disable-next-line playwright/no-conditional-in-test -- Explicit null check for boundingBox() per Playwright best practices
    if (!handleBox) {
      throw new Error(
        "Unable to get bounding box for label_column_name handle",
      );
    }

    await page.keyboard.down("Meta");

    await labelColumnHandle.hover();
    await page.mouse.down();

    await page.mouse.move(
      handleBox.x - 150,
      handleBox.y + handleBox.height / 2,
      { steps: 10 },
    );

    await page.mouse.up();

    await page.keyboard.up("Meta");

    const inputNode = page.getByTestId("io-node-input-label_column_name");
    await expect(
      inputNode,
      "Input node should be created for label_column_name",
    ).toBeVisible();

    await assertValidationState(page, "1 warning detected");
  });

  test("setting input value resolves all validation issues", async () => {
    const inputNode = page.getByTestId("io-node-input-label_column_name");
    await inputNode.click();

    const inputValueField = page.getByTestId("input-value-field");
    await expect(
      inputValueField,
      "Input value editor should appear in context panel",
    ).toBeVisible();

    await inputValueField.fill("tips");
    await inputValueField.blur();

    await assertValidationState(page, "No validation issues found");
  });
});
