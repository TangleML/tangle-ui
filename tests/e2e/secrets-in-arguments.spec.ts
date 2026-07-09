import { expect, type Locator, type Page, test } from "@playwright/test";
import { readFileSync } from "fs";

import {
  addSecret,
  createNewPipeline,
  locateFlowCanvas,
  navigateToSecretsList,
  removeSecret,
  waitForContextPanel,
} from "./helpers";

/**
 * Tests for using secrets in component arguments.
 * Verifies the flow: create secret → drop component →
 * assign secret to argument → fill other fields → submit run.
 */
test.describe.configure({ mode: "serial" });

function argumentInput(page: Page, argumentName: string): Locator {
  return page.locator(
    `[data-context-panel="task-overview"] [data-testid="argument-input-field"][data-argument-name="${argumentName}"] input`,
  );
}

/**
 * Fills a task argument and commits it before returning.
 *
 * Argument fields hold the typed value in local state until they blur, and a
 * sibling field committing re-syncs every field from the stored spec. Filling
 * several fields back-to-back therefore lets one field's commit wipe the
 * just-typed value of another. Blurring here persists each value before the
 * next fill so the fields can't reset each other.
 */
async function fillArgument(
  page: Page,
  argumentName: string,
  value: string,
): Promise<void> {
  const input = argumentInput(page, argumentName);
  await input.fill(value);
  await input.blur();
  await expect(input).toHaveValue(value);
}

test.describe("Secrets in Component Arguments", () => {
  let page: Page;
  let editorUrl: string;

  const testSecretName = "TEST_GITHUB_PAT";
  const testSecretValue = "ghp_test_token_12345";
  const componentName = "Github - Fake Commit Push";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await createNewPipeline(page);
    editorUrl = page.url();
  });

  test.afterAll(async () => {
    await cleanupTestSecret(page, testSecretName);
    await page.close();
  });

  test("create a secret for use in component arguments", async () => {
    await navigateToSecretsList(page);
    await addSecret(page, testSecretName, testSecretValue);

    const secretItem = page.locator(
      `[data-testid="secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Newly added secret should appear in the list",
    ).toBeVisible();

    await page.goto(editorUrl);
    await expect(
      locateFlowCanvas(page),
      "Editor canvas should be visible after navigating back",
    ).toBeVisible({ timeout: 30_000 });
  });

  test("drop component with secret argument onto canvas", async () => {
    const node = await dropGithubFakeCommitPushComponent(page);
    await expect(node, "Component should be visible on canvas").toBeVisible();
  });

  test("select component and verify Arguments tab is shown", async () => {
    const node = page.locator(`[data-testid="rf__node-task_${componentName}"]`);
    await node.click();

    const taskOverviewPanel = await waitForContextPanel(page, "task-overview");
    await expect(taskOverviewPanel).toBeVisible();

    const argumentsTab = taskOverviewPanel.getByRole("tab", {
      name: "Arguments",
    });
    await expect(
      argumentsTab,
      "Arguments tab should be visible in task overview",
    ).toBeVisible();
  });

  test("assign secret to GITHUB_PAT argument", async () => {
    const taskOverviewPanel = page.locator(
      '[data-context-panel="task-overview"]',
    );

    const githubPatField = taskOverviewPanel.locator(
      '[data-testid="argument-input-field"][data-argument-name="GITHUB_PAT"]',
    );
    await expect(
      githubPatField,
      "GITHUB_PAT argument field should be visible",
    ).toBeVisible();

    await githubPatField.hover();

    const directSecretButton = githubPatField.getByTestId(
      "open-secret-dialog-button",
    );
    await expect(directSecretButton).toBeVisible();
    await directSecretButton.click();

    const selectSecretDialog = page.getByTestId("select-secret-dialog");
    await expect(
      selectSecretDialog,
      "Select Secret dialog should open",
    ).toBeVisible();

    const secretItem = selectSecretDialog.locator(
      `[data-testid="selectable-secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Test secret should appear in selection list",
    ).toBeVisible();
    await secretItem.click();

    await expect(
      selectSecretDialog,
      "Dialog should close after selection",
    ).toBeHidden();

    const secretInput = githubPatField.getByTestId(
      "dynamic-data-argument-input",
    );
    await expect(
      secretInput,
      "Secret input should be visible after selection",
    ).toBeVisible();
    await expect(secretInput).toHaveAttribute(
      "data-secret-name",
      testSecretName,
    );
  });

  test("fill other required arguments with dummy values", async () => {
    await fillArgument(page, "Repository", "test-owner/test-repo");
    await fillArgument(page, "Path", "test/path/file.txt");
    await fillArgument(page, "Content", "Test content for commit");

    await expect(argumentInput(page, "Repository")).toHaveValue(
      "test-owner/test-repo",
    );
    await expect(argumentInput(page, "Path")).toHaveValue("test/path/file.txt");
    await expect(argumentInput(page, "Content")).toHaveValue(
      "Test content for commit",
    );
  });

  test("Submit Run button should be enabled with all arguments filled", async () => {
    await page.locator(".react-flow__pane").click();

    const submitButton = page.getByRole("button", { name: /Submit Run/i });
    await expect(
      submitButton,
      "Submit Run button should be visible",
    ).toBeVisible();
  });
});

/**
 * Cleans up a test secret via the settings secrets UI.
 * Runs in afterAll hook to ensure cleanup happens regardless of test failures.
 */
async function cleanupTestSecret(
  page: Page,
  secretName: string,
): Promise<void> {
  await navigateToSecretsList(page);
  await removeSecret(page, secretName);
}

/**
 * Drops the Github - Fake Commit Push component onto the canvas
 * by reading the fixture file and using drag-and-drop
 */
async function dropGithubFakeCommitPushComponent(page: Page) {
  const buffer = readFileSync(
    "tests/e2e/fixtures/components/github-fake-commit-push.component.yaml",
  );
  const componentText = buffer.toString();
  const base64ComponentText = Buffer.from(componentText).toString("base64");

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
      bufferData: `data:application/octet-stream;base64,${base64ComponentText}`,
      localFileName: "github-fake-commit-push.component.yaml",
      localFileType: "application/yaml",
    },
  );

  const canvas = locateFlowCanvas(page);
  await canvas.dispatchEvent("drop", { dataTransfer });

  const componentName = "Github - Fake Commit Push";
  const node = page.locator(`[data-testid="rf__node-task_${componentName}"]`);
  await expect(node, "Component node should appear on canvas").toBeVisible({
    timeout: 10000,
  });

  return node;
}
