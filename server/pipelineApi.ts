import type { ComponentSpecJson } from "../src/models/componentSpec/entities/types";

export interface BackendPipeline {
  filePath: string;
  spec: ComponentSpecJson;
}

function backendUrl(): string {
  const url = process.env.COLLAB_BACKEND_URL;
  if (!url) {
    throw new Error(
      "COLLAB_BACKEND_URL is not set; the sync server cannot reach the backend",
    );
  }
  return url.replace(/\/$/, "");
}

function authHeader(): Record<string, string> {
  const basic = process.env.TANGENT_MCP_BASIC_AUTH;
  return basic ? { Authorization: `Basic ${basic}` } : {};
}

function extractSpec(rootPipelineTask: unknown): ComponentSpecJson | null {
  if (
    typeof rootPipelineTask === "object" &&
    rootPipelineTask !== null &&
    "componentRef" in rootPipelineTask
  ) {
    const ref = (rootPipelineTask as { componentRef: unknown }).componentRef;
    if (typeof ref === "object" && ref !== null && "spec" in ref) {
      return (ref as { spec: ComponentSpecJson }).spec;
    }
  }
  return null;
}

export async function fetchPipeline(
  pipelineId: string,
): Promise<BackendPipeline | null> {
  const response = await fetch(
    `${backendUrl()}/api/pipelines/${encodeURIComponent(pipelineId)}`,
    { headers: { ...authHeader() } },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Failed to fetch pipeline ${pipelineId}: ${response.status} ${response.statusText}`,
    );
  }

  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) return null;

  const filePath = (body as { file_path?: unknown }).file_path;
  const spec = extractSpec(
    (body as { root_pipeline_task?: unknown }).root_pipeline_task,
  );
  if (typeof filePath !== "string" || spec === null) return null;

  return { filePath, spec };
}

export async function writePipeline(
  filePath: string,
  spec: ComponentSpecJson,
): Promise<void> {
  const url = new URL(`${backendUrl()}/api/users/me/pipelines`);
  url.searchParams.set("file_path", filePath);

  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ root_pipeline_task: { componentRef: { spec } } }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to persist pipeline ${filePath}: ${response.status} ${response.statusText}`,
    );
  }
}
