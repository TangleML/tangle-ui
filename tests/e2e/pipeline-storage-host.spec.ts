import { expect, test } from "@playwright/test";

import {
  type HostStorageOptions,
  installPipelineStorageHost,
  readHostRecords,
  readLocallyStoredPipelineKeys,
} from "./fixtures/pipelineStorageHost";

const LABEL = "Shared storage";

const SEED = [
  {
    key: "0f8c1a2b-0000-4000-8000-000000000001",
    displayName: "Churn model",
    spec: { name: "Churn model", implementation: { graph: { tasks: {} } } },
  },
  {
    key: "0f8c1a2b-0000-4000-8000-000000000002",
    displayName: "Nightly refresh",
    spec: { name: "Nightly refresh", implementation: { graph: { tasks: {} } } },
  },
];

async function installSeededHost(
  page: Parameters<typeof installPipelineStorageHost>[0],
  options: HostStorageOptions = {},
) {
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
