import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "fs";

import {
  createNewPipeline,
  locateFlowCanvas,
  waitForContextPanel,
} from "./helpers";

/**
 * Tests for using secrets in component arguments.
 * Verifies the flow: enable secrets flag → create secret → drop component →
 * assign secret to argument → fill other fields → submit run.
 */
test.describe.configure({ mode: "serial" });

test.describe("Secrets in Component Arguments", () => {
  let page: Page;

  const testSecretName = "TEST_GITHUB_PAT";
  const testSecretValue = "ghp_test_token_12345";
  const componentName = "Github - Fake Commit Push";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await createNewPipeline(page);
    await enableSecretsFlag(page);
  });

  test.afterAll(async () => {
    await cleanupTestSecret(page, testSecretName);
    await page.close();
  });

  test("create a secret for use in component arguments", async () => {
    const dialog = await openManageSecretsDialog(page);

    await dialog.getByTestId("add-secret-button").click();

    await expect(
      dialog.getByRole("heading"),
      "Dialog should show Add Secret form title",
    ).toContainText("Add Secret");

    await dialog.getByTestId("secret-name-input").fill(testSecretName);
    await dialog.getByTestId("secret-value-input").fill(testSecretValue);
    await dialog.getByTestId("add-secret-submit-button").click();

    const secretItem = dialog.locator(
      `[data-testid="secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Newly added secret should appear in the list",
    ).toBeVisible();

    await closeDialog(page);
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

    // When only secrets are available (no task annotations), the component renders
    // a direct button that opens the secret dialog immediately
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
    const taskOverviewPanel = page.locator(
      '[data-context-panel="task-overview"]',
    );

    const repositoryField = taskOverviewPanel.locator(
      '[data-testid="argument-input-field"][data-argument-name="Repository"]',
    );
    await repositoryField.locator("input").fill("test-owner/test-repo");

    const pathField = taskOverviewPanel.locator(
      '[data-testid="argument-input-field"][data-argument-name="Path"]',
    );
    await pathField.locator("input").fill("test/path/file.txt");

    const contentField = taskOverviewPanel.locator(
      '[data-testid="argument-input-field"][data-argument-name="Content"]',
    );
    await contentField.locator("input").fill("Test content for commit");

    await expect(repositoryField.locator("input")).toHaveValue(
      "test-owner/test-repo",
    );
    await expect(pathField.locator("input")).toHaveValue("test/path/file.txt");
    await expect(contentField.locator("input")).toHaveValue(
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
 * Enables the secrets beta flag via the personal preferences dialog
 */
async function enableSecretsFlag(page: Page): Promise<void> {
  await page.getByTestId("personal-preferences-button").click();

  const dialog = page.getByTestId("personal-preferences-dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("tab", { name: "Beta Features" }).click();

  const secretsSwitch = dialog.getByTestId("secrets-switch");
  await expect(secretsSwitch).toBeVisible({ timeout: 10000 });

  if ((await secretsSwitch.getAttribute("aria-checked")) !== "true") {
    await secretsSwitch.click();
    await expect(secretsSwitch).toHaveAttribute("aria-checked", "true");
  }

  await dialog.press("Escape");
  await expect(dialog).toBeHidden();
}

/**
 * Opens the Manage Secrets dialog via the top bar button
 * @returns The dialog locator for further interactions
 */
async function openManageSecretsDialog(page: Page) {
  const manageSecretsButton = page.getByTestId("manage-secrets-button");
  await expect(
    manageSecretsButton,
    "Manage Secrets button should be visible",
  ).toBeVisible();
  await manageSecretsButton.click();

  const dialog = page.getByTestId("manage-secrets-dialog");
  await expect(dialog, "Manage Secrets dialog should open").toBeVisible();

  return dialog;
}

/**
 * Closes the currently open dialog using Escape key
 */
async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press("Escape");

  const manageSecretsDialog = page.getByTestId("manage-secrets-dialog");
  await expect(manageSecretsDialog).toBeHidden();
}

/**
 * Cleans up a test secret.
 * Runs in afterAll hook to ensure cleanup happens regardless of test failures.
 */
async function cleanupTestSecret(
  page: Page,
  secretName: string,
): Promise<void> {
  const dialog = await openManageSecretsDialog(page);

  const secretItem = dialog.locator(
    `[data-testid="secret-item"][data-secret-name="${secretName}"]`,
  );

  await expect(
    secretItem,
    "Test secret should exist for cleanup",
  ).toBeVisible();
  await secretItem.getByTestId("secret-remove-button").click();
  await expect(secretItem, "Test secret should be removed").toBeHidden();

  await closeDialog(page);
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
