// Bundles the TUI into a single ESM file with a Node shebang. The `@tangent/*`
// packages ship raw TypeScript, so they must be bundled (esbuild transpiles
// them); Ink, React, and the terminal-markdown stack stay external because they
// are ESM-only and pull in wasm/native deps that should load from node_modules.
import { chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build, context } from "esbuild";

const dir = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(dir, "dist", "tangent-tui.mjs");
const watch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: [path.join(dir, "src", "main.tsx")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  jsx: "automatic",
  outfile,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
  // Loaded from node_modules at runtime rather than inlined: Ink (yoga wasm)
  // and its React peer must stay a single instance, marked-terminal pulls in
  // CJS highlighters that bundle poorly, and socket.io-client's CJS transport
  // deps use dynamic `require` that an ESM bundle cannot shim. The ws native
  // add-ons are optional and loaded via try/catch.
  external: [
    "react",
    "react/jsx-runtime",
    "ink",
    "marked",
    "marked-terminal",
    "open",
    "socket.io-client",
    "bufferutil",
    "utf-8-validate",
  ],
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("[build:tui] watching");
} else {
  await build(options);
  await chmod(outfile, 0o755);
  console.log("[build:tui] bundled to dist/tangent-tui.mjs");
}
