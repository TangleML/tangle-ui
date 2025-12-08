import process from "node:process";

import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

import { REACT_COMPILER_ENABLED_DIRS } from "./react-compiler.config.js";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set DISABLE_REACT_COMPILER=true to test without compiler
// Note: use process.env here (not import.meta.env) since config runs in Node before Vite starts
const isCompilerEnabled = process.env.DISABLE_REACT_COMPILER !== "true";

export default defineConfig({
  plugins: [
    viteReact({
      babel: {
        plugins: isCompilerEnabled
          ? [
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
            ]
          : [],
      },
    }),
    tailwindcss(),
  ],
  base: "/",
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
