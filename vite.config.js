import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import { BugsnagSourceMapUploaderPlugin } from "vite-plugin-bugsnag";

import { REACT_COMPILER_ENABLED_DIRS } from "./react-compiler.config.js";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);

// `@openai/agents-core` only exposes `.` and `./_shims` in its `exports`
// map — the raw `dist/shims/shims-browser.mjs` subpath is not exported,
// so `require.resolve` on it fails. Resolve the public root entry and
// walk to the sibling browser shim file inside the package.
const agentsCoreBrowserShim = path.resolve(
  path.dirname(require.resolve("@openai/agents-core")),
  "shims/shims-browser.mjs",
);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const apiKey = env.VITE_BUGSNAG_API_KEY;
  const appVersion = env.VITE_GIT_COMMIT ?? "dev";
  const appUrl = process.env.APP_URL;
  const sourceMapEndpoint = process.env.BUGSNAG_SOURCE_MAP_ENDPOINT;

  const uploadSourcemaps = Boolean(apiKey && appUrl && sourceMapEndpoint);

  const bugsnagConfig = {
    apiKey,
    appVersion,
    endpoint: sourceMapEndpoint,
  };

  return {
    plugins: [
      viteReact({
        babel: {
          plugins: [
            ["@babel/plugin-proposal-decorators", { version: "2023-11" }],
            [
              "babel-plugin-react-compiler",
              {
                sources: (filename) => {
                  return REACT_COMPILER_ENABLED_DIRS.some((dir) =>
                    filename.includes(dir),
                  );
                },
              },
            ],
          ],
        },
      }),
      tailwindcss(),
      ...(uploadSourcemaps
        ? [
            BugsnagSourceMapUploaderPlugin({
              ...bugsnagConfig,
              base: appUrl,
              overwrite: true,
            }),
          ]
        : []),
    ],
    base: "/",
    build: {
      manifest: "assets-registry.json",
      sourcemap: "hidden",
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "index.html"),
          main: path.resolve(__dirname, "src/index.tsx"),
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // The agent runs in a Web Worker. `@openai/agents-core/_shims`
    // exposes a `browser` export condition, but Vite's worker bundle
    // does not reliably apply it — the catch-all condition falls
    // through to the Node shim that imports `node:process`. We force
    // the browser variant via a scoped `resolveId`, kept here so the
    // main bundle (which already resolves correctly via export
    // conditions) is not affected.
    //
    // The runtime side of "no Node in the worker" — specifically the
    // unguarded `process.env.X` read in `@openai/agents-core` — is
    // handled by `src/agent/polyfills.ts`, not here, so the fix
    // applies in both `vite build` and `vite serve` (dev) modes.
    //
    // `debug` (transitive of `@openai/agents-core`) is handled
    // automatically by its package.json `browser` field, which Vite
    // does honor for the worker bundle.
    worker: {
      format: "es",
      plugins: () => [
        {
          name: "tangle-agent-worker-shims",
          enforce: "pre",
          resolveId(id) {
            if (id === "@openai/agents-core/_shims") {
              return agentsCoreBrowserShim;
            }
            return null;
          },
        },
      ],
    },
    assetsInclude: ["**/*.yaml", "**/*.py"],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./vitest-setup.js"],
      include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        exclude: [
          "node_modules/",
          "test/",
          "tests/",
          "tests/e2e/",
          "*.test.tsx",
          "*.test.ts",
          "*.d.ts",
        ],
      },
    },
    optimizeDeps: {
      exclude: ["lucide-react"],
    },
  };
});
