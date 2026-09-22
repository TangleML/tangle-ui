import { expect, type Page, test } from "@playwright/test";

// These flows require the deployment flag; the default E2E server tests local mode.
test.beforeEach(({ browserName }, testInfo) => {
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(
    browserName !== "chromium" || testInfo.project.name !== "remote-pipelines",
    "Requires a server built with remote pipelines enabled.",
  );
});

const backendUrl = "http://localhost:3001";
const ownerId = "owner-account";
const pipelineId = "00000000-0000-4000-8000-000000000001";
const viewerPipelineId = "00000000-0000-4000-8000-000000000002";

function pipeline(id = pipelineId, userId = ownerId, name = "Remote report") {
  return {
    id,
    user_id: userId,
    file_path: `pipeline-studio/${id}.yaml`,
    pipeline_name: name,
    created_at: "2026-09-18T10:00:00Z",
    updated_at: "2026-09-18T10:00:00Z",
    current_version: "v1",
    version: "v1",
    version_created_at: "2026-09-18T10:00:00Z",
    versioning_mode: "disabled",
    root_pipeline_task: {
      componentRef: {
        spec: {
          name,
          description: "",
          implementation: { graph: { tasks: {} } },
        },
      },
      arguments: {},
    },
    pipeline_run_annotations: {},
  };
}

async function mockBackend(page: Page, initial = [pipeline()]) {
  const state = {
    pipelines: [...initial],
    reads: [] as string[],
    deletes: [] as string[],
    writes: [] as {
      filePath: string;
      body: ReturnType<typeof pipeline>["root_pipeline_task"];
    }[],
    failWrites: false,
  };
  await page.addInitScript(() => {
    localStorage.setItem("seen-editor-v2-welcome", "true");
    localStorage.setItem("betaFlags", JSON.stringify({ v2_editor: true }));
  });
  await page.route("**/services/ping", (route) =>
    route.fulfill({ status: 200, body: "ok" }),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/users/me") {
      return route.fulfill({
        json: {
          id: ownerId,
          permissions: ["read", "write"],
          name: "Pipeline owner",
        },
      });
    }
    if (url.pathname === "/api/users/me/pipelines/all") {
      return route.fulfill({
        json: {
          pipelines: state.pipelines.filter((item) => item.user_id === ownerId),
          next_page_token: null,
        },
      });
    }
    if (url.pathname.startsWith("/api/pipelines/")) {
      state.reads.push(url.pathname);
      const item = state.pipelines.find(
        (item) => item.id === url.pathname.split("/").at(-1),
      );
      return item
        ? route.fulfill({ json: item })
        : route.fulfill({ status: 404, json: { detail: "Not found" } });
    }
    if (
      url.pathname === "/api/users/me/pipelines" &&
      request.method() === "DELETE"
    ) {
      const filePath = url.searchParams.get("file_path");
      if (!filePath)
        return route.fulfill({
          status: 400,
          json: { detail: "Missing file_path" },
        });
      state.deletes.push(filePath);
      state.pipelines = state.pipelines.filter(
        (item) => item.file_path !== filePath,
      );
      return route.fulfill({ status: 204 });
    }
    if (
      url.pathname === "/api/users/me/pipelines" &&
      request.method() === "PUT"
    ) {
      const body = request.postDataJSON();
      const filePath = url.searchParams.get("file_path");
      if (!filePath)
        return route.fulfill({
          status: 400,
          json: { detail: "Missing file_path" },
        });
      state.writes.push({ filePath, body });
      if (state.failWrites)
        return route.fulfill({
          status: 503,
          json: { detail: "Server temporarily unavailable" },
        });
      const previous = state.pipelines.find(
        (item) => item.file_path === filePath,
      );
      const item = {
        ...pipeline(
          previous?.id ?? crypto.randomUUID(),
          ownerId,
          body.root_pipeline_task.componentRef.spec.name,
        ),
        file_path: filePath,
        ...body,
      };
      state.pipelines = [
        ...state.pipelines.filter((entry) => entry.id !== item.id),
        item,
      ];
      return route.fulfill({ json: item });
    }
    return route.fulfill({
      json: {
        items: [],
        components: [],
        pipeline_runs: [],
        next_page_token: null,
      },
    });
  });
  return state;
}

function editorUrl(id: string) {
  return `/editor-v2/${id}`;
}

function legacyEditorUrl(id: string) {
  return `/editor-v2/${encodeURIComponent(`remote:${encodeURIComponent(backendUrl)}:${id}`)}`;
}

async function addLocalPipeline(page: Page, name = "Local report") {
  await page.goto("/pipelines");
  await expect(page.getByTestId("new-pipeline-button").first()).toBeVisible();
  await page.evaluate(async (name) => {
    const storageModule =
      "/src/services/pipelineStorage/PipelineStorageService.ts";
    const { PipelineStorageService } = await import(storageModule);
    await new PipelineStorageService().rootFolder.addFile(
      name,
      `name: ${name}\nimplementation:\n  graph:\n    tasks: {}\n`,
    );
  }, name);
}

async function readLocalBackup(page: Page) {
  return page.evaluate(async () => {
    const componentModule = "/src/utils/componentStore.ts";
    const { getComponentFileFromList } = await import(componentModule);
    return getComponentFileFromList("user_pipelines", "Local report");
  });
}

async function editDescription(page: Page, description: string) {
  await page.getByTestId("pipeline-description-input").fill(description);
  await page.getByTestId("pipeline-description-input").blur();
}

async function expectStorageIcon(page: Page, kind: "local" | "remote") {
  await expect(
    page
      .getByTestId("auto-save-button")
      .locator(kind === "local" ? ".lucide-hard-drive" : ".lucide-cloud"),
  ).toBeVisible();
  await expect(
    page.getByText(/^(Local|Remote)( \(view only\))?$/),
  ).toBeHidden();
}

test("remote mode preserves the original pipeline filters and toolbar", async ({
  page,
}) => {
  await mockBackend(page, [pipeline(pipelineId, ownerId, "Alpha report")]);
  await addLocalPipeline(page, "Browser report");
  await page.reload();
  const remoteRow = page.getByRole("row").filter({ hasText: "Alpha report" });
  const localRow = page.getByRole("row").filter({ hasText: "Browser report" });
  await expect(remoteRow).toBeVisible();
  await expect(page.getByText("Showing 2 of 2 pipelines")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Example Pipelines" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect Folder" }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "New Folder" })).toBeHidden();

  await page.getByPlaceholder("Search...", { exact: true }).fill("Alpha");
  await expect(remoteRow).toBeVisible();
  await expect(localRow).toBeHidden();
  await expect(page.getByText("Showing 1 of 2 pipelines")).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(localRow).toBeVisible();

  await page.getByRole("button", { name: "Last edited range" }).click();
  await expect(page.getByRole("grid").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Name", exact: true }).click();
  await expect(page.getByRole("row").nth(1)).toContainText("Browser report");
  await page.locator("button:has(.lucide-arrow-down-a-z)").click();
  await expect(page.getByRole("row").nth(1)).toContainText("Alpha report");

  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByPlaceholder("Component name...").fill("Missing component");
  await expect(page.getByText("Showing 0 of 2 pipelines")).toBeVisible();
  await page.getByRole("button", { name: "Clear component filter" }).click();
  await expect(page.getByText("Showing 2 of 2 pipelines")).toBeVisible();
});

test("the original list bulk-deletes local and remote pipelines through their storage handles", async ({
  page,
}) => {
  const state = await mockBackend(page);
  await addLocalPipeline(page);
  await page.reload();
  const remoteRow = page.getByRole("row").filter({ hasText: "Remote report" });
  const localRow = page.getByRole("row").filter({ hasText: "Local report" });
  await remoteRow.getByRole("checkbox").check();
  await localRow.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Delete 2 items", exact: true })
    .click();
  await page
    .getByRole("alertdialog", { name: "Delete 2 pipelines?" })
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(remoteRow).toBeHidden();
  await expect(localRow).toBeHidden();
  expect(state.deletes).toEqual([`pipeline-studio/${pipelineId}.yaml`]);
  expect(state.pipelines).toHaveLength(0);
  expect(await readLocalBackup(page)).toBeNull();
});

test("canceling row deletion neither opens nor deletes the pipeline", async ({
  page,
}) => {
  const state = await mockBackend(page);
  await page.goto("/pipelines");
  const row = page.getByRole("row").filter({ hasText: "Remote report" });
  await row
    .getByRole("button", { name: "Delete pipeline: Remote report" })
    .click();
  const confirmation = page.getByRole("alertdialog", {
    name: 'Delete pipeline "Remote report"?',
  });
  await expect(confirmation).toBeVisible();
  await expect(page).toHaveURL("/pipelines");
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmation).toBeHidden();
  await expect(row).toBeVisible();
  expect(state.deletes).toHaveLength(0);
  expect(state.writes).toHaveLength(0);
});

test("shows remote pipelines and opening one does not save it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = await mockBackend(page);
  await addLocalPipeline(page, "Browser report");
  await page.reload();
  const row = page.getByRole("row").filter({ hasText: "Remote report" });
  await expect(row).toBeVisible();
  await expect(row.getByText("Remote", { exact: true })).toBeHidden();
  await expect(row.getByRole("img")).toBeHidden();
  await expect(page.getByText("Local", { exact: true })).toBeVisible();
  const readsBeforeOpening = state.reads.length;
  await row.click();
  await expect(page).toHaveURL(editorUrl(pipelineId));
  await expect(page.locator("[data-editor-ready]")).toBeVisible();
  expect(state.reads.length - readsBeforeOpening).toBeLessThanOrEqual(2);
  await expectStorageIcon(page, "remote");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "Rename", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await page.goto("/pipelines");
  await expect(row).toBeVisible();
  const readsBeforeReopening = state.reads.length;
  await row.click();
  await expect(page.locator("[data-editor-ready]")).toBeVisible();
  expect(state.reads.length - readsBeforeReopening).toBeLessThanOrEqual(2);
  expect(state.writes).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("creates remote pipelines and retries a pending first upload", async ({
  page,
}) => {
  const state = await mockBackend(page, []);
  state.failWrites = true;
  await page.goto("/pipelines");
  await page.getByTestId("new-pipeline-button").first().click();
  await expect(page).toHaveURL(/editor-v2\/pending/);
  await expect(page.getByText("Pending upload", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);

  await page.goto("/pipelines");
  await expect(page.getByText("Pending upload", { exact: true })).toBeVisible();
  state.failWrites = false;
  await page.getByRole("button", { name: /Retry save to server:/ }).click();
  await expect(page.getByText("Pending upload", { exact: true })).toBeHidden();
  await expect(page.getByText("Remote", { exact: true })).toBeHidden();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].filePath).toBe(state.writes[0].filePath);
  expect(state.pipelines).toHaveLength(1);
});

test("migrates a local pipeline and keeps its favorite, history, and recovery copy", async ({
  page,
}) => {
  const state = await mockBackend(page, []);
  await addLocalPipeline(page);
  await page.evaluate(async () => {
    const libraryModule =
      "/src/providers/ComponentLibraryProvider/libraries/storage.ts";
    const { LibraryDB } = await import(libraryModule);
    await LibraryDB.favorites.put({
      type: "pipeline",
      id: "Local report",
      name: "Local report",
    });
    localStorage.setItem(
      "Home/recently_viewed",
      JSON.stringify([
        {
          type: "pipeline",
          id: "Local report",
          name: "Local report",
          timestamp: 1000,
        },
      ]),
    );
  });
  await page.reload();
  const row = page.getByRole("row").filter({ hasText: "Local report" });
  await expect(row.getByText("Local", { exact: true })).toBeVisible();
  await row
    .getByRole("button", { name: "Save to server: Local report" })
    .click();
  await expect(row.getByText("Local", { exact: true })).toBeHidden();
  await expect(row.getByText("Remote", { exact: true })).toBeHidden();
  await expect(row).toHaveCount(1);
  await expect(page.getByText("Local", { exact: true })).toBeHidden();
  expect(state.writes).toHaveLength(1);

  const local = await page.evaluate(async () => {
    const libraryModule =
      "/src/providers/ComponentLibraryProvider/libraries/storage.ts";
    const componentModule = "/src/utils/componentStore.ts";
    const { LibraryDB } = await import(libraryModule);
    const { getComponentFileFromList } = await import(componentModule);
    return {
      favorites: await LibraryDB.favorites.toArray(),
      recent: JSON.parse(localStorage.getItem("Home/recently_viewed") ?? "[]"),
      backup: await getComponentFileFromList("user_pipelines", "Local report"),
    };
  });
  const referenceId = `remote:${encodeURIComponent(backendUrl)}:${state.pipelines[0].id}`;
  expect(local.favorites).toEqual([
    { type: "pipeline", id: referenceId, name: "Local report" },
  ]);
  expect(local.recent).toEqual([
    {
      type: "pipeline",
      id: referenceId,
      name: "Local report",
      timestamp: 1000,
    },
  ]);
  expect(local.backup?.componentRef.spec.name).toBe("Local report");
});

for (const editorPath of ["/editor", "/editor-v2"]) {
  test(`opening ${editorPath} does not upload a local pipeline, but explicit save does`, async ({
    page,
  }) => {
    const state = await mockBackend(page, []);
    await addLocalPipeline(page);
    await page.goto(`${editorPath}/Local%20report`);
    await expect(page.locator("[data-editor-ready]")).toBeVisible();
    await expect(
      page.waitForRequest(
        (request) =>
          request.method() === "PUT" &&
          new URL(request.url()).pathname === "/api/users/me/pipelines",
        { timeout: 1000 },
      ),
    ).rejects.toThrow("Timeout");
    expect(state.writes).toHaveLength(0);
    await expectStorageIcon(page, "local");
    await expect(page).toHaveURL("/editor-v2/Local%20report");

    await page
      .getByRole("button", { name: "Save to server", exact: true })
      .click();
    await expectStorageIcon(page, "remote");
    await expect(page).toHaveURL(editorUrl(state.pipelines[0].id));
    expect(state.writes).toHaveLength(1);
  });
}

test("deleting an untouched local pipeline does not upload it", async ({
  page,
}) => {
  const state = await mockBackend(page, []);
  await addLocalPipeline(page);
  await page.goto("/editor-v2/Local%20report");
  await expect(page.locator("[data-editor-ready]")).toBeVisible();
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Delete pipeline", exact: true })
    .click();
  await page
    .getByRole("alertdialog", { name: "Delete pipeline?" })
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(page).not.toHaveURL(/editor-v2/);
  expect(await readLocalBackup(page)).toBeNull();
  expect(state.writes).toHaveLength(0);
});

test("the first local edit publishes in place and preserves undo and remote autosave", async ({
  page,
}) => {
  const state = await mockBackend(page, []);
  await addLocalPipeline(page);
  await page.goto("/editor-v2/Local%20report");
  const editor = page.locator("[data-editor-ready]");
  await expect(editor).toBeVisible();
  await expectStorageIcon(page, "local");
  await expect(page).toHaveURL("/editor-v2/Local%20report");
  const mountedEditor = await editor.elementHandle();
  await editDescription(page, "Edited before publishing");

  await expectStorageIcon(page, "remote");
  expect(state.pipelines).toHaveLength(1);
  const remoteId = state.pipelines[0].id;
  await expect(page).toHaveURL(editorUrl(remoteId));
  expect(await mountedEditor?.evaluate((element) => element.isConnected)).toBe(
    true,
  );
  expect(state.reads).toHaveLength(0);
  expect(
    state.pipelines[0].root_pipeline_task.componentRef.spec.description,
  ).toBe("Edited before publishing");
  const backup = await readLocalBackup(page);
  expect(backup?.componentRef.spec.description).toBe(
    "Edited before publishing",
  );

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("pipeline-description-input")).toHaveValue("");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByTestId("pipeline-description-input")).toHaveValue(
    "Edited before publishing",
  );
  await editDescription(page, "Edited after publishing");
  await expect
    .poll(
      () => state.pipelines[0].root_pipeline_task.componentRef.spec.description,
    )
    .toBe("Edited after publishing");
  expect(state.pipelines).toHaveLength(1);
  expect(state.pipelines[0].id).toBe(remoteId);
  expect(new Set(state.writes.map((write) => write.filePath)).size).toBe(1);
  expect(state.reads).toHaveLength(0);
  expect(await readLocalBackup(page)).toEqual(backup);
});

for (const { name, retry, description } of [
  {
    name: "another edit",
    retry: (page: Page) => editDescription(page, "Newer recovered edit"),
    description: "Newer recovered edit",
  },
  {
    name: "the Retry button",
    retry: (page: Page) =>
      page.getByRole("button", { name: "Retry", exact: true }).click(),
    description: "Recoverable edit",
  },
  {
    name: "undoing back to the original pipeline",
    retry: (page: Page) =>
      page.getByRole("button", { name: "Undo", exact: true }).click(),
    description: undefined,
  },
]) {
  test(`failed autosave keeps the local draft and retries through ${name}`, async ({
    page,
  }) => {
    const state = await mockBackend(page, []);
    await addLocalPipeline(page);
    state.failWrites = true;
    await page.goto("/editor-v2/Local%20report");
    await expect(page.locator("[data-editor-ready]")).toBeVisible();
    await editDescription(page, "Recoverable edit");
    await expect.poll(() => state.writes.length).toBe(1);
    await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL("/editor-v2/Local%20report");
    await expect(page.getByTestId("pipeline-description-input")).toHaveValue(
      "Recoverable edit",
    );
    expect((await readLocalBackup(page))?.componentRef.spec.description).toBe(
      "Recoverable edit",
    );

    state.failWrites = false;
    await retry(page);
    await expect(page.getByTestId("pipeline-description-input")).toHaveValue(
      description ?? "",
    );
    await expectStorageIcon(page, "remote");
    await expect(page).toHaveURL(editorUrl(state.pipelines[0].id));
    expect(state.writes).toHaveLength(2);
    expect(state.writes[1].filePath).toBe(state.writes[0].filePath);
    expect(state.pipelines).toHaveLength(1);
    expect(
      state.pipelines[0].root_pipeline_task.componentRef.spec.description,
    ).toBe(description);
  });
}

test("renaming a local pipeline first publishes it and browser Back reopens the remote ID", async ({
  page,
}) => {
  const state = await mockBackend(page, []);
  await addLocalPipeline(page);
  await page.goto("/editor-v2/Local%20report");
  await expect(page.locator("[data-editor-ready]")).toBeVisible();
  await expect(page).toHaveURL("/editor-v2/Local%20report");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Rename Pipeline" });
  await dialog.getByRole("textbox").fill("Renamed local report");
  await dialog.getByRole("button", { name: "Rename", exact: true }).click();
  await expectStorageIcon(page, "remote");
  const remoteId = state.pipelines[0].id;
  await expect(page).toHaveURL(editorUrl(remoteId));

  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "My Pipelines", exact: true }).click();
  await expect(page).toHaveURL("/pipelines");
  await page.goBack();
  await expect(page).not.toHaveURL("/pipelines");
  await page.goBack();
  await expect(page).toHaveURL(editorUrl(remoteId));
  await expect(page.locator("[data-editor-ready]")).toBeVisible();
  await expect(
    page.getByText("Renamed local report", { exact: true }).first(),
  ).toBeVisible();
  await expectStorageIcon(page, "remote");
  expect(state.reads).toContain(`/api/pipelines/${remoteId}`);
  expect(state.pipelines).toHaveLength(1);
});

test("creates remotely and saves an owner's rename to that same pipeline", async ({
  page,
}) => {
  const state = await mockBackend(page, []);
  await page.goto("/pipelines");
  await page.getByTestId("new-pipeline-button").first().click();
  await expect(page).toHaveURL(/editor-v2\/[\da-f-]{36}$/);
  await expect(page.locator("[data-editor-ready]")).toBeVisible();
  await expectStorageIcon(page, "remote");
  expect(state.writes).toHaveLength(1);
  const originalId = state.pipelines[0].id;

  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Rename Pipeline" });
  await dialog.getByRole("textbox").fill("Renamed remote report");
  await dialog.getByRole("button", { name: "Rename", exact: true }).click();
  await expect
    .poll(() => state.pipelines[0].pipeline_name)
    .toBe("Renamed remote report");
  expect(state.pipelines).toHaveLength(1);
  expect(state.pipelines[0].id).toBe(originalId);
  expect(state.writes[1].filePath).toBe(state.writes[0].filePath);
  await page.goto("/pipelines");
  const row = page
    .getByRole("row")
    .filter({ hasText: "Renamed remote report" });
  await expect(row).toBeVisible();
  const readsBeforeReopening = state.reads.length;
  const writesBeforeReopening = state.writes.length;
  await row.click();
  await expect(page.locator("[data-editor-ready]")).toBeVisible();
  await expect(
    page.getByText("Renamed remote report", { exact: true }).first(),
  ).toBeVisible();
  expect(state.reads.length - readsBeforeReopening).toBeLessThanOrEqual(2);
  expect(state.writes).toHaveLength(writesBeforeReopening);
});

test("opens another owner's pipeline read-only and clones into the viewer's account", async ({
  page,
}) => {
  const state = await mockBackend(page, [
    pipeline(viewerPipelineId, "another-owner", "Shared report"),
  ]);
  await page.goto(legacyEditorUrl(viewerPipelineId));
  await expect(page.locator("[data-editor-ready]")).toBeVisible();
  await expect(page).toHaveURL(editorUrl(viewerPipelineId));
  await expectStorageIcon(page, "remote");
  await expect(page.getByTestId("auto-save-button")).toBeDisabled();
  await expect(page.getByTestId("auto-save-button")).toHaveAccessibleName(
    "View-only pipeline",
  );
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "File", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "Rename", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("menuitem", { name: "Clone to my pipelines", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Clone to My Pipelines" });
  await dialog.getByRole("textbox").fill("My copy");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expectStorageIcon(page, "remote");
  await expect(page.getByTestId("auto-save-button")).toBeEnabled();
  await expect(
    page.getByText("My copy", { exact: true }).first(),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(
    state.pipelines.find((item) => item.pipeline_name === "My copy")?.user_id,
  ).toBe(ownerId);
  expect(
    state.pipelines.find((item) => item.id === viewerPipelineId)?.pipeline_name,
  ).toBe("Shared report");
});
