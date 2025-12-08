import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// React Compiler: Directory-based incremental adoption
// Add directories here as they are cleaned up for compiler compatibility
const REACT_COMPILER_ENABLED_DIRS = [
  "src/components/Home",

  // Add more directories as you clean them up:
  // "src/components/shared/",
  // "src/hooks/",
];

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
