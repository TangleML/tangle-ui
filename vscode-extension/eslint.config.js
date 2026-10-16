import js from "@eslint/js";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", "resources", "*.vsix"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  {
    files: ["src/webview/chat.tsx"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      complexity: ["error", 6],
      "max-depth": ["warn", 3],
      "max-lines-per-function": ["warn", 60],
    },
  },
);
