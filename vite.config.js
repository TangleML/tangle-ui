import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

import { REACT_COMPILER_ENABLED_DIRS } from "./react-compiler.config.js";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    viteReact({
      babel: {
        plugins: [
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
  ],
  base: "/",
  build: {
    manifest: "assets-registry.json",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
});
