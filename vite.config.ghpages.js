import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [viteReact(), tailwindcss()],
  // Set base path for GitHub Pages deployment
  // This ensures all assets and routes are prefixed with /pipeline-studio-app/
  base: "/tangle-ui/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Configure preview server
  preview: {
    port: 4173,
    strictPort: false,
    host: "localhost",
    open: "/tangle-ui/", // Auto-open browser at the correct path
  },
  // Build configuration optimized for GitHub Pages
  build: {
    // Output directory (default: dist)
    outDir: "dist",
    // Ensure relative asset paths within the base path
    assetsDir: "assets",
    // Configure rollup for proper asset handling
    rollupOptions: {
      output: {
        // Consistent naming for chunks and assets
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: ({ name }) => {
          // Organize assets by type
          if (/\.(gif|jpe?g|png|svg|ico|webp)$/.test(name ?? "")) {
            return "assets/images/[name]-[hash][extname]";
          }
          if (/\.css$/.test(name ?? "")) {
            return "assets/css/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    // Ensure source maps for debugging
    sourcemap: true,
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
});
