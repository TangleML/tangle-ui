import {
  array,
  boolean,
  type infer as Infer,
  nullish,
  object,
  record,
  safeParse,
  string,
  unknown,
  type ZodMiniType,
} from "zod/mini";

const PROJECTS_PAGE_SIZE = 50;
const MAX_PAGES = 20;

const optionalString = nullish(string());

const projectDto = object({
  id: string(),
  name: string(),
  description: optionalString,
  workspace_id: optionalString,
  data: nullish(record(string(), unknown())),
});

const createdResourceDto = object({ id: string() });

const projectListDto = object({
  projects: array(projectDto),
  next_page_token: optionalString,
});

const workspaceDto = object({
  id: string(),
  name: optionalString,
  is_active: boolean(),
  created_at: string(),
  // The API carries workspace metadata (including `tangentBaseUrl`) under `data`.
  data: nullish(record(string(), unknown())),
});

const workspaceListDto = object({
  workspaces: array(workspaceDto),
});

const resourceDto = object({
  id: string(),
  entity: string(),
  name: optionalString,
  entity_id: optionalString,
  created_at: string(),
});

const resourceListDto = object({
  resources: array(resourceDto),
  next_page_token: optionalString,
});

const currentUserDto = nullish(object({ id: optionalString }));

const UNKNOWN_USER_ID = "Unknown";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string | null;
  metadata: Record<string, unknown>;
}

export interface Workspace {
  id: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface Resource {
  id: string;
  entity: string;
  name: string | null;
  entityId: string | null;
  createdAt: string;
}

type Method = "GET" | "POST" | "PATCH";
type Query = Record<string, string | number | undefined>;

export interface CreateProjectResourceInput {
  entity: string;
  entityId: string;
  name?: string;
}

interface RequestOptions {
  query?: Query;
  body?: unknown;
}

function mapProject(dto: Infer<typeof projectDto>): Project {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? null,
    workspaceId: dto.workspace_id ?? null,
    metadata: dto.data ?? {},
  };
}

function mapWorkspace(dto: Infer<typeof workspaceDto>): Workspace {
  return {
    id: dto.id,
    name: dto.name ?? null,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    metadata: dto.data ?? {},
  };
}

function mapResource(dto: Infer<typeof resourceDto>): Resource {
  return {
    id: dto.id,
    entity: dto.entity,
    name: dto.name ?? null,
    entityId: dto.entity_id ?? null,
    createdAt: dto.created_at,
  };
}

/** Workspaces still accepting new projects, oldest first (the web app's default order). */
export function activeWorkspaces(workspaces: Workspace[]): Workspace[] {
  return workspaces
    .filter((workspace) => workspace.isActive)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * The signed-in user's email from a `GET /api/users/me` body — the identity the
 * web app presents to Tangent — or undefined when the API knows no user.
 */
export function currentUserEmailOf(body: unknown): string | undefined {
  const parsed = safeParse(currentUserDto, body);
  if (!parsed.success) return undefined;
  const id = parsed.data?.id?.trim();
  if (!id || id === UNKNOWN_USER_ID) return undefined;
  return id;
}

/** Reads the Shell base URL a project's workspace advertises, if it has one. */
export function tangentBaseUrlOf(workspace: Workspace): string | null {
  const value = workspace.metadata.tangentBaseUrl;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : null;
}

/** Talks to the Tangle backend REST API (projects, workspaces, resources). */
export class TangleRestClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(baseUrl: string, fetchImpl: typeof fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  async getCurrentUserEmail(): Promise<string | undefined> {
    const body = await this.request("GET", "/api/users/me", unknown());
    return currentUserEmailOf(body);
  }

  async listAllProjects(): Promise<Project[]> {
    const projects: Project[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await this.request("GET", "/api/projects/", projectListDto, {
        query: { page_size: PROJECTS_PAGE_SIZE, page_token: pageToken },
      });
      projects.push(...body.projects.map(mapProject));
      if (!body.next_page_token) break;
      pageToken = body.next_page_token;
    }
    return projects;
  }

  async getProject(projectId: string): Promise<Project> {
    const body = await this.request(
      "GET",
      `/api/projects/${encodeURIComponent(projectId)}`,
      projectDto,
    );
    return mapProject(body);
  }

  async createProject(name: string, workspaceId: string): Promise<Project> {
    const body = await this.request("POST", "/api/projects/", projectDto, {
      body: { name, workspace_id: workspaceId },
    });
    return mapProject(body);
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const body = await this.request(
      "GET",
      "/api/workspaces/",
      workspaceListDto,
    );
    return body.workspaces.map(mapWorkspace);
  }

  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const body = await this.request(
      "GET",
      `/api/workspaces/${encodeURIComponent(workspaceId)}`,
      workspaceDto,
    );
    return mapWorkspace(body);
  }

  async updateProjectMetadata(
    projectId: string,
    metadata: Record<string, unknown>,
  ): Promise<Project> {
    const body = await this.request(
      "PATCH",
      `/api/projects/${encodeURIComponent(projectId)}`,
      projectDto,
      { body: { data: metadata } },
    );
    return mapProject(body);
  }

  async createProjectResource(
    projectId: string,
    input: CreateProjectResourceInput,
  ): Promise<{ id: string }> {
    const body = await this.request(
      "POST",
      `/api/projects/${encodeURIComponent(projectId)}/resources/`,
      createdResourceDto,
      {
        body: {
          entity: input.entity,
          entity_id: input.entityId,
          ...(input.name ? { name: input.name } : {}),
        },
      },
    );
    return { id: body.id };
  }

  async listResources(projectId: string): Promise<Resource[]> {
    const body = await this.request(
      "GET",
      `/api/projects/${encodeURIComponent(projectId)}/resources/`,
      resourceListDto,
      { query: { page_size: 100 } },
    );
    return body.resources.map(mapResource);
  }

  private async request<T>(
    method: Method,
    path: string,
    schema: ZodMiniType<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = {};
    if (options.body !== undefined)
      headers["Content-Type"] = "application/json";
    const response = await this.fetchImpl(url, {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
    }
    const parsed = safeParse(schema, await response.json());
    if (!parsed.success) {
      throw new Error(`${method} ${path} returned an unexpected shape.`);
    }
    return parsed.data;
  }
}
