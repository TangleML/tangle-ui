import { createCollabServer } from "./server";

const port = Number(process.env.PORT ?? 8080);
const logFoldAt = Number(process.env.LOG_FOLD_AT ?? 1000);

createCollabServer({ port, logFoldAt })
  .then((server) => {
    console.log(
      `collab sync server listening on ws://localhost:${server.port} (logFoldAt=${logFoldAt})`,
    );
  })
  .catch((error: unknown) => {
    console.error("failed to start collab sync server", error);
    process.exit(1);
  });
