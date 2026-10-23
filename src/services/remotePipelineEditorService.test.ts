import { beforeEach, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";

import { findRemotePipelineDocumentByPath } from "./remotePipelineEditorService";

vi.mock("@/api/client.gen", () => ({ client: { get: vi.fn() } }));

const backendUrl = "https://backend.example.com";
const filePath = "pipelines/local-id.yaml";
const document = {
  id: "remote-id",
  file_path: filePath,
  pipeline_name: "Pipeline",
  root_pipeline_task: {
    componentRef: { spec: { implementation: { graph: { tasks: {} } } } },
  },
};

beforeEach(() => vi.resetAllMocks());

it("looks up an earlier upload using the captured backend and exact owner path", async () => {
  vi.mocked(client.get).mockResolvedValue({
    data: document,
    error: undefined,
    request: new Request(backendUrl),
    response: new Response(null),
  });
  await expect(
    findRemotePipelineDocumentByPath(backendUrl, filePath),
  ).resolves.toBe(document);
  expect(client.get).toHaveBeenCalledWith({
    baseUrl: backendUrl,
    url: "/api/users/me/pipelines",
    query: { file_path: filePath },
  });
});

it("allows a new upload only when the owner path is absent", async () => {
  vi.mocked(client.get).mockResolvedValue({
    data: undefined,
    error: {
      detail:
        "Pipeline with file path 'pipelines/local-id.yaml' was not found for user 'owner@example.com'.",
    },
    request: new Request(backendUrl),
    response: new Response(null, { status: 404 }),
  });
  await expect(
    findRemotePipelineDocumentByPath(backendUrl, filePath),
  ).resolves.toBeUndefined();
});

it("does not start an upload when the lookup route is unsupported", async () => {
  vi.mocked(client.get).mockResolvedValue({
    data: undefined,
    error: { detail: "Not Found" },
    request: new Request(backendUrl),
    response: new Response(null, { status: 404 }),
  });
  await expect(
    findRemotePipelineDocumentByPath(backendUrl, filePath),
  ).rejects.toMatchObject({ kind: "unsupported", status: 404 });
});

it("preserves non-missing lookup errors instead of proceeding to overwrite", async () => {
  vi.mocked(client.get).mockResolvedValue({
    data: undefined,
    error: { detail: "Unavailable" },
    request: new Request(backendUrl),
    response: new Response(null, { status: 503 }),
  });
  await expect(
    findRemotePipelineDocumentByPath(backendUrl, filePath),
  ).rejects.toThrow("503): Unavailable");
});

it("rejects a document returned for a different file", async () => {
  vi.mocked(client.get).mockResolvedValue({
    data: { ...document, file_path: "pipelines/other.yaml" },
    error: undefined,
    request: new Request(backendUrl),
    response: new Response(null),
  });
  await expect(
    findRemotePipelineDocumentByPath(backendUrl, filePath),
  ).rejects.toThrow("different pipeline file");
});
