import { expect, type Page, test } from "@playwright/test";

import { addSecret, navigateToSecretsList, removeSecret } from "./helpers";

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
    await navigateToSecretsList(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("verifies empty state when no secrets exist", async () => {
    const emptyState = page.getByTestId("secrets-empty-state");
    await expect(
      emptyState,
      "Empty state should be visible when no secrets exist",
    ).toBeVisible();
    await expect(emptyState).toContainText("No secrets configured");

    const addSecretLink = page.getByTestId("add-secret-link");
    await expect(
      addSecretLink,
      "Add Secret link should be visible in list view",
    ).toBeVisible();
  });

  test("adds a new secret and removes it", async () => {
    const testSecretName = "TEST_API_KEY";
    const testSecretValue = "super-secret-value-123";

    await addSecret(page, testSecretName, testSecretValue);

    const secretItem = page.locator(
      `[data-testid="secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Newly added secret should appear in the list",
    ).toBeVisible();
    await expect(secretItem).toContainText(testSecretName);

    await removeSecret(page, testSecretName);

    await expect(
      page.getByTestId("secrets-empty-state"),
      "Empty state should reappear after last secret is deleted",
    ).toBeVisible();
  });

  test("replaces an existing secret value", async () => {
    const testSecretName = "REPLACE_TEST_SECRET";
    const initialValue = "initial-value";
    const replacedValue = "replaced-value";

    await addSecret(page, testSecretName, initialValue);

    const secretItem = page.locator(
      `[data-testid="secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Secret should appear in list after creation",
    ).toBeVisible();

    await secretItem.getByTestId("secret-edit-button").click();

    const replaceBreadcrumb = page.getByRole("navigation", {
      name: "breadcrumb",
    });
    await expect(
      replaceBreadcrumb.getByText("Replace Secret"),
      "Breadcrumb should show Replace Secret",
    ).toBeVisible();

    const nameInput = page.getByTestId("secret-name-input");
    await expect(
      nameInput,
      "Name input should be disabled when replacing a secret",
    ).toBeDisabled();
    await expect(nameInput).toHaveValue(testSecretName);

    await page.getByTestId("secret-value-input").fill(replacedValue);
    await page.getByTestId("update-secret-submit-button").click();

    await expect(
      page.getByRole("heading", { name: "Secrets Management" }),
      "Should navigate back to list after replacing",
    ).toBeVisible();
    await expect(
      secretItem,
      "Secret should remain visible after value update",
    ).toBeVisible();

    await removeSecret(page, testSecretName);
  });

  test("removes a secret from the list", async () => {
    const testSecretName = "DELETE_TEST_SECRET";
    const testSecretValue = "delete-me";

    await addSecret(page, testSecretName, testSecretValue);

    const secretItem = page.locator(
      `[data-testid="secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Secret should appear in list after creation",
    ).toBeVisible();

    await removeSecret(page, testSecretName);

    await expect(
      secretItem,
      "Deleted secret should no longer appear in the list",
    ).toBeHidden();
  });

  test("cancels adding a secret and returns to list", async () => {
    await page.getByTestId("add-secret-link").click();

    const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
    await expect(
      breadcrumb.getByText("Add Secret"),
      "Breadcrumb should show Add Secret",
    ).toBeVisible();

    await page.getByTestId("secret-form-cancel-button").click();

    await expect(
      page.getByRole("heading", { name: "Secrets Management" }),
      "Should return to list view after cancel",
    ).toBeVisible();
    await expect(page.getByTestId("add-secret-link")).toBeVisible();
  });

  test("cancels replacing a secret and returns to list", async () => {
    const testSecretName = "CANCEL_REPLACE_TEST";
    const testSecretValue = "cancel-test-value";

    await addSecret(page, testSecretName, testSecretValue);

    const secretItem = page.locator(
      `[data-testid="secret-item"][data-secret-name="${testSecretName}"]`,
    );
    await expect(
      secretItem,
      "Secret should appear in list after creation",
    ).toBeVisible();
    await secretItem.getByTestId("secret-edit-button").click();

    const cancelReplaceBreadcrumb = page.getByRole("navigation", {
      name: "breadcrumb",
    });
    await expect(
      cancelReplaceBreadcrumb.getByText("Replace Secret"),
      "Breadcrumb should show Replace Secret",
    ).toBeVisible();

    await page.getByTestId("secret-form-cancel-button").click();

    await expect(
      page.getByRole("heading", { name: "Secrets Management" }),
      "Should return to list view after cancel",
    ).toBeVisible();
    await expect(
      secretItem,
      "Secret should still be visible after canceling replace",
    ).toBeVisible();

    await removeSecret(page, testSecretName);
  });
});
