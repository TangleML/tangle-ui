import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: {
    path: "http://localhost:8000/openapi.json",
    filters: {
      operations: { include: ["POST /api/pipelines/search"] },
      orphans: false,
    },
  },
  output: { path: "src/api/remotePipelines", clean: false },
  plugins: [
    { name: "@hey-api/client-fetch", bundle: false },
    "@hey-api/typescript",
    { name: "@hey-api/sdk", client: false },
  ],
});
