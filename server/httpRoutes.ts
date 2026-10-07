import type { IncomingMessage, ServerResponse } from "node:http";

import type { ComponentSpecJson } from "../src/models/componentSpec/entities/types";
import {
  COLLAB_HTTP_ROUTES,
  type CollabServerInfo,
  type CreateRoomResponse,
} from "../src/services/collaboration/serverInfo";
import { specToCollabSnapshot } from "./csom";
import { FileSystemPipelineRepository } from "./fileSystemPipelineRepository";
import type { PipelineRepository } from "./pipelineRepository";

const MAX_BODY_BYTES = 5 * 1024 * 1024;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function isSpecPayload(value: unknown): value is { spec: ComponentSpecJson } {
  return (
    typeof value === "object" &&
    value !== null &&
    "spec" in value &&
    typeof value.spec === "object" &&
    value.spec !== null &&
    "implementation" in value.spec
  );
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, "request body too large");
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid JSON");
  }
}

async function createRoom(
  request: IncomingMessage,
  repository: FileSystemPipelineRepository,
): Promise<CreateRoomResponse> {
  const body = await readJsonBody(request);
  if (!isSpecPayload(body)) {
    throw new HttpError(400, "expected a { spec } body");
  }
  try {
    specToCollabSnapshot(body.spec);
  } catch {
    throw new HttpError(400, "spec cannot be loaded as a pipeline");
  }
  return { roomId: await repository.create(body.spec) };
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  repository: PipelineRepository,
): Promise<void> {
  if (request.method === "OPTIONS") {
    response.writeHead(204, CORS_HEADERS);
    response.end();
    return;
  }

  const { pathname } = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && pathname === COLLAB_HTTP_ROUTES.info) {
    const info: CollabServerInfo = { storage: repository.mode };
    sendJson(response, 200, info);
    return;
  }

  if (
    request.method === "POST" &&
    pathname === COLLAB_HTTP_ROUTES.rooms &&
    repository instanceof FileSystemPipelineRepository
  ) {
    sendJson(response, 201, await createRoom(request, repository));
    return;
  }

  throw new HttpError(404, "not found");
}

export function createHttpHandler(repository: PipelineRepository) {
  return (request: IncomingMessage, response: ServerResponse): void => {
    route(request, response, repository).catch((error: unknown) => {
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      console.warn("failed to handle HTTP request", error);
      sendJson(response, 500, { error: "internal error" });
    });
  };
}
