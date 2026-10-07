import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

const outDir = path.resolve(process.cwd(), "dist-server");

const runtimePackageJson = {
  name: "collab-sync-server",
  version: "0.0.0",
  private: true,
  type: "module",
  main: "index.js",
  scripts: {
    start: "node index.js",
  },
};

const runReadme = `# Collaboration PoC sync server

A throwaway WebSocket sequencer for the collaboration proof of concept. Do not deploy it anywhere
reachable: there is no auth and no rate limiting.

## Run

\`\`\`
node index.js
\`\`\`

## Config

- \`PORT\` — the port to listen on (default 8080). HTTP (\`GET /info\`, \`POST /rooms\`) and
  WebSocket share it.
- \`LOG_FOLD_AT\` — fold the per-room command log once it passes this many entries (default 1000).
- \`COLLAB_STORAGE\` — \`ephemeral\` (default) keeps room pipelines as JSON files on this machine and
  never calls the backend; \`backend\` seeds and persists rooms through the Backend Pipelines API.
- \`COLLAB_DATA_DIR\` — directory for ephemeral room files (default \`./collab-data\`).
- \`COLLAB_BACKEND_URL\`, \`TANGENT_MCP_BASIC_AUTH\` — backend location and credentials, used only in
  \`backend\` mode.
`;

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await build({
    entryPoints: ["server/index.ts"],
    outfile: path.join(outDir, "index.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    alias: { "@": path.resolve(process.cwd(), "src") },
    external: ["bufferutil", "utf-8-validate"],
    banner: {
      js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
    },
  });
  await writeFile(
    path.join(outDir, "package.json"),
    `${JSON.stringify(runtimePackageJson, null, 2)}\n`,
  );
  await writeFile(path.join(outDir, "README.md"), runReadme);
  console.log(`bundled collab sync server into ${outDir}`);
}

void main();
