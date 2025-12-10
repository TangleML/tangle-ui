import pluginJs from "@eslint/js";
import pluginPlaywright from "eslint-plugin-playwright";
import pluginReact from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

import { REACT_COMPILER_ENABLED_GLOBS } from "./react-compiler.config.js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
      "react-compiler/react-compiler": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/ui",
              message:
                "Use absolute imports for '@/components/ui' instead of relative imports.",
            },
          ],
          patterns: [
            {
              group: [
                "**/ui/*",
                "!@/components/ui/*",
                "!**/argo-workflows/ui/*",
              ],
              message:
                "Only '@/components/ui/*' is allowed for importing from the ui folder.",
            },
          ],
        },
      ],
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
      "react-compiler": reactCompiler,
    },
  },
  // React Compiler enabled directories: warn about unnecessary useCallback/useMemo
  {
    files: REACT_COMPILER_ENABLED_GLOBS,
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.name='useCallback']",
          message:
            "useCallback is unnecessary with React Compiler. The compiler auto-memoizes functions.",
        },
        {
          selector: "CallExpression[callee.name='useMemo']",
          message:
            "useMemo may be unnecessary with React Compiler. The compiler auto-memoizes values.",
        },
      ],
    },
  },
  {
    ignores: ["src/api/**/*"],
  },
  // Playwright E2E test rules
  {
    files: ["tests/e2e/**/*.ts"],
    ...pluginPlaywright.configs["flat/recommended"],
    rules: {
      ...pluginPlaywright.configs["flat/recommended"].rules,
      // Enforce Playwright best practices
      "playwright/no-wait-for-timeout": "error", // Prevent page.waitForTimeout()
      "playwright/prefer-web-first-assertions": "error", // Use await expect(element).toBeVisible()
      "playwright/no-conditional-in-test": "warn", // Avoid if/else based on element state
      "playwright/no-standalone-expect": "error", // Ensure expects are awaited
      "playwright/expect-expect": "warn", // Ensure tests have assertions
      "playwright/no-skipped-test": "warn", // Warn about test.skip()
      "@typescript-eslint/no-non-null-assertion": "error", // Prevent non-null assertions (!)
    },
  },
];
