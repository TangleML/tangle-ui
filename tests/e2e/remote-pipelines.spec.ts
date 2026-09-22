import { expect, type Page, test } from "@playwright/test";

import type { BodyCreateApiPipelineRunsPost } from "../../src/api/types.gen";

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
const savedPipelineAnnotation = "tangleml.com/user-pipeline/pipeline-id";
const sourcePipelineAnnotation = "tangleml.com/source/pipeline-id";

function pipelineRun(
  id: string,
  annotation = savedPipelineAnnotation,
  sourceId = pipelineId,
) {
  return {
    id,
    root_execution_id: `execution-${id}`,
    pipeline_name: "Remote report",
    created_by: "teammate-account",
    created_at: "2026-09-18T10:00:00Z",
    execution_status_stats: { SUCCEEDED: 1 },
    annotations: { [annotation]: sourceId },
  };
}

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
    runs: [] as ReturnType<typeof pipelineRun>[],
    runSubmissions: [] as BodyCreateApiPipelineRunsPost[],
    writeOrder: [] as string[],
  };
  const context = page.context();
  await context.addInitScript(() => {
    localStorage.setItem("seen-editor-v2-welcome", "true");
    localStorage.setItem("seen-run-v2-welcome", "true");
    localStorage.setItem("betaFlags", JSON.stringify({ v2_editor: true }));
  });
  await context.route("**/services/ping", (route) =>
    route.fulfill({ status: 200, body: "ok" }),
  );
  await context.route("**/api/**", async (route) => {
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
    if (url.pathname === "/api/pipeline_runs/") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as BodyCreateApiPipelineRunsPost;
        state.runSubmissions.push(body);
        state.writeOrder.push("run");
        return route.fulfill({ json: pipelineRun("new-run") });
      }
      const query = JSON.parse(url.searchParams.get("filter_query") ?? "{}");
      const sourcePredicates:
        { value_equals: { key: string; value: string } }[] | undefined =
        query.and?.find((predicate: { or?: unknown }) => predicate.or)?.or;
      const runs = sourcePredicates
        ? state.runs.filter((run) =>
            sourcePredicates.some(
              ({ value_equals: { key, value } }) =>
                run.annotations[key] === value,
            ),
          )
        : state.runs;
      return route.fulfill({
        json: { pipeline_runs: runs, next_page_token: null },
      });
    }
    if (url.pathname.startsWith("/api/pipeline_runs/")) {
      const run = state.runs.find(
        (run) => run.id === url.pathname.split("/")[3],
      );
      if (run) {
        return route.fulfill({
          json: url.pathname.endsWith("/annotations/") ? run.annotations : run,
        });
      }
    }
    if (url.pathname.startsWith("/api/executions/")) {
      const run = state.runs.find(
        (run) => run.root_execution_id === url.pathname.split("/")[3],
      );
      if (run) {
        return route.fulfill({
          json: url.pathname.endsWith("/state")
            ? { child_execution_status_stats: { task: { SUCCEEDED: 1 } } }
            : {
                id: run.root_execution_id,
                pipeline_run_id: run.id,
                task_spec: pipeline().root_pipeline_task,
                child_task_execution_ids: {},
              },
        });
      }
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
      state.writeOrder.push("save");
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

async function addLocalPipeline(
  page: Page,
  name = "Local report",
  content = `name: ${name}\nimplementation:\n  graph:\n    tasks: {}\n`,
) {
  await page.goto("/pipelines");
  await expect(page.getByTestId("new-pipeline-button").first()).toBeVisible();
  await page.evaluate(
    async ({ name, content }) => {
      const storageModule =
        "/src/services/pipelineStorage/PipelineStorageService.ts";
      const { PipelineStorageService } = await import(storageModule);
      await new PipelineStorageService().rootFolder.addFile(name, content);
    },
    { name, content },
  );
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

for (const { label, viewport } of [
  { label: "desktop", viewport: { width: 1280, height: 900 } },
  { label: "mobile", viewport: { width: 390, height: 844 } },
]) {
  test(`associated runs use saved identity and return to the source pipeline on ${label}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const state = await mockBackend(page);
    state.runs = [
      pipelineRun("saved-run"),
      pipelineRun("editor-run", sourcePipelineAnnotation),
      pipelineRun(
        "same-name-clone-run",
        savedPipelineAnnotation,
        viewerPipelineId,
      ),
    ];
    await page.goto("/pipelines");
    const runsLink = page.getByRole("link", {
      name: "View runs for Remote report",
    });
    await expect(runsLink).toBeVisible();
    await page.reload();
    await expect(runsLink).toBeVisible();
    await runsLink.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`associated-runs-link-${label}.png`),
    });

    const filteredRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/pipeline_runs/" &&
        url.searchParams.has("filter_query")
      );
    });
    await runsLink.click();
    await expect(page).toHaveURL(/\/runs\?filter=/);
    expect(
      JSON.parse(new URL(page.url()).searchParams.get("filter") ?? "{}"),
    ).toEqual({ saved_pipeline_id: pipelineId });
    const requestUrl = new URL((await filteredRequest).url());
    expect(
      JSON.parse(requestUrl.searchParams.get("filter_query") ?? "{}"),
    ).toEqual({
      and: [
        {
          or: [savedPipelineAnnotation, sourcePipelineAnnotation].map(
            (key) => ({ value_equals: { key, value: pipelineId } }),
          ),
        },
      ],
    });
    await expect(page.getByText(`Saved pipeline: ${pipelineId}`)).toBeVisible();
    await expect(page.getByPlaceholder("Search by user...")).toHaveValue("");
    await expect(page.getByText("saved-run", { exact: true })).toBeVisible();
    await expect(page.getByText("editor-run", { exact: true })).toBeVisible();
    await expect(
      page.getByText("same-name-clone-run", { exact: true }),
    ).toBeHidden();
    await page.screenshot({
      path: testInfo.outputPath(`associated-runs-list-${label}.png`),
    });

    await page
      .getByRole("row")
      .filter({ hasText: "saved-run" })
      .getByText("Remote report", { exact: true })
      .click();
    await expect(page.getByTestId("run-view-v2")).toBeVisible();
    await expect(
      page.getByText("Source pipeline", { exact: true }),
    ).toBeVisible();
    const backlink = page.getByRole("link", {
      name: "Open pipeline",
      exact: true,
    });
    await expect(backlink).toHaveAttribute("href", editorUrl(pipelineId));
    await expect(backlink).toHaveAttribute("title", pipelineId);
    await expect(backlink).not.toHaveAttribute("target", "_blank");
    await expect(backlink).toBeVisible();
    const linkLayout = await backlink.evaluate((link) => {
      const rect = link.getBoundingClientRect();
      const parent = link.parentElement?.getBoundingClientRect();
      return {
        height: rect.height,
        lineHeight: parseFloat(getComputedStyle(link).lineHeight),
        fitsParent:
          parent !== undefined &&
          rect.left >= parent.left &&
          rect.right <= parent.right + 1,
        overflows: link.scrollWidth > link.clientWidth,
      };
    });
    expect(linkLayout.height).toBeLessThanOrEqual(linkLayout.lineHeight + 1);
    expect(linkLayout.fitsParent).toBe(true);
    expect(linkLayout.overflows).toBe(false);
    const runInfo = page
      .getByRole("button", { name: "Run Info", exact: true })
      .locator("..");
    const createdAt = await page.evaluate((timestamp) => {
      return new Date(timestamp).toLocaleString();
    }, state.runs[0].created_at);
    const runInfoValues = [
      "saved-run",
      "execution-saved-run",
      "Open pipeline",
      "teammate-account",
      createdAt,
    ].map((value) => runInfo.getByText(value, { exact: true }));
    const valuePositions = async () => {
      const panelLeft = await runInfo.evaluate(
        (element) => element.getBoundingClientRect().left,
      );
      return Promise.all(
        runInfoValues.map((value) =>
          value.evaluate(
            (element, panelLeft) =>
              element.getBoundingClientRect().left - panelLeft,
            panelLeft,
          ),
        ),
      );
    };
    for (const value of runInfoValues) {
      await expect(value).toBeVisible();
    }
    const alignedValuePositions = await valuePositions();
    expect(
      Math.max(...alignedValuePositions) - Math.min(...alignedValuePositions),
    ).toBeLessThanOrEqual(1);
    const sourceLabelCenter = await runInfo
      .getByText("Source pipeline", { exact: true })
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });
    const sourceLinkCenter = await backlink.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    expect(Math.abs(sourceLabelCenter - sourceLinkCenter)).toBeLessThanOrEqual(
      1,
    );
    await testInfo.attach("run-info-value-positions", {
      body: JSON.stringify({
        alignedValuePositions,
        sourceLabelCenter,
        sourceLinkCenter,
      }),
      contentType: "application/json",
    });
    for (const label of [
      "Run Id",
      "Execution Id",
      "Source pipeline",
      "Created by",
      "Created at",
    ]) {
      await runInfo.getByText(label, { exact: true }).hover();
      expect(await valuePositions()).toEqual(alignedValuePositions);
    }
    await page.mouse.move(0, 0);
    await runInfo.screenshot({
      path: testInfo.outputPath(`associated-runs-run-info-${label}-spa.png`),
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await runInfo.screenshot({
      path: testInfo.outputPath(
        `associated-runs-run-info-${label}-dark-spa.png`,
      ),
    });
    const documentBeforeNavigation = await page.evaluateHandle(() => document);
    const newPages: Page[] = [];
    const documentNavigations: string[] = [];
    page.context().on("page", (newPage) => newPages.push(newPage));
    page.on("request", (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        documentNavigations.push(request.url());
      }
    });
    await backlink.click();
    await expect(page).toHaveURL(editorUrl(pipelineId));
    await expect(page.locator("[data-editor-ready]")).toBeVisible();
    await expectStorageIcon(page, "remote");
    expect(
      await documentBeforeNavigation.evaluate(
        (previousDocument) => previousDocument === document,
      ),
    ).toBe(true);
    expect(documentNavigations).toEqual([]);
    expect(newPages).toHaveLength(0);
    expect(page.context().pages()).toEqual([page]);
    expect(state.writes).toHaveLength(0);
    await documentBeforeNavigation.dispose();
  });
}

const runnableLocalPipeline = `name: Local report
implementation:
  graph:
    tasks:
      hello:
        componentRef:
          spec:
            name: Hello
            implementation:
              container:
                image: alpine:3.20
                command: [echo, hello]
`;

test("Quick Run uploads a local pipeline before submitting its source annotation", async ({
  page,
}) => {
  const state = await mockBackend(page, []);
  await addLocalPipeline(page, "Local report", runnableLocalPipeline);
  await page.goto("/editor-v2/Local%20report");
  await expect(page.locator("[data-editor-ready]")).toBeVisible();
  await expectStorageIcon(page, "local");
  expect(state.writes).toHaveLength(0);

  await page
    .locator('[data-tracking-id="v2.pipeline_editor.quick_run"]')
    .click();
  await expect(
    page.getByText("Pipeline successfully submitted", { exact: true }),
  ).toBeVisible();
  await expectStorageIcon(page, "remote");
  expect(state.writeOrder).toEqual(["save", "run"]);
  expect(state.runSubmissions).toHaveLength(1);
  expect(state.runSubmissions[0].annotations).toMatchObject({
    [sourcePipelineAnnotation]: state.pipelines[0].id,
  });
  expect(state.runSubmissions[0].annotations).not.toHaveProperty(
    savedPipelineAnnotation,
  );
  await expect(page).toHaveURL(editorUrl(state.pipelines[0].id));
});

test("Quick Run does not create a run when the first local upload fails", async ({
  page,
}) => {
  const state = await mockBackend(page, []);
  state.failWrites = true;
  await addLocalPipeline(page, "Local report", runnableLocalPipeline);
  await page.goto("/editor-v2/Local%20report");
  await expect(page.locator("[data-editor-ready]")).toBeVisible();

  await page
    .locator('[data-tracking-id="v2.pipeline_editor.quick_run"]')
    .click();
  await expect(page.getByText(/Failed to submit pipeline\./)).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.runSubmissions).toHaveLength(0);
  await expect(page).toHaveURL("/editor-v2/Local%20report");
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
});

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
