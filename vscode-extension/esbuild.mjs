// Bundles the extension into a single CommonJS file the VS Code extension host
// loads, plus the session chat webview as a browser ES module. `@tangent/*`
// packages, socket.io-client, and React are inlined, so the packaged .vsix
// needs no node_modules.
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build, context } from "esbuild";

const extensionDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(extensionDir, "dist");
const watch = process.argv.includes("--watch");

// The OktaSSO gate is configured through the repo-root `.env`; values already
// present in the build shell win, so CI can inject them without a file.
try {
  process.loadEnvFile(path.join(extensionDir, "..", ".env"));
} catch {
  // No `.env` — the gate stays disabled unless the keys are set some other way.
}

const OKTASSO_ENV_KEYS = [
  "VITE_OKTASSO_ENABLED",
  "VITE_OKTASSO_OAUTH_ENDPOINT_BASE",
  "VITE_OKTASSO_TOKEN_EXCHANGE_URL",
  "VITE_OKTASSO_CLIENT_ID",
  "VITE_OKTASSO_TOKEN_COOKIE_NAME",
  "VITE_OKTASSO_SCOPES",
  "VITE_OKTASSO_REDIRECT_URI",
  "VITE_OKTASSO_CALLBACK_PORT",
  "VITE_OKTASSO_REFRESH_AFTER_MS",
];

const oktassoDefine = Object.fromEntries(
  OKTASSO_ENV_KEYS.map((key) => [
    `process.env.${key}`,
    JSON.stringify(process.env[key] ?? ""),
  ]),
);

/** @type {import("esbuild").BuildOptions} */
const extensionOptions = {
  entryPoints: [path.join(extensionDir, "src", "extension.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: path.join(distDir, "extension.cjs"),
  sourcemap: true,
  define: oktassoDefine,
  // `vscode` is provided by the extension host; the ws native add-ons are
  // optional and loaded behind a try/catch.
  external: ["vscode", "bufferutil", "utf-8-validate"],
};

// ESM, so the embed runtime's dynamic `import()` of the Shell's module works.
/** @type {import("esbuild").BuildOptions} */
const webviewOptions = {
  entryPoints: [path.join(extensionDir, "src", "webview", "chat.tsx")],
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  outfile: path.join(distDir, "chat.js"),
  sourcemap: true,
  minify: !watch,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
};

// pi loads these extensions from disk at spawn time, so they ship unbundled,
// sourced from @tangent/local-agent-host so there is a single copy.
async function copyPiExtensions() {
  await mkdir(distDir, { recursive: true });
  await Promise.all(
    ["proxyProvider.ts", "sessionResources.ts"].map((file) =>
      copyFile(
        fileURLToPath(
          import.meta.resolve(`@tangent/local-agent-host/resources/${file}`),
        ),
        path.join(distDir, file),
      ),
    ),
  );
}

await copyPiExtensions();
if (watch) {
  const contexts = await Promise.all(
    [extensionOptions, webviewOptions].map((options) => context(options)),
  );
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("[build:vscode-extension] watching");
} else {
  await Promise.all([build(extensionOptions), build(webviewOptions)]);
  console.log(
    "[build:vscode-extension] bundled to dist/extension.cjs and dist/chat.js",
  );
}
