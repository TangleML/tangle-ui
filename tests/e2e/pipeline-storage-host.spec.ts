import { expect, type Page, test } from "@playwright/test";

import {
  type HostStorageOptions,
  installPipelineStorageHost,
  readHostReadKeys,
  readHostRecords,
  readLocallyStoredPipelineKeys,
  seedLocallyStoredPipeline,
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
