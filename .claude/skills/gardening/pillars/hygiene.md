# Pillar: hygiene — formatting, import-sort & dead code

The most mechanical pillar. Brings files into line with Prettier and the import-sort/no-relative-import
lint rules, and removes knip-reported dead code (unused exports, files, deps). Runs **first** so its
low-risk noise clears before the subjective pillars touch the same tree.

## Pillar spec

- **PILLAR_ID:** `hygiene`
- **CATEGORY_IDS:** `hygiene` (threshold + flags from that block in `.github/gardening-config.json`)
- **CONVENTION_SKILLS:** `project-conventions` (file structure, `@/` imports, no barrel exports) and
  `typescript-standards` (exports/deps that are safe to drop). Cite the relevant one per finding.

## SIGNALS (worklist pretags for E3)

Scope to **actual violations** so the claim set stays small (master already passes `validate`, so drift
at HEAD is near-zero — most findings here are knip dead code):

- **Prettier** — files reported by `pnpm exec prettier --check .` (drop `excludeGlobs` / claimed /
  suppressed) → fix with `prettier --write` on exactly those files.
- **Import-sort & relative imports** — files with `simple-import-sort/imports`,
  `simple-import-sort/exports`, or `no-relative-import-paths` findings in `lint` output → fix with
  `eslint --fix` on those files.
- **knip** — from `knip.json`: unused **exports**, unused **files**, and unused **deps** → removal
  candidates.

## SPECIAL_HANDLING

- **Formatting/import-sort fixes are null transforms** — apply them freely and at high confidence; the
  gate (`prettier --check` + `lint`) proves them. Prefer running the project's own tools
  (`prettier --write`, `eslint --fix`) over hand-editing.
- **knip removals are only medium confidence** — knip can be wrong about dynamic/string references
  (e.g. lookups by name, re-exports consumed elsewhere, deps used only in config/scripts). Keep each
  removal in **its own commit** so a reviewer can drop just the doubtful ones, and verify the symbol is
  not referenced dynamically before deleting. This pillar owns plain unused-export/dep/file removal; the
  `refactor` pillar owns complexity-driven restructures.
- **Never delete** anything matching `excludeGlobs` or `protectedPatterns`, generated files, or config
  the build needs. When knip flags a dep only used by tooling/CI, KEEP it and log the decision.
- No `requiresVisualReview`. A hygiene change that also alters an export surface should set
  `riskBlastRadius` honestly (dropping an export can ripple to importers).
