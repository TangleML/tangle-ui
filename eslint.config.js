import pluginJs from "@eslint/js";
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths";
import pluginPlaywright from "eslint-plugin-playwright";
import pluginReact from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

import tangleUi from "./eslint-rules/index.js";
import { REACT_COMPILER_ENABLED_GLOBS } from "./react-compiler.config.js";

/**
 * Primitive components whose `className` prop is being phased out. The ESLint rule
 * `tangle-ui/no-classname-on-primitives` warns on any usage; once all sites are
 * migrated the rule is promoted to `error` and the prop is removed from each
 * primitive's type. See `.local/.../ban-classname-on-primitives` plan.
 */
const BANNED_CLASSNAME_PRIMITIVES = [
  "BlockStack",
  "InlineStack",
  "Text",
  "Paragraph",
  "Heading",
  "Button",
  "Icon",
  "IconButton",
  "Surface",
  "Section",
  "Card",
  "CardHeader",
  "CardContent",
  "CardFooter",
  "CardTitle",
  "CardDescription",
  "ScrollRegion",
  "Truncating",
  "Toolbar",
  "ListRow",
  "ZebraList",
  "HoverReveal",
  "EmptyState",
  "StickyHeader",
  "Pill",
  "FieldRow",
  "Divider",
  "TabsList",
  "TabsTrigger",
  "TabsContent",
  "Label",
  "Skeleton",
  "TableHead",
  "TableCell",
];

const baseRestrictedImportPaths = [
  {
    name: "@/components/ui",
    message:
      "Use absolute imports for '@/components/ui' instead of relative imports.",
  },
];

const baseRestrictedImportPatterns = [
  {
    group: ["**/ui/*", "!@/components/ui/*", "!**/argo-workflows/ui/*"],
    message:
      "Only '@/components/ui/*' is allowed for importing from the ui folder.",
  },
];

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
          paths: baseRestrictedImportPaths,
          patterns: baseRestrictedImportPatterns,
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
    files: ["src/routes/v2/**/*.{ts,tsx}"],
    plugins: {
      "no-relative-import-paths": noRelativeImportPaths,
      "tangle-ui": tangleUi,
    },
    rules: {
      "no-relative-import-paths/no-relative-import-paths": [
        "error",
        {
          allowSameFolder: true,
          rootDir: "src",
          prefix: "@",
        },
      ],
      // Forbid className on Tangle UI primitives and the new layer-3 patterns.
      // Soft-warn on Box imports (Box is the low-level escape hatch).
      //
      // Severity is "warn" today. To promote to "error" once `pnpm lint`
      // reports 0 className warnings, change the severity below and delete the
      // `className?: string` field from each primitive's type (see plan
      // `.local/.../ban-classname-on-primitives`).
      "tangle-ui/no-classname-on-primitives": [
        "warn",
        {
          components: BANNED_CLASSNAME_PRIMITIVES,
          softBanned: ["Box"],
        },
      ],
    },
  },
  // v2 Architecture boundary: shared/ must not import from any page
  {
    files: ["src/routes/v2/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: baseRestrictedImportPaths,
          patterns: [
            ...baseRestrictedImportPatterns,
            {
              group: ["@/routes/v2/pages/**"],
              message:
                "shared/ must not import from pages/. Dependency direction: pages → shared, never the reverse. See src/routes/v2/ARCHITECTURE.md.",
            },
          ],
        },
      ],
    },
  },
  // v2 Architecture boundary: Editor must not import from other pages
  {
    files: ["src/routes/v2/pages/Editor/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: baseRestrictedImportPaths,
          patterns: [
            ...baseRestrictedImportPatterns,
            {
              group: ["@/routes/v2/pages/RunView/**"],
              message:
                "Editor must not import from RunView. Pages cannot depend on each other. See src/routes/v2/ARCHITECTURE.md.",
            },
            {
              group: ["@/routes/v2/pages/PipelineFolders/**"],
              message:
                "Editor must not import from PipelineFolders. Pages cannot depend on each other. See src/routes/v2/ARCHITECTURE.md.",
            },
          ],
        },
      ],
    },
  },
  // v2 Architecture boundary: RunView must not import from other pages
  {
    files: ["src/routes/v2/pages/RunView/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: baseRestrictedImportPaths,
          patterns: [
            ...baseRestrictedImportPatterns,
            {
              group: ["@/routes/v2/pages/Editor/**"],
              message:
                "RunView must not import from Editor. Pages cannot depend on each other. See src/routes/v2/ARCHITECTURE.md.",
            },
            {
              group: ["@/routes/v2/pages/PipelineFolders/**"],
              message:
                "RunView must not import from PipelineFolders. Pages cannot depend on each other. See src/routes/v2/ARCHITECTURE.md.",
            },
          ],
        },
      ],
    },
  },
  // v2 Architecture boundary: PipelineFolders must not import from other pages
  {
    files: ["src/routes/v2/pages/PipelineFolders/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: baseRestrictedImportPaths,
          patterns: [
            ...baseRestrictedImportPatterns,
            {
              group: ["@/routes/v2/pages/Editor/**"],
              message:
                "PipelineFolders must not import from Editor. Pages cannot depend on each other. See src/routes/v2/ARCHITECTURE.md.",
            },
            {
              group: ["@/routes/v2/pages/RunView/**"],
              message:
                "PipelineFolders must not import from RunView. Pages cannot depend on each other. See src/routes/v2/ARCHITECTURE.md.",
            },
          ],
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
