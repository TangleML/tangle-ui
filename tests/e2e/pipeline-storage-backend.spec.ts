import { expect, type Page, test } from "@playwright/test";

import {
  type BackendStorageOptions,
  forgetBackendReadKeys,
  installPipelineStorageBackend,
  readBackendReadKeys,
  readBackendRecords,
  readLocallyStoredPipelineKeys,
  seedLocallyStoredPipeline,
  setBackendFailMode,
} from "./fixtures/pipelineStorageBackend";

const CHURN_TAG = "quarterly";

const SEED = [
  {
    key: "0f8c1a2b-0000-4000-8000-000000000001",
    displayName: "Churn model",
    spec: {
      name: "Churn model",
      metadata: { annotations: { tags: CHURN_TAG } },
      implementation: { graph: { tasks: {} } },
    },
  },
  {
    key: "0f8c1a2b-0000-4000-8000-000000000002",
    displayName: "Nightly refresh",
    spec: { name: "Nightly refresh", implementation: { graph: { tasks: {} } } },
  },
];

async function installSeededBackend(
  page: Page,
  options: BackendStorageOptions = {},
) {
  await page.addInitScript(() => {
    window.localStorage.setItem("seen-editor-v2-welcome", JSON.stringify(true));
  });

  await installPipelineStorageBackend(page, { seed: SEED, ...options });
}

test.describe("backend pipeline storage", () => {
  test("lists what the host holds", async ({ page }) => {
    await installSeededBackend(page);

    await page.goto("/pipeline-folders");

    await expect(page.getByText("Churn model")).toBeVisible();
    await expect(page.getByText("Nightly refresh")).toBeVisible();
  });

  test("offers nothing to file pipelines into a store that has no folders", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto("/pipeline-folders");
    await expect(page.getByText("Churn model")).toBeVisible();

    await expect(
      page.getByRole("button", { name: /new folder/i }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: /connect folder/i }),
    ).toBeHidden();
  });

  test("keeps the pipeline table at /pipelines, contents and all", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto("/pipelines");

    await expect(page.getByText("Churn model")).toBeVisible();
    await expect(page.getByText("Nightly refresh")).toBeVisible();
    await expect(page.getByText(CHURN_TAG)).toBeVisible();
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible();
  });

  test("reads each pipeline once and serves the next visit from cache", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto("/pipelines");
    await expect(page.getByText(CHURN_TAG)).toBeVisible();
    expect([...readBackendReadKeys(page)].sort()).toEqual(
      SEED.map((entry) => entry.key).sort(),
    );

    forgetBackendReadKeys(page);
    await page.reload();
    await expect(page.getByText(CHURN_TAG)).toBeVisible();
    expect(readBackendReadKeys(page)).toEqual([]);
  });

  test("copies pipelines already in the browser into the backend", async ({
    page,
  }) => {
    const localName = "Left behind in the browser";

    await installSeededBackend(page);
    await page.goto("/");
    await seedLocallyStoredPipeline(page, localName);

    await page.goto("/pipelines");

    await expect(page.getByText(localName)).toBeVisible();
    await expect(page.getByText("Churn model")).toBeVisible();

    expect(
      readBackendRecords(page).map((record) => record.displayName),
    ).toContain(localName);
  });

  test("copies them even when the pipeline list is never opened", async ({
    page,
  }) => {
    const localName = "Never opened the list";

    await installSeededBackend(page);
    await page.goto("/");
    await seedLocallyStoredPipeline(page, localName);

    await page.goto("/pipeline-folders");
    await expect(page.getByText("Churn model")).toBeVisible();

    await expect
      .poll(
        async () =>
          readBackendRecords(page).map((record) => record.displayName),
        { timeout: 15_000 },
      )
      .toContain(localName);
  });

  test("opens a pipeline at a url that is only its id", async ({ page }) => {
    await installSeededBackend(page);

    await page.goto("/pipelines");
    await page.getByText("Churn model").click();

    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    const url = new URL(page.url());
    const [record] = readBackendRecords(page).filter(
      (entry) => entry.displayName === "Churn model",
    );
    expect(url.pathname).toBe(`/editor-v2/${record.externalId}`);
    expect(url.search).toBe("");
  });

  test("says a link to a pipeline it does not hold cannot be opened", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto("/editor-v2/0f8c1a2b-0000-4000-8000-00000000dead");

    await expect(page.getByTestId("pipeline-storage-error")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/could not be opened/i)).toBeVisible();
  });

  test("keeps the browser's own pipeline store empty", async ({ page }) => {
    await installSeededBackend(page);

    await page.goto("/pipeline-folders");
    await expect(page.getByText("Churn model")).toBeVisible();

    expect(await readLocallyStoredPipelineKeys(page)).toEqual([]);
    expect(readBackendRecords(page)).toHaveLength(SEED.length);
  });

  test("writes nothing locally when the backend cannot be reached", async ({
    page,
  }) => {
    await installSeededBackend(page, { failMode: "unavailable" });

    await page.goto("/pipeline-folders");

    await expect(page.getByText("Churn model")).toBeHidden();
    expect(await readLocallyStoredPipelineKeys(page)).toEqual([]);
  });

  test("creates a new pipeline in the backend and nowhere else", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto("/pipeline-folders");
    await expect(page.getByText("Churn model")).toBeVisible();

    await page.getByTestId("new-pipeline-button").click();
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    expect(readBackendRecords(page)).toHaveLength(SEED.length + 1);
    expect(await readLocallyStoredPipelineKeys(page)).toEqual([]);
  });

  test("renaming keeps one pipeline rather than leaving the old name behind", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto(`/editor-v2/${SEED[0].key}`);
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    await page.locator('[data-tracking-id$="rename_pipeline"]').click();
    await page.getByRole("textbox").fill("Churn model v2");
    await page.getByRole("button", { name: "Rename" }).click();

    await expect
      .poll(async () =>
        readBackendRecords(page).map((record) => record.displayName),
      )
      .toEqual(["Churn model v2", "Nightly refresh"]);
  });

  test("says the backend is not available, even holding a listing it could show", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto("/pipelines");
    await expect(page.getByText("Churn model")).toBeVisible();

    // Not a reload: the listing is already in hand and would otherwise render.
    setBackendFailMode(page, "unavailable");
    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.getByTestId("info-box-warning")).toContainText(
      "Backend not available",
    );
    await expect(page.getByText("Churn model")).toBeHidden();
  });

  test("says the backend is not available on the folders page too", async ({
    page,
  }) => {
    await installSeededBackend(page, { failMode: "unavailable" });

    await page.goto("/pipeline-folders");

    await expect(page.getByTestId("info-box-warning")).toContainText(
      "Backend not available",
    );
  });

  test("says a store that refuses could not be read, not that it is empty", async ({
    page,
  }) => {
    await installSeededBackend(page, { failMode: "unauthenticated" });

    await page.goto("/pipelines");

    await expect(page.getByTestId("pipeline-storage-error")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/don't have any pipelines yet/i)).toBeHidden();
  });

  test("shows auto-save as off in the editor while the backend is away", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto(`/editor-v2/${SEED[0].key}`);
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    const indicator = page.getByTestId("auto-save-button");
    await expect(indicator).toBeEnabled();

    setBackendFailMode(page, "unavailable");
    await indicator.click();

    await expect(indicator).toBeDisabled();
    await expect(indicator.locator(".text-destructive")).toBeVisible();

    // Comes back on its own: the held edit is retried and the store answers.
    setBackendFailMode(page, "none");
    await expect(indicator).toBeEnabled({ timeout: 30_000 });
    await expect(indicator.locator(".text-destructive")).toBeHidden();
  });

  test("turns auto-save red in an open editor nobody is touching", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto(`/editor-v2/${SEED[0].key}`);
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    const indicator = page.getByTestId("auto-save-button");
    await expect(indicator).toBeEnabled();

    // No edit, no click: the page has to notice on its own.
    setBackendFailMode(page, "unavailable");

    await expect(indicator).toBeDisabled({ timeout: 60_000 });
    await expect(indicator.locator(".text-destructive")).toBeVisible();
  });

  test("says so in the editor when a save is refused, and stops once it lands", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto(`/editor-v2/${SEED[0].key}`);
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    setBackendFailMode(page, "unavailable");
    await page.getByTestId("auto-save-button").click();

    const banner = page.getByTestId("unsaved-work-banner");
    await expect(banner).toBeVisible();
    // Carries what the backend said, not a message invented here.
    await expect(banner).toContainText("unavailable");

    setBackendFailMode(page, "none");
    await banner.getByRole("button", { name: "Try now" }).click();

    await expect(banner).toBeHidden();
  });

  test("offers a copy before asking for a sign-in that would discard it", async ({
    page,
  }) => {
    await installSeededBackend(page);

    await page.goto(`/editor-v2/${SEED[0].key}`);
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    setBackendFailMode(page, "unauthenticated");
    await page.getByTestId("auto-save-button").click();

    const dialog = page.getByTestId("expired-session");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Download a copy" }),
    ).toBeVisible();
  });

  test("a deleted pipeline does not come back on reload", async ({ page }) => {
    await installSeededBackend(page);

    await page.goto("/pipeline-folders");
    const row = page.getByRole("row").filter({ hasText: "Churn model" });
    await row.locator("[data-checkbox]").click();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Churn model")).toBeHidden();

    await page.reload();
    await expect(page.getByText("Nightly refresh")).toBeVisible();
    await expect(page.getByText("Churn model")).toBeHidden();

    expect(readBackendRecords(page)).toHaveLength(SEED.length - 1);
  });
});
