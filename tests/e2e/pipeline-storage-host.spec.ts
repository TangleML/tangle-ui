import { expect, type Page, test } from "@playwright/test";

import {
  type HostStorageOptions,
  installPipelineStorageHost,
  readHostReadKeys,
  readHostRecords,
  readLocallyStoredPipelineKeys,
  seedLocallyStoredPipeline,
  setHostFailMode,
} from "./fixtures/pipelineStorageHost";

const LABEL = "Shared storage";

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

async function installSeededHost(page: Page, options: HostStorageOptions = {}) {
  await page.addInitScript(() => {
    window.localStorage.setItem("seen-editor-v2-welcome", JSON.stringify(true));
  });

  await installPipelineStorageHost(page, {
    label: LABEL,
    seed: SEED,
    ...options,
  });
}

test.describe("host-provided pipeline storage", () => {
  test("lists what the host holds", async ({ page }) => {
    await installSeededHost(page);

    await page.goto("/pipeline-folders");

    await expect(page.getByText("Churn model")).toBeVisible();
    await expect(page.getByText("Nightly refresh")).toBeVisible();
  });

  test("offers nothing to file pipelines into a store that has no folders", async ({
    page,
  }) => {
    await installSeededHost(page);

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
    await installSeededHost(page);

    await page.goto("/pipelines");

    await expect(page.getByText("Churn model")).toBeVisible();
    await expect(page.getByText("Nightly refresh")).toBeVisible();
    await expect(page.getByText(CHURN_TAG)).toBeVisible();
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible();
  });

  test("reads each pipeline once and serves the next visit from cache", async ({
    page,
  }) => {
    await installSeededHost(page);

    await page.goto("/pipelines");
    await expect(page.getByText(CHURN_TAG)).toBeVisible();
    expect((await readHostReadKeys(page)).sort()).toEqual(
      SEED.map((entry) => entry.key).sort(),
    );

    await page.reload();
    await expect(page.getByText(CHURN_TAG)).toBeVisible();
    expect(await readHostReadKeys(page)).toEqual([]);
  });

  test("copies pipelines already in the browser into the host", async ({
    page,
  }) => {
    const localName = "Left behind in the browser";

    await installSeededHost(page);
    await page.goto("/");
    await seedLocallyStoredPipeline(page, localName);

    await page.goto("/pipelines");

    await expect(page.getByText(localName)).toBeVisible();
    await expect(page.getByText("Churn model")).toBeVisible();

    expect(
      (await readHostRecords(page)).map((record) => record.displayName),
    ).toContain(localName);
  });

  test("copies them even when the pipeline list is never opened", async ({
    page,
  }) => {
    const localName = "Never opened the list";

    await installSeededHost(page);
    await page.goto("/");
    await seedLocallyStoredPipeline(page, localName);

    await page.goto("/pipeline-folders");
    await expect(page.getByText("Churn model")).toBeVisible();

    await expect
      .poll(
        async () =>
          (await readHostRecords(page)).map((record) => record.displayName),
        { timeout: 15_000 },
      )
      .toContain(localName);
  });

  test("opens a pipeline at a url that is only its id", async ({ page }) => {
    await installSeededHost(page);

    await page.goto("/pipelines");
    await page.getByText("Churn model").click();

    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    const url = new URL(page.url());
    const [record] = (await readHostRecords(page)).filter(
      (entry) => entry.displayName === "Churn model",
    );
    expect(url.pathname).toBe(`/editor-v2/${record.externalId}`);
    expect(url.search).toBe("");
  });

  test("says a link to a pipeline it does not hold cannot be opened", async ({
    page,
  }) => {
    await installSeededHost(page);

    await page.goto("/editor-v2/0f8c1a2b-0000-4000-8000-00000000dead");

    await expect(page.getByTestId("pipeline-storage-error")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/could not be opened/i)).toBeVisible();
  });

  test("keeps the browser's own pipeline store empty", async ({ page }) => {
    await installSeededHost(page);

    await page.goto("/pipeline-folders");
    await expect(page.getByText("Churn model")).toBeVisible();

    expect(await readLocallyStoredPipelineKeys(page)).toEqual([]);
    expect(await readHostRecords(page)).toHaveLength(SEED.length);
  });

  test("writes nothing locally when the host cannot be reached", async ({
    page,
  }) => {
    await installSeededHost(page, { failMode: "unavailable" });

    await page.goto("/pipeline-folders");

    await expect(page.getByText("Churn model")).toBeHidden();
    expect(await readLocallyStoredPipelineKeys(page)).toEqual([]);
  });

  test("creates a new pipeline in the host and nowhere else", async ({
    page,
  }) => {
    await installSeededHost(page);

    await page.goto("/pipeline-folders");
    await expect(page.getByText("Churn model")).toBeVisible();

    await page.getByTestId("new-pipeline-button").click();
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    expect(await readHostRecords(page)).toHaveLength(SEED.length + 1);
    expect(await readLocallyStoredPipelineKeys(page)).toEqual([]);
  });

  test("renaming keeps one pipeline rather than leaving the old name behind", async ({
    page,
  }) => {
    await installSeededHost(page);

    await page.goto(`/editor-v2/${SEED[0].key}`);
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    await page.locator('[data-tracking-id$="rename_pipeline"]').click();
    await page.getByRole("textbox").fill("Churn model v2");
    await page.getByRole("button", { name: "Rename" }).click();

    await expect
      .poll(async () =>
        (await readHostRecords(page)).map((record) => record.displayName),
      )
      .toEqual(["Churn model v2", "Nightly refresh"]);
  });

  test("says the list could not be read rather than showing an empty library", async ({
    page,
  }) => {
    await installSeededHost(page, { failMode: "unavailable" });

    await page.goto("/pipelines");

    await expect(page.getByTestId("pipeline-storage-error")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/don't have any pipelines yet/i)).toBeHidden();
  });

  test("says so in the editor when a save is refused, and stops once it lands", async ({
    page,
  }) => {
    await installSeededHost(page);

    await page.goto(`/editor-v2/${SEED[0].key}`);
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    await setHostFailMode(page, "unavailable");
    await page.getByTestId("auto-save-button").click();

    const banner = page.getByTestId("unsaved-work-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(LABEL);

    await setHostFailMode(page, "none");
    await banner.getByRole("button", { name: "Try now" }).click();

    await expect(banner).toBeHidden();
  });

  test("offers a copy before asking for a sign-in that would discard it", async ({
    page,
  }) => {
    await installSeededHost(page);

    await page.goto(`/editor-v2/${SEED[0].key}`);
    await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible({
      timeout: 30_000,
    });

    await setHostFailMode(page, "unauthenticated");
    await page.getByTestId("auto-save-button").click();

    const dialog = page.getByTestId("expired-session");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Download a copy" }),
    ).toBeVisible();
  });

  test("a deleted pipeline does not come back on reload", async ({ page }) => {
    await installSeededHost(page);

    await page.goto("/pipeline-folders");
    const row = page.getByRole("row").filter({ hasText: "Churn model" });
    await row.locator("[data-checkbox]").click();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Churn model")).toBeHidden();

    await page.reload();
    await expect(page.getByText("Nightly refresh")).toBeVisible();
    await expect(page.getByText("Churn model")).toBeHidden();

    expect(await readHostRecords(page)).toHaveLength(SEED.length - 1);
  });
});
