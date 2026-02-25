import { expect, type Page, test } from "@playwright/test";

import { createNewPipeline } from "./helpers";

/**
 * Due to the serial nature of secrets management (shared state),
 * tests are run in serial mode with a shared page instance.
 *
 * Each test is idempotent - creating and cleaning up its own secrets.
 */
test.describe.configure({ mode: "serial" });

test.describe("Secrets Management", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    await createNewPipeline(page);

    // Enable the secrets beta flag
    await page.getByTestId("personal-preferences-button").click();

    const dialog = page.getByTestId("personal-preferences-dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("tab", { name: "Beta Features" }).click();

    const secretsSwitch = dialog.getByTestId("secrets-switch");
    await expect(secretsSwitch).toBeVisible({ timeout: 10000 });

    // Enable secrets if not already enabled
    if ((await secretsSwitch.getAttribute("aria-checked")) !== "true") {
      await secretsSwitch.click();
      await expect(secretsSwitch).toHaveAttribute("aria-checked", "true");
    }

    // Close dialog
    await dialog.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("Manage Secrets button is visible when flag is enabled", async () => {
    const manageSecretsButton = page.getByTestId("manage-secrets-button");
    await expect(
      manageSecretsButton,
      "Manage Secrets button should be visible when secrets flag is enabled",
    ).toBeVisible();
  });

  test("opens Manage Secrets dialog and verifies empty state", async () => {
    await openManageSecretsDialog(page);

    const dialog = page.getByTestId("manage-secrets-dialog");
    await expect(
      dialog,
      "Dialog should be visible after opening",
    ).toBeVisible();

    // Verify empty state is shown
    const emptyState = dialog.getByTestId("secrets-empty-state");
    await expect(
      emptyState,
      "Empty state should be visible when no secrets exist",
    ).toBeVisible();
    await expect(emptyState).toContainText("No secrets configured");

    // Verify Add Secret button is visible
    const addSecretButton = dialog.getByTestId("add-secret-button");
    await expect(
      addSecretButton,
      "Add Secret button should be visible in list view",
    ).toBeVisible();

    await closeDialog(page);
  });

  test("adds a new secret and removes it", async () => {
    const testSecretName = "TEST_API_KEY";
    const testSecretValue = "super-secret-value-123";

    await openManageSecretsDialog(page);

    const dialog = page.getByTestId("manage-secrets-dialog");

    // Click Add Secret button
    await dialog.getByTestId("add-secret-button").click();

    // Verify form is shown with correct title
    await expect(
      dialog.getByRole("heading"),
      "Dialog should show Add Secret form title",
    ).toContainText("Add Secret");

    // Fill in the secret form
    await dialog.getByTestId("secret-name-input").fill(testSecretName);
    await dialog.getByTestId("secret-value-input").fill(testSecretValue);

    // Submit the form
    await dialog.getByTestId("add-secret-submit-button").click();

    // Verify we're back to list view with the secret visible
    const secretItem = dialog.locator(
      `[data-testid="secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Newly added secret should appear in the list",
    ).toBeVisible();
    await expect(secretItem).toContainText(testSecretName);

    // Clean up: Remove the secret
    await secretItem.getByTestId("secret-remove-button").click();

    // Verify secret is removed and empty state is shown
    await expect(
      secretItem,
      "Secret should be removed from list after deletion",
    ).toBeHidden();
    await expect(
      dialog.getByTestId("secrets-empty-state"),
      "Empty state should reappear after last secret is deleted",
    ).toBeVisible();

    await closeDialog(page);
  });

  test("replaces an existing secret value", async () => {
    const testSecretName = "REPLACE_TEST_SECRET";
    const initialValue = "initial-value";
    const replacedValue = "replaced-value";

    await openManageSecretsDialog(page);

    const dialog = page.getByTestId("manage-secrets-dialog");

    // First, create a secret to replace
    await dialog.getByTestId("add-secret-button").click();
    await dialog.getByTestId("secret-name-input").fill(testSecretName);
    await dialog.getByTestId("secret-value-input").fill(initialValue);
    await dialog.getByTestId("add-secret-submit-button").click();

    // Wait for the secret to appear in the list
    const secretItem = dialog.locator(
      `[data-testid="secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Secret should appear in list after creation",
    ).toBeVisible();

    // Click the edit button to replace the secret
    await secretItem.getByTestId("secret-edit-button").click();

    // Verify we're in replace mode
    await expect(
      dialog.getByRole("heading"),
      "Dialog should show Replace Secret form title",
    ).toContainText("Replace Secret");

    // The name input should be disabled in replace mode
    const nameInput = dialog.getByTestId("secret-name-input");
    await expect(
      nameInput,
      "Name input should be disabled when replacing a secret",
    ).toBeDisabled();
    await expect(nameInput).toHaveValue(testSecretName);

    // Fill in the new value
    await dialog.getByTestId("secret-value-input").fill(replacedValue);

    // Submit the update
    await dialog.getByTestId("update-secret-submit-button").click();

    // Verify we're back to list view
    await expect(
      secretItem,
      "Secret should remain visible after value update",
    ).toBeVisible();

    // Clean up: Remove the secret
    await secretItem.getByTestId("secret-remove-button").click();
    await expect(
      secretItem,
      "Secret should be removed after cleanup",
    ).toBeHidden();

    await closeDialog(page);
  });

  test("removes a secret from the list", async () => {
    const testSecretName = "DELETE_TEST_SECRET";
    const testSecretValue = "delete-me";

    await openManageSecretsDialog(page);

    const dialog = page.getByTestId("manage-secrets-dialog");

    // Create a secret to delete
    await dialog.getByTestId("add-secret-button").click();
    await dialog.getByTestId("secret-name-input").fill(testSecretName);
    await dialog.getByTestId("secret-value-input").fill(testSecretValue);
    await dialog.getByTestId("add-secret-submit-button").click();

    // Verify the secret is in the list
    const secretItem = dialog.locator(
      `[data-testid="secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Secret should appear in list after creation",
    ).toBeVisible();

    // Remove the secret
    await secretItem.getByTestId("secret-remove-button").click();

    // Verify the secret is removed
    await expect(
      secretItem,
      "Secret should be removed from list after deletion",
    ).toBeHidden();

    // Verify empty state is shown again
    await expect(
      dialog.getByTestId("secrets-empty-state"),
      "Empty state should reappear after last secret is deleted",
    ).toBeVisible();

    await closeDialog(page);
  });

  test("cancels adding a secret and returns to list", async () => {
    await openManageSecretsDialog(page);

    const dialog = page.getByTestId("manage-secrets-dialog");

    // Click Add Secret button
    await dialog.getByTestId("add-secret-button").click();

    // Verify form is shown
    await expect(
      dialog.getByRole("heading"),
      "Dialog should show Add Secret form",
    ).toContainText("Add Secret");

    // Click Cancel button
    await dialog.getByTestId("secret-form-cancel-button").click();

    // Verify we're back to list view
    await expect(
      dialog.getByRole("heading"),
      "Dialog should return to list view after cancel",
    ).toContainText("Manage Secrets");
    await expect(dialog.getByTestId("add-secret-button")).toBeVisible();

    await closeDialog(page);
  });

  test("cancels replacing a secret and returns to list", async () => {
    const testSecretName = "CANCEL_REPLACE_TEST";
    const testSecretValue = "cancel-test-value";

    await openManageSecretsDialog(page);

    const dialog = page.getByTestId("manage-secrets-dialog");

    // Create a secret
    await dialog.getByTestId("add-secret-button").click();
    await dialog.getByTestId("secret-name-input").fill(testSecretName);
    await dialog.getByTestId("secret-value-input").fill(testSecretValue);
    await dialog.getByTestId("add-secret-submit-button").click();

    // Click edit to go to replace mode
    const secretItem = dialog.locator(
      `[data-testid="secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Secret should appear in list after creation",
    ).toBeVisible();
    await secretItem.getByTestId("secret-edit-button").click();

    // Verify we're in replace mode
    await expect(
      dialog.getByRole("heading"),
      "Dialog should show Replace Secret form",
    ).toContainText("Replace Secret");

    // Cancel the replace
    await dialog.getByTestId("secret-form-cancel-button").click();

    // Verify we're back to list view
    await expect(
      dialog.getByRole("heading"),
      "Dialog should return to list view after cancel",
    ).toContainText("Manage Secrets");
    await expect(
      secretItem,
      "Secret should still be visible after canceling replace",
    ).toBeVisible();

    // Clean up
    await secretItem.getByTestId("secret-remove-button").click();
    await expect(
      secretItem,
      "Secret should be removed after cleanup",
    ).toBeHidden();

    await closeDialog(page);
  });
});

/**
 * Opens the Manage Secrets dialog via the top bar button
 * @param page - Playwright page object
 * @throws Error if button is not visible or dialog fails to open
 */
async function openManageSecretsDialog(page: Page): Promise<void> {
  const manageSecretsButton = page.getByTestId("manage-secrets-button");
  await expect(
    manageSecretsButton,
    "Manage Secrets button should be visible to open dialog",
  ).toBeVisible();
  await manageSecretsButton.click();

  const dialog = page.getByTestId("manage-secrets-dialog");
  await expect(
    dialog,
    "Manage Secrets dialog should open after clicking button",
  ).toBeVisible();
}

/**
 * Closes the currently open dialog using Escape key
 * @param page - Playwright page object
 */
async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  const dialog = page.getByTestId("manage-secrets-dialog");
  await expect(
    dialog,
    "Dialog should close after pressing Escape",
  ).toBeHidden();
}
