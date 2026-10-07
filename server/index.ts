import { createCollabServer } from "./server";

const port = Number(process.env.PORT ?? 8080);
const logFoldAt = Number(process.env.LOG_FOLD_AT ?? 1000);

const backendConfigured = Boolean(process.env.COLLAB_BACKEND_URL);
const authConfigured = Boolean(process.env.TANGENT_MCP_BASIC_AUTH);

createCollabServer({ port, logFoldAt })
  .then((server) => {
    console.log(
      `collab sync server listening on ws://localhost:${server.port} (logFoldAt=${logFoldAt})`,
    );
    console.log(
      `backend seeding/persistence: COLLAB_BACKEND_URL ${
        backendConfigured ? "set" : "missing"
      }, TANGENT_MCP_BASIC_AUTH ${authConfigured ? "set" : "missing"}`,
    );
  })
  .catch((error: unknown) => {
    console.error("failed to start collab sync server", error);
    process.exit(1);
  });
