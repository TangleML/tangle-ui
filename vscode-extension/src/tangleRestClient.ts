import {
  array,
  type infer as Infer,
  nullish,
  number,
  object,
  record,
  string,
  unknown,
  type ZodMiniType,
} from "zod/mini";

import type { CookieProvider } from "./auth/oktaSsoAuth.ts";

const PROJECTS_PAGE_SIZE = 50;
const RESOURCES_PAGE_SIZE = 100;
const MAX_PAGES = 10;

const optionalString = nullish(string());
const optionalCounts = nullish(record(string(), number()));

const projectDto = object({
  id: string(),
  name: string(),
  description: optionalString,
  created_by: optionalString,
  updated_at: optionalString,
  resource_counts: optionalCounts,
});

const projectListDto = object({
  projects: array(projectDto),
  next_page_token: optionalString,
});

const projectRunDto = object({
  id: string(),
  root_execution_id: string(),
  pipeline_name: optionalString,
  created_by: optionalString,
  created_at: optionalString,
});

const projectRunListDto = object({
  runs: array(projectRunDto),
  next_page_token: optionalString,
});

const runStatsDto = object({
  execution_status_stats: optionalCounts,
});

const resourceDto = object({
  id: string(),
  entity: string(),
  name: optionalString,
  entity_id: optionalString,
  data: nullish(record(string(), unknown())),
  created_by: optionalString,
  created_at: string(),
  updated_at: string(),
});

const resourceListDto = object({
  resources: array(resourceDto),
  next_page_token: optionalString,
});

export type ResourceEntity = "pipeline" | "agent_session" | "document";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  updatedAt: Date | null;
  resourceCounts: Record<string, number>;
}

export interface ProjectRun {
  id: string;
  rootExecutionId: string;
  pipelineName: string | null;
  createdBy: string | null;
  createdAt: Date | null;
}

export interface ProjectResource {
  id: string;
  entity: string;
  name: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateResourceInput {
  entity: ResourceEntity;
  entityId?: string;
  name?: string;
}

export interface Page<T> {
  items: T[];
  nextPageToken: string | null;
}

type QueryValue = string | number | boolean | string[] | undefined;
type Query = Record<string, QueryValue>;
type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  query?: Query;
  body?: unknown;
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function mapProject(dto: Infer<typeof projectDto>): ProjectSummary {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? null,
    createdBy: dto.created_by ?? null,
    updatedAt: toDate(dto.updated_at),
    resourceCounts: dto.resource_counts ?? {},
  };
}

function mapProjectRun(dto: Infer<typeof projectRunDto>): ProjectRun {
  return {
    id: dto.id,
    rootExecutionId: dto.root_execution_id,
    pipelineName: dto.pipeline_name ?? null,
    createdBy: dto.created_by ?? null,
    createdAt: toDate(dto.created_at),
  };
}

function mapResource(dto: Infer<typeof resourceDto>): ProjectResource {
  return {
    id: dto.id,
    entity: dto.entity,
    name: dto.name ?? null,
    entityId: dto.entity_id ?? null,
    metadata: dto.data ?? null,
    createdBy: dto.created_by ?? null,
    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
  };
}

function appendQuery(url: URL, query: Query): void {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    const values = Array.isArray(value) ? value : [String(value)];
    for (const item of values) url.searchParams.append(key, item);
  }
}

/** Follows page tokens until the last page, capped so a runaway list stops. */
export async function collectPages<T>(
  fetchPage: (pageToken?: string) => Promise<Page<T>>,
  maxPages = MAX_PAGES,
): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(pageToken);
    items.push(...result.items);
    if (!result.nextPageToken) break;
    pageToken = result.nextPageToken;
  }
  return items;
}

export function normalizeBaseUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Use an http:// or https:// URL.");
  }
  return url.toString().replace(/\/+$/, "");
}

/**
 * Talks to the Tangle backend REST API the web app uses. The web app's
 * generated client depends on its React providers, so the few endpoints the
 * extension needs are called directly here.
 */
export class TangleRestClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly cookieProvider: CookieProvider | undefined;

  constructor(
    baseUrl: string,
    token?: string,
    cookieProvider?: CookieProvider,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token;
    this.cookieProvider = cookieProvider;
  }

  async listProjects(pageToken?: string): Promise<Page<ProjectSummary>> {
    const body = await this.request("GET", "/api/projects/", projectListDto, {
      query: { page_size: PROJECTS_PAGE_SIZE, page_token: pageToken },
    });
    return {
      items: body.projects.map(mapProject),
      nextPageToken: body.next_page_token ?? null,
    };
  }

  listAllProjects(): Promise<ProjectSummary[]> {
    return collectPages((pageToken) => this.listProjects(pageToken));
  }

  async getProject(projectId: string): Promise<ProjectSummary> {
    const body = await this.request(
      "GET",
      `/api/projects/${encodeURIComponent(projectId)}`,
      projectDto,
    );
    return mapProject(body);
  }

  async listProjectRuns(
    projectId: string,
    pageToken?: string,
  ): Promise<Page<ProjectRun>> {
    const body = await this.request(
      "GET",
      `/api/projects/${encodeURIComponent(projectId)}/runs`,
      projectRunListDto,
      { query: { page_token: pageToken } },
    );
    return {
      items: body.runs.map(mapProjectRun),
      nextPageToken: body.next_page_token ?? null,
    };
  }

  /** Per-status task counts for a run, or `null` when the backend has none. */
  async getRunStats(runId: string): Promise<Record<string, number> | null> {
    const body = await this.request(
      "GET",
      `/api/pipeline_runs/${encodeURIComponent(runId)}`,
      runStatsDto,
      { query: { include_execution_stats: true } },
    );
    return body.execution_status_stats ?? null;
  }

  async listResources(
    projectId: string,
    options: { entity?: ResourceEntity[]; pageToken?: string } = {},
  ): Promise<Page<ProjectResource>> {
    const body = await this.request(
      "GET",
      this.resourcesPath(projectId),
      resourceListDto,
      {
        query: {
          entity: options.entity,
          page_size: RESOURCES_PAGE_SIZE,
          page_token: options.pageToken,
        },
      },
    );
    return {
      items: body.resources.map(mapResource),
      nextPageToken: body.next_page_token ?? null,
    };
  }

  listAllResources(
    projectId: string,
    entity?: ResourceEntity[],
  ): Promise<ProjectResource[]> {
    return collectPages((pageToken) =>
      this.listResources(projectId, { entity, pageToken }),
    );
  }

  async createResource(
    projectId: string,
    input: CreateResourceInput,
  ): Promise<ProjectResource> {
    const body = await this.request(
      "POST",
      this.resourcesPath(projectId),
      resourceDto,
      {
        body: {
          entity: input.entity,
          entity_id: input.entityId ?? null,
          name: input.name ?? null,
        },
      },
    );
    return mapResource(body);
  }

  async renameResource(
    projectId: string,
    resourceId: string,
    name: string,
  ): Promise<ProjectResource> {
    const body = await this.request(
      "PATCH",
      this.resourcePath(projectId, resourceId),
      resourceDto,
      { body: { name } },
    );
    return mapResource(body);
  }

  async deleteResource(projectId: string, resourceId: string): Promise<void> {
    await this.send("DELETE", this.resourcePath(projectId, resourceId));
  }

  private resourcesPath(projectId: string): string {
    return `/api/projects/${encodeURIComponent(projectId)}/resources/`;
  }

  private resourcePath(projectId: string, resourceId: string): string {
    return `${this.resourcesPath(projectId)}${encodeURIComponent(resourceId)}`;
  }

  private async request<T>(
    method: Method,
    path: string,
    schema: ZodMiniType<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await this.send(method, path, options);
    return schema.parse(await response.json());
  }

  private async send(
    method: Method,
    path: string,
    { query = {}, body }: RequestOptions = {},
  ): Promise<Response> {
    const url = new URL(`${this.baseUrl}${path}`);
    appendQuery(url, query);
    const response = await this.sendWithAuthRetry(url, method, body);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
    }
    return response;
  }

  /**
   * On a 401 the cookie is refreshed once and the call replayed, but only when
   * the refresh yields a cookie; a silent-miss (`undefined`) surfaces the 401
   * rather than resending without one.
   */
  private async sendWithAuthRetry(
    url: URL,
    method: Method,
    body: unknown,
  ): Promise<Response> {
    const response = await this.fetch(url, method, body, await this.cookie());
    if (response.status !== 401 || !this.cookieProvider) return response;
    const refreshed = await this.cookieProvider({ forceRefresh: true });
    return refreshed ? this.fetch(url, method, body, refreshed) : response;
  }

  private cookie(): Promise<string | undefined> {
    return this.cookieProvider?.() ?? Promise.resolve(undefined);
  }

  private async fetch(
    url: URL,
    method: Method,
    body: unknown,
    cookie: string | undefined,
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    try {
      return await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(`Cannot reach the Tangle API at ${this.baseUrl}`, {
        cause: err,
      });
    }
  }
}
