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

A throwaway, in-memory WebSocket sequencer for the collaboration proof of concept. Do not deploy
it anywhere reachable: there is no auth, no persistence, and no rate limiting.

## Run

\`\`\`
node index.js
\`\`\`

## Config

- \`PORT\` — the port to listen on (default 8080).
- \`LOG_FOLD_AT\` — fold the per-room command log once it passes this many entries (default 1000).
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
