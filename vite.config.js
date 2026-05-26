import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import { BugsnagSourceMapUploaderPlugin } from "vite-plugin-bugsnag";

import { REACT_COMPILER_ENABLED_DIRS } from "./react-compiler.config.js";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    assetsInclude: ["**/*.yaml", "**/*.py"],
    // The agent runs in a Web Worker. The `@openai/agents-core/_shims`
    // alias and matching plugin land in PR 3 alongside the SDK
    // dependency itself; PR 2 only needs ESM output for the worker
    // bundle so dynamic `import.meta.url` resolves correctly.
    worker: {
      format: "es",
    },
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
