import {
  array,
  type infer as Infer,
  object,
  optional,
  safeParse,
  string,
  type ZodMiniType,
} from "zod/mini";

import type { HostResourceInput, MemoryBinding } from "./sessionSeed.ts";

const sessionDto = object({
  id: string(),
  name: string(),
  tags: optional(array(string())),
});

const sessionEnvelope = object({ session: sessionDto });
const sessionListEnvelope = object({ sessions: array(sessionDto) });

const sharedFolderEnvelope = object({ folder: object({ id: string() }) });

export interface Session {
  id: string;
  name: string;
  tags: string[];
}

export interface CreateSessionOptions {
  bundleId: string;
  projectId: string;
  name?: string;
  resources?: HostResourceInput[];
  env?: Record<string, string>;
  memory?: MemoryBinding;
}

type Method = "GET" | "POST";

export function projectSelectorTag(projectId: string): string {
  return `projectId:${projectId}`;
}

function mapSession(dto: Infer<typeof sessionDto>): Session {
  return { id: dto.id, name: dto.name, tags: dto.tags ?? [] };
}

/** The Shell's session + bundle REST API, authenticated by the SSO cookie. */
export class ShellClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(baseUrl: string, fetchImpl: typeof fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  async listSessions(): Promise<Session[]> {
    const body = await this.request(
      "GET",
      "/api/sessions",
      sessionListEnvelope,
    );
    return body.sessions.map(mapSession);
  }

  async listSessionsByProject(projectId: string): Promise<Session[]> {
    const tag = projectSelectorTag(projectId);
    const sessions = await this.listSessions();
    return sessions.filter((session) => session.tags.includes(tag));
  }

  async createSharedFolder(name?: string): Promise<string> {
    const body = await this.request(
      "POST",
      "/api/shared-folders",
      sharedFolderEnvelope,
      name ? { name } : {},
    );
    return body.folder.id;
  }

  async createSession(options: CreateSessionOptions): Promise<Session> {
    const body = await this.request("POST", "/api/sessions", sessionEnvelope, {
      bundleId: options.bundleId,
      tags: [projectSelectorTag(options.projectId)],
      ...(options.name ? { name: options.name } : {}),
      ...(options.resources ? { resources: options.resources } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.memory ? { memory: options.memory } : {}),
    });
    return mapSession(body.session);
  }

  private async request<T>(
    method: Method,
    path: string,
    schema: ZodMiniType<T>,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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
