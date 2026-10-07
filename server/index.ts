import path from "node:path";

import { isCollabStorageMode } from "../src/services/collaboration/serverInfo";
import { FileSystemPipelineRepository } from "./fileSystemPipelineRepository";
import {
  BackendPipelineRepository,
  type PipelineRepository,
} from "./pipelineRepository";
import { createCollabServer } from "./server";

const port = Number(process.env.PORT ?? 8080);
const logFoldAt = Number(process.env.LOG_FOLD_AT ?? 1000);
const storageMode = process.env.COLLAB_STORAGE ?? "ephemeral";
const dataDir = path.resolve(process.env.COLLAB_DATA_DIR ?? "collab-data");

function createRepository(): PipelineRepository {
  if (!isCollabStorageMode(storageMode)) {
    throw new Error(
      `COLLAB_STORAGE must be "ephemeral" or "backend", got "${storageMode}"`,
    );
  }
  return storageMode === "backend"
    ? new BackendPipelineRepository()
    : new FileSystemPipelineRepository(dataDir);
}

function describeStorage(repository: PipelineRepository): string {
  if (repository.mode === "ephemeral") {
    return `ephemeral storage in ${dataDir}`;
  }
  const backendConfigured = Boolean(process.env.COLLAB_BACKEND_URL);
  const authConfigured = Boolean(process.env.TANGENT_MCP_BASIC_AUTH);
  return `backend storage: COLLAB_BACKEND_URL ${
    backendConfigured ? "set" : "missing"
  }, TANGENT_MCP_BASIC_AUTH ${authConfigured ? "set" : "missing"}`;
}

async function main(): Promise<void> {
  const repository = createRepository();
  const server = await createCollabServer({ port, logFoldAt, repository });
  console.log(
    `collab sync server listening on ws://localhost:${server.port} (logFoldAt=${logFoldAt})`,
  );
  console.log(describeStorage(repository));
}

main().catch((error: unknown) => {
  console.error("failed to start collab sync server", error);
  process.exit(1);
});
