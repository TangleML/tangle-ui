import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CloudPipeline,
  type CloudPipelineSummary,
  cloudPipelineToComponentSpec,
  deleteCloudPipeline,
  getCloudPipeline,
  getCloudPipelineAccount,
  listCloudPipelinePage,
  listCloudPipelines,
  writeCloudPipeline,
} from "@/services/cloudPipelineService";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";

const CLOUD_ID = "20000000-0000-4000-8000-000000000001";
const OTHER_CLOUD_ID = "20000000-0000-4000-8000-000000000002";
const FILE_PATH = "tangle-ui/stable-local-id.yaml";
const ACCOUNT = "owner@example.com";
const connection = {
  backendUrl: "https://backend.example.com/",
  authorizationToken: "test-token",
};
const localSpec: ComponentSpec = {
  name: "Daily report",
  inputs: [{ name: "source", default: "default.csv", value: "selected.csv" }],
  metadata: { annotations: { tags: ["reporting"] } },
  implementation: {
    graph: {
      tasks: {
        report: {
          componentRef: {
            spec: {
              name: "Report",
              inputs: [{ name: "source" }],
              metadata: { annotations: { position: { x: 10, y: 20 } } },
              implementation: { container: { image: "python:3.12" } },
            },
          },
          arguments: { source: { graphInput: { inputName: "source" } } },
          annotations: { label: "Keep this task annotation" },
        },
      },
    },
  },
};
const fetchMock = vi.fn<typeof fetch>();

function pipelineSummary(
  overrides: Partial<CloudPipelineSummary> = {},
): CloudPipelineSummary {
  return {
    id: CLOUD_ID,
    user_id: ACCOUNT,
    file_path: FILE_PATH,
    pipeline_name: "Daily report",
    created_at: "2026-09-17T12:00:00Z",
    updated_at: "2026-09-18T12:00:00Z",
    current_version: "abc123",
    versioning_mode: "disabled",
    ...overrides,
  };
}

function pipeline(overrides: Partial<CloudPipeline> = {}): CloudPipeline {
  return {
    ...pipelineSummary(),
    version: "abc123",
    version_created_at: "2026-09-18T12:00:00Z",
    root_pipeline_task: { componentRef: { spec: localSpec } },
    pipeline_run_annotations: {},
    ...overrides,
  };
}

function accountResponse(id = ACCOUNT, permissions = ["read", "write"]) {
  return Response.json({ id, permissions });
}

function saveResponses(saved = pipeline()) {
  fetchMock
    .mockResolvedValueOnce(accountResponse())
    .mockResolvedValueOnce(Response.json(saved));
}

function requestAt(index: number) {
  const request = fetchMock.mock.calls[index]?.[0];
  if (!(request instanceof Request))
    throw new Error(`Missing request ${index}`);
  return request;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("remote pipeline reads", () => {
  it("identifies the account on the configured backend", async () => {
    fetchMock.mockResolvedValueOnce(accountResponse());

    await expect(getCloudPipelineAccount(connection)).resolves.toEqual({
      id: ACCOUNT,
      permissions: ["read", "write"],
    });
    expect(requestAt(0).url).toBe("https://backend.example.com/api/users/me");
    expect(requestAt(0).headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("rejects an unidentified account", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ id: null, permissions: [] }),
    );

    await expect(getCloudPipelineAccount(connection)).rejects.toThrow(
      "could not identify your account",
    );
  });

  it("loads one page of ten summaries without following its next cursor", async () => {
    const summary = pipelineSummary();
    fetchMock.mockResolvedValueOnce(
      Response.json({
        pipelines: [summary],
        next_page_token: "next-page",
        total_count: 42,
      }),
    );

    await expect(listCloudPipelinePage(connection)).resolves.toEqual({
      pipelines: [summary],
      nextPageToken: "next-page",
      totalCount: 42,
    });

    const url = new URL(requestAt(0).url);
    expect(url.pathname).toBe("/api/users/me/pipelines/all");
    expect(url.searchParams.get("page_size")).toBe("10");
    expect(url.searchParams.has("page_token")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts an explicit page size and cursor when totals are unavailable", async () => {
    const cursor = `2026-09-18T12:00:00+00:00~${CLOUD_ID}`;
    fetchMock.mockResolvedValueOnce(
      Response.json({ pipelines: [], next_page_token: null }),
    );

    await expect(
      listCloudPipelinePage(connection, { pageSize: 25, pageToken: cursor }),
    ).resolves.toEqual({
      pipelines: [],
      nextPageToken: undefined,
      totalCount: undefined,
    });

    const url = new URL(requestAt(0).url);
    expect(url.searchParams.get("page_size")).toBe("25");
    expect(url.searchParams.get("page_token")).toBe(cursor);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([-1, 1.5, "42", null])(
    "rejects an invalid total count of %s",
    async (totalCount) => {
      fetchMock.mockResolvedValueOnce(
        Response.json({
          pipelines: [],
          next_page_token: null,
          total_count: totalCount,
        }),
      );

      await expect(listCloudPipelinePage(connection)).rejects.toThrow();
    },
  );

  it("lists only the current user's pipelines across every cursor page", async () => {
    const first = pipelineSummary();
    const second = pipelineSummary({ id: OTHER_CLOUD_ID, pipeline_name: null });
    const cursor = `2026-09-18T12:00:00+00:00~${CLOUD_ID}`;
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          pipelines: [first],
          total_count: 2,
          next_page_token: cursor,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          pipelines: [first, second],
          total_count: 2,
          next_page_token: null,
        }),
      );

    await expect(listCloudPipelines(connection)).resolves.toEqual([
      first,
      second,
    ]);
    const firstUrl = new URL(requestAt(0).url);
    expect(firstUrl.pathname).toBe("/api/users/me/pipelines/all");
    expect(firstUrl.searchParams.get("page_size")).toBe("100");
    expect(firstUrl.searchParams.has("page_token")).toBe(false);
    expect(new URL(requestAt(1).url).searchParams.get("page_token")).toBe(
      cursor,
    );
  });

  it("stops a malformed repeated cursor instead of looping", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ pipelines: [], next_page_token: "repeated" }),
    );

    await expect(listCloudPipelines(connection)).rejects.toThrow(
      "repeated a pipeline list page",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed list entries", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ pipelines: [{ id: "invalid" }], next_page_token: null }),
    );

    await expect(listCloudPipelines(connection)).rejects.toThrow();
  });

  it("allows reading another owner's pipeline by its stable ID", async () => {
    const saved = pipeline({ user_id: "another-owner@example.com" });
    fetchMock.mockResolvedValueOnce(Response.json(saved));

    await expect(getCloudPipeline(CLOUD_ID, connection)).resolves.toEqual(
      saved,
    );
    expect(requestAt(0).url).toBe(
      `https://backend.example.com/api/pipelines/${CLOUD_ID}`,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a lookup response for a different ID", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(pipeline({ id: OTHER_CLOUD_ID })),
    );

    await expect(getCloudPipeline(CLOUD_ID, connection)).rejects.toThrow(
      "different remote pipeline",
    );
  });

  it("reports backend errors without returning partial data", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ detail: "Pipeline does not exist" }, { status: 404 }),
    );

    await expect(getCloudPipeline(CLOUD_ID, connection)).rejects.toThrow(
      "Pipeline does not exist",
    );
  });

  it.each(["timeout", "caller"])(
    "cancels a stalled request on %s abort",
    async (source) => {
      const timeout = new AbortController();
      const caller = new AbortController();
      vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
      fetchMock.mockImplementation(async (request) => {
        if (!(request instanceof Request)) throw new Error("Missing request");
        return new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener(
            "abort",
            () => reject(request.signal.reason),
            { once: true },
          );
        });
      });
      const pending = getCloudPipeline(CLOUD_ID, {
        ...connection,
        signal: caller.signal,
      });

      (source === "timeout" ? timeout : caller).abort();

      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(AbortSignal.timeout).toHaveBeenCalledWith(15_000);
    },
  );
});

describe("remote pipeline writes", () => {
  it("writes the supplied stable path and returns the server identity", async () => {
    saveResponses();
    const original = structuredClone(localSpec);

    await expect(
      writeCloudPipeline(
        { filePath: FILE_PATH, componentSpec: localSpec },
        connection,
      ),
    ).resolves.toEqual(pipeline());

    const request = requestAt(1);
    expect(request.method).toBe("PUT");
    expect(new URL(request.url).pathname).toBe("/api/users/me/pipelines");
    expect(new URL(request.url).searchParams.get("file_path")).toBe(FILE_PATH);
    expect(localSpec).toEqual(original);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reuses the connection's scoped account without another account request", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(pipeline()));

    await writeCloudPipeline(
      { filePath: FILE_PATH, componentSpec: localSpec },
      {
        ...connection,
        account: { id: ACCOUNT, permissions: ["read", "write"] },
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestAt(0).method).toBe("PUT");
  });

  it("sends runtime inputs as root arguments and coerces nested metadata annotations", async () => {
    saveResponses();
    await writeCloudPipeline(
      { filePath: FILE_PATH, componentSpec: localSpec },
      connection,
    );

    const expectedSpec = structuredClone(localSpec);
    if (!expectedSpec.inputs || !("graph" in expectedSpec.implementation))
      throw new Error("Invalid test pipeline");
    delete expectedSpec.inputs[0].value;
    expectedSpec.metadata = { annotations: { tags: '["reporting"]' } };
    const nested =
      expectedSpec.implementation.graph.tasks.report.componentRef.spec;
    if (!nested) throw new Error("Invalid nested test component");
    nested.metadata = { annotations: { position: '{"x":10,"y":20}' } };

    expect(await requestAt(1).json()).toEqual({
      root_pipeline_task: {
        componentRef: { spec: expectedSpec },
        arguments: { source: "selected.csv" },
      },
      pipeline_run_annotations: {},
    });
  });

  it.each<{ kind: string; componentRef: ComponentReference }>([
    {
      kind: "inline",
      componentRef: {
        name: "Compute resources example",
        digest: "sha256:example",
        tag: "v1",
        url: "https://example.com/component.yaml",
        text: "name: Compute resources example",
        spec: {
          name: "Compute resources example",
          implementation: { container: { image: "python:3.12" } },
        },
      },
    },
    {
      kind: "URL-only",
      componentRef: { url: "https://example.com/component.yaml" },
    },
    {
      kind: "text-only",
      componentRef: {
        text: "implementation:\n  container:\n    image: alpine",
      },
    },
  ])(
    "strips library fields from $kind references at every depth without mutating the editor",
    async ({ componentRef }) => {
      const libraryMetadata = {
        favorited: true,
        owned: true,
        published_by: "publisher@example.com",
        deprecated: false,
        superseded_by: "sha256:replacement",
        author: "Alexey Volkov <alexey.volkov@ark-kun.com>",
        fetched_at: "2025-12-15T23:26:53.231Z",
        id: "component-7160345cf18c12",
        data: "name: Select columns using Pandas on CSV data",
        createdAt: 1760619921684,
        updatedAt: 1787779656488,
        futureLibraryField: "editor metadata",
      };
      const nestedSpec: ComponentSpec = {
        inputs: [{ name: "internal", value: "editor only" }],
        implementation: {
          graph: {
            tasks: { example: { componentRef: structuredClone(componentRef) } },
          },
        },
      };
      const expectedSpec: ComponentSpec = {
        implementation: {
          graph: {
            tasks: {
              example: { componentRef: structuredClone(componentRef) },
              subgraph: { componentRef: { spec: nestedSpec } },
            },
          },
        },
      };
      const decoratedSpec = structuredClone(expectedSpec);
      if (!("graph" in decoratedSpec.implementation))
        throw new Error("Invalid test pipeline");
      const tasks = decoratedSpec.implementation.graph.tasks;
      const subgraph = tasks.subgraph.componentRef.spec;
      if (!subgraph || !("graph" in subgraph.implementation))
        throw new Error("Invalid test subgraph");
      for (const ref of [
        tasks.example.componentRef,
        tasks.subgraph.componentRef,
        subgraph.implementation.graph.tasks.example.componentRef,
      ]) {
        Object.assign(ref, libraryMetadata);
      }
      const before = structuredClone(decoratedSpec);
      delete nestedSpec.inputs?.[0].value;
      saveResponses();

      await writeCloudPipeline(
        { filePath: FILE_PATH, componentSpec: decoratedSpec },
        connection,
      );

      expect(await requestAt(1).json()).toEqual({
        root_pipeline_task: {
          componentRef: { spec: expectedSpec },
          arguments: {},
        },
        pipeline_run_annotations: {},
      });
      expect(decoratedSpec).toEqual(before);
    },
  );

  it("preserves root execution settings and run annotations on a renamed pipeline", async () => {
    const existingPipeline = pipeline({
      root_pipeline_task: {
        componentRef: { spec: localSpec },
        annotations: { source: "keep" },
        executionOptions: { retryStrategy: { maxRetries: 3 } },
        isEnabled: "true",
      },
      pipeline_run_annotations: { team: "reporting" },
      versioning_mode: "full",
    });
    saveResponses();

    await writeCloudPipeline(
      {
        filePath: FILE_PATH,
        componentSpec: { ...localSpec, name: "Renamed report" },
        existingPipeline,
      },
      connection,
    );

    const body = await requestAt(1).json();
    expect(body).toMatchObject({
      root_pipeline_task: {
        componentRef: { spec: { name: "Renamed report" } },
        annotations: { source: "keep" },
        executionOptions: { retryStrategy: { maxRetries: 3 } },
        isEnabled: "true",
      },
      pipeline_run_annotations: { team: "reporting" },
    });
    expect(body).not.toHaveProperty("versioning_mode");
  });

  it("rejects updates to another owner's pipeline before issuing a write", async () => {
    fetchMock.mockResolvedValueOnce(accountResponse());

    await expect(
      writeCloudPipeline(
        {
          filePath: FILE_PATH,
          componentSpec: localSpec,
          existingPipeline: pipeline({ user_id: "another-owner@example.com" }),
        },
        connection,
      ),
    ).rejects.toThrow("Only the owner");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates a copy under the viewer's account when no existing pipeline is supplied", async () => {
    const secret = { dynamicData: { secret: { name: "source-token" } } };
    const viewed = pipeline({
      user_id: "another-owner@example.com",
      root_pipeline_task: {
        componentRef: { spec: { ...localSpec, inputs: [{ name: "source" }] } },
        arguments: { source: secret },
        executionOptions: { retryStrategy: { maxRetries: 2 } },
        annotations: { team: "reporting" },
      },
      pipeline_run_annotations: { project: "copied" },
    });
    saveResponses();

    await writeCloudPipeline(
      {
        filePath: FILE_PATH,
        componentSpec: cloudPipelineToComponentSpec(viewed),
        sourcePipeline: viewed,
      },
      connection,
    );

    expect(requestAt(1).method).toBe("PUT");
    expect(new URL(requestAt(1).url).pathname).toBe("/api/users/me/pipelines");
    expect(await requestAt(1).json()).toMatchObject({
      root_pipeline_task: {
        arguments: { source: secret },
        executionOptions: { retryStrategy: { maxRetries: 2 } },
        annotations: { team: "reporting" },
      },
      pipeline_run_annotations: { project: "copied" },
    });
  });

  it("rejects writes without account write permission", async () => {
    fetchMock.mockResolvedValueOnce(accountResponse(ACCOUNT, ["read"]));

    await expect(
      writeCloudPipeline(
        { filePath: FILE_PATH, componentSpec: localSpec },
        connection,
      ),
    ).rejects.toThrow("does not have permission");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects changing an existing pipeline's storage path", async () => {
    fetchMock.mockResolvedValueOnce(accountResponse());

    await expect(
      writeCloudPipeline(
        {
          filePath: "another-path.yaml",
          componentSpec: localSpec,
          existingPipeline: pipeline(),
        },
        connection,
      ),
    ).rejects.toThrow("storage path cannot change");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { user_id: "another-owner@example.com" },
    { file_path: "unexpected/path.yaml" },
    { id: OTHER_CLOUD_ID },
  ])(
    "rejects an update response with mismatched identity: %j",
    async (overrides) => {
      saveResponses(pipeline(overrides));

      await expect(
        writeCloudPipeline(
          {
            filePath: FILE_PATH,
            componentSpec: localSpec,
            existingPipeline: pipeline(),
          },
          connection,
        ),
      ).rejects.toThrow("different remote pipeline");
    },
  );

  it("preserves invalid spec fields and backend save errors", async () => {
    const componentSpec = structuredClone(localSpec);
    Object.assign(componentSpec.implementation, { unknownField: true });
    fetchMock
      .mockResolvedValueOnce(accountResponse())
      .mockResolvedValueOnce(
        Response.json({ detail: "Invalid TaskSpec" }, { status: 422 }),
      );

    await expect(
      writeCloudPipeline({ filePath: FILE_PATH, componentSpec }, connection),
    ).rejects.toThrow("Invalid TaskSpec");
    expect(await requestAt(1).json()).toMatchObject({
      root_pipeline_task: {
        componentRef: { spec: { implementation: { unknownField: true } } },
      },
    });
  });
});

describe("remote pipeline input round trips", () => {
  it("restores string arguments, including empty strings, without changing the server object", () => {
    const saved = pipeline({
      root_pipeline_task: {
        componentRef: {
          spec: {
            ...localSpec,
            inputs: [{ name: "source", default: "default.csv" }],
          },
        },
        arguments: { source: "" },
      },
    });
    const before = structuredClone(saved);

    expect(cloudPipelineToComponentSpec(saved).inputs).toEqual([
      { name: "source", default: "default.csv", value: "" },
    ]);
    expect(saved).toEqual(before);
  });

  it("retains secret arguments through edits, removes deleted inputs, and allows explicit replacements", async () => {
    const secret = { dynamicData: { secret: { name: "source-token" } } };
    const existingPipeline = pipeline({
      root_pipeline_task: {
        componentRef: {
          spec: {
            ...localSpec,
            inputs: [
              { name: "secret", default: "fallback" },
              { name: "replace" },
              { name: "removed" },
            ],
          },
        },
        arguments: { secret, replace: secret, removed: secret },
      },
    });
    const componentSpec = cloudPipelineToComponentSpec(existingPipeline);
    componentSpec.inputs = componentSpec.inputs?.filter(
      (input) => input.name !== "removed",
    );
    const replace = componentSpec.inputs?.find(
      (input) => input.name === "replace",
    );
    if (!replace) throw new Error("Missing test input");
    replace.value = "new value";
    saveResponses();

    await writeCloudPipeline(
      { filePath: FILE_PATH, componentSpec, existingPipeline },
      connection,
    );

    const body = await requestAt(1).json();
    expect(body.root_pipeline_task.arguments).toEqual({
      secret,
      replace: "new value",
    });
  });

  it("rejects remote definitions that have no inline component", () => {
    expect(() =>
      cloudPipelineToComponentSpec(
        pipeline({
          root_pipeline_task: {
            componentRef: { url: "https://example.com/component.yaml" },
          },
        }),
      ),
    ).toThrow("does not contain a component definition");
  });
});

describe("remote pipeline deletion", () => {
  it("deletes the owner's pipeline by its storage path", async () => {
    fetchMock
      .mockResolvedValueOnce(accountResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      deleteCloudPipeline(pipelineSummary(), connection),
    ).resolves.toBeUndefined();
    expect(requestAt(1).method).toBe("DELETE");
    expect(new URL(requestAt(1).url).pathname).toBe("/api/users/me/pipelines");
    expect(new URL(requestAt(1).url).searchParams.get("file_path")).toBe(
      FILE_PATH,
    );
  });

  it("rejects deleting another owner's pipeline before issuing a delete", async () => {
    fetchMock.mockResolvedValueOnce(accountResponse());

    await expect(
      deleteCloudPipeline(
        pipelineSummary({ user_id: "another-owner@example.com" }),
        connection,
      ),
    ).rejects.toThrow("Only the owner");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
