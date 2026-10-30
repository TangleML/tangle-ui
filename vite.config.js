import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { spawn } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
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

// `@openai/agents-core` only exposes `.` and `./_shims` in its
// `exports` map — the raw `dist/shims/shims-browser.mjs` subpath is
// not exported, so `require.resolve` on it fails. Resolve the public
// root entry and walk to the sibling browser shim file inside the
// package.
const agentsCoreBrowserShim = path.resolve(
  path.dirname(require.resolve("@openai/agents-core")),
  "shims/shims-browser.mjs",
);

function isExtensionArtifactCurrent(outputDir, name, vsixFilename, version) {
  const manifestPath = path.join(outputDir, "latest.json");
  const requiredFiles = [
    manifestPath,
    path.join(outputDir, vsixFilename),
    path.join(outputDir, `${name}.vsix`),
  ];
  if (requiredFiles.some((file) => !existsSync(file))) return false;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return manifest.version === version && manifest.filename === vsixFilename;
  } catch {
    return false;
  }
}

// Compiles the Tangent Local Agent extension to a `.vsix` and publishes it,
// its install scripts, and a version manifest under `public/extension/` so the
// app serves them from its own origin (`/extension/*`). A production build
// (`vite build`) always builds it and fails if it fails. The dev server never
// blocks on it: the build is opt-in there via `BUILD_VSCODE_EXTENSION=true`, in
// which case it runs in the background. Either way the rebuild is skipped when
// the published artifacts already match the extension's declared version. The
// extension's own `package` script shells out to esbuild and `@vscode/vsce`.
function tangleVscodeExtension() {
  const extensionDir = path.resolve(__dirname, "vscode-extension");
  const outputDir = path.resolve(__dirname, "public/extension");
  const manifestPath = path.join(extensionDir, "package.json");

  const buildInDev = process.env.BUILD_VSCODE_EXTENSION === "true";
  let command = "serve";
  let failedVersion;
  let building = false;

  const run = (args) =>
    new Promise((resolve, reject) => {
      // `shell: true` so Windows resolves the `pnpm.cmd` shim; async spawn so a
      // long build never blocks Vite's event loop.
      const child = spawn("pnpm", args, {
        cwd: extensionDir,
        stdio: "inherit",
        shell: true,
      });
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(`pnpm ${args.join(" ")} exited with code ${code}`),
            ),
      );
    });

  const buildArtifacts = async () => {
    const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
    const { name, version } = pkg;
    const vsixFilename = `${name}-${version}.vsix`;

    if (isExtensionArtifactCurrent(outputDir, name, vsixFilename, version)) {
      return false;
    }
    // A previous attempt for this exact version already failed; don't re-run the
    // install/package toolchain until the declared version changes.
    if (failedVersion === version) return false;

    try {
      await run(["install", "--frozen-lockfile"]);
      await run(["package"]);
    } catch (error) {
      failedVersion = version;
      throw error;
    }

    mkdirSync(outputDir, { recursive: true });

    const builtVsix = path.join(extensionDir, vsixFilename);
    copyFileSync(builtVsix, path.join(outputDir, vsixFilename));
    copyFileSync(builtVsix, path.join(outputDir, `${name}.vsix`));

    for (const script of ["install.sh", "install.ps1"]) {
      const src = path.join(extensionDir, script);
      if (existsSync(src)) {
        copyFileSync(src, path.join(outputDir, script));
      }
    }

    writeFileSync(
      path.join(outputDir, "latest.json"),
      `${JSON.stringify(
        {
          version,
          filename: vsixFilename,
          url: `/extension/${vsixFilename}`,
        },
        null,
        2,
      )}\n`,
    );

    failedVersion = undefined;
    return true;
  };

  // A failed extension build must not fail the web app's build or stall its dev
  // server, so log and keep going with whatever artifact is already published.
  const buildOnce = async (log) => {
    if (building) return false;
    building = true;
    try {
      return await buildArtifacts();
    } catch (error) {
      log(`[tangle-vscode-extension] build failed: ${error.message}`);
      return false;
    } finally {
      building = false;
    }
  };

  return {
    name: "tangle-vscode-extension",
    configResolved(config) {
      command = config.command;
    },
    // Only a production build blocks here, and it fails the build on error. In
    // dev, `buildStart` is awaited before the server listens, so building here
    // would stall `pnpm start`; the background loop in `configureServer` handles
    // dev instead.
    async buildStart() {
      if (command !== "build") return;
      await buildArtifacts();
    },
    // A bump to this nested, non-imported manifest is invisible to Vite's dev
    // watcher (it only tracks the module graph, config, and publicDir, and
    // `server.watcher.add` does not bring it in). Poll the staleness guard
    // instead, which is a cheap stat+parse until the declared version changes.
    configureServer(server) {
      if (!buildInDev) return;
      const interval = setInterval(() => {
        void buildOnce((message) => server.config.logger.error(message)).then(
          (rebuilt) => {
            if (rebuilt) server.hot.send({ type: "full-reload" });
          },
        );
      }, 2000);
      server.httpServer?.once("close", () => clearInterval(interval));
    },
  };
}

export default defineConfig(({ mode }) => {
  if (mode === "test") process.env.TZ = "America/New_York";
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
      ...(mode === "test" ? [] : [tangleVscodeExtension()]),
      viteReact(),
      babel({
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
    experimental: {
      // Deploy base is unknown at build time: production serves assets from
      // the origin root, tophat from a CDN subpath. Emit in-bundle asset
      // URLs (notably the `?worker&url` scripts) as `import.meta.url`-relative
      // so they resolve against the chunk location instead of an absolute
      // `/assets/...` path that drops the tophat prefix. See
      // `src/utils/createCrossOriginWorker.ts`.
      renderBuiltUrl(filename, { hostType }) {
        if (hostType === "js") {
          return { relative: true };
        }
        return { relative: false };
      },
    },
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
    // handled by the `globalThis.process` stub at the top of
    // `src/agent/worker.ts`, not here, so the fix applies in both
    // `vite build` and `vite serve` (dev) modes.
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
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./vitest-setup.js"],
      include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.{test,spec}.{ts,tsx}",
          "src/**/*.d.ts",
          "src/api/*.gen.ts",
        ],
      },
    },
    optimizeDeps: {
      exclude: [
        "lucide-react",
        "@tangent/embed-react",
        "@tangent/remote-subagent",
        "@tangent/shared",
      ],
      // `@tangent/remote-subagent` is served as source (excluded above), so
      // Vite's dep scanner never reaches its transitive `socket.io-client`.
      // Force-include it (and its CJS `debug` dependency) so esbuild
      // pre-bundles them with proper CJS->ESM interop — otherwise `debug`'s
      // browser build is served raw and its missing `default` export throws
      // at runtime.
      include: ["socket.io-client"],
    },
  };
});
