# Pillar: react — React best practices

Swaps raw HTML for UI primitives (BlockStack/InlineStack/Text/Heading/Paragraph) and hardcoded color
classes for the `tone` prop, flags React Compiler adoption gaps, and flags (never builds) candidates for
new shared primitives.

## Pillar spec

- **PILLAR_ID:** `react`
- **CATEGORY_IDS:** `primitives` and `react-compiler` (thresholds + flags from those blocks in
  `.github/gardening-config.json`). Within this pillar, `primitives` outranks `react-compiler` for the
  one-file-one-owner rule.
- **CONVENTION_SKILLS:** `ui-primitives` (primitives + `tone`) and `react-patterns` (React Compiler,
  Rules of Hooks). Load both; cite `ui-primitives#…` or `react-patterns#…` on every finding.

## SIGNALS (worklist pretags for E3)

Grep `.tsx` under `src` (drop `excludeGlobs`, claimed files, suppressed fingerprints):

- **primitives** — `className="flex flex-col` → `BlockStack`; `className="flex` (row) → `InlineStack`;
  raw `<h[1-6]` / `Text as="h*"` → `Heading`; raw `<p[ >]` → `Paragraph`; styled `<span>` → `Text`
  (`font="mono"` not `className="font-mono"`); hardcoded text color classes (`text-muted-foreground`,
  `text-rose-*`, …) → the `tone` prop.
- **react-compiler** — from `react-compiler.config.js` (`REACT_COMPILER_ENABLED_DIRS` + the
  `0 useCallback/useMemo - ready to enable` annotations): dirs annotated ready → promotion candidates;
  new top-level `src/**` files/dirs under no enabled parent → coverage-gap flags; manual `useMemo`/
  `useCallback`/`memo` inside already-enabled dirs → removal candidates.
- **new-primitive candidates (flag-only)** — a raw-HTML/style pattern that recurs across many files with
  **no existing primitive** covering it (e.g. the same styled `<span>`/`<div>` shape repeated 5+ times),
  or a swap that keeps getting skipped because no primitive fits. Record it as a _proposal_ for a human;
  never treat it as an apply candidate.

## SPECIAL_HANDLING

- **`requiresVisualReview: true` for `primitives`.** A `<div className="flex flex-col gap-2">` →
  `<BlockStack>` swap is **not** guaranteed null — `BlockStack` applies a default gap/spacing token, so
  a swap can shift rendered layout with green tests. Propose **exact-mapping swaps only** (skip ambiguous
  gaps and mixed layout/utility classes); the PR body must carry the mandatory checkbox
  `- [ ] Visually diffed the rendered output — no layout/spacing regression`.
- **React Compiler is flag-only by default** (`flagOnly: true`, `promotionEnabled: false`). Report
  adoption gaps; do not edit `react-compiler.config.js` unless the user passes `--promote-compiler`.
  When promoting: only dirs annotated `ready to enable`, its own commits, and add `pnpm run build` to the
  E7 validation (compiler promotion changes runtime memoization — the tsc build must pass on top of
  `validate:test`). Prefer consolidating by folder over listing files individually.
- Do not swap raw HTML that `ui-primitives` deems acceptable (`<dl>`/`<ul>`/`<ol>`/`<table>`, genuinely
  complex or perf-critical layouts). KEEP those and log the decision.
- **New UI primitives / components are flag-only — never authored without express permission.** Using
  and composing _existing_ primitives is always allowed (that is this pillar's core job). But when a
  valid case exists for a _new_ primitive or shared component, only **flag** it: write it to the backlog
  (E9) as a proposal with its rationale (the recurring pattern, file count, why no existing primitive
  fits, a sketched API). Do **not** `Write` a new primitive/component file, and do not migrate call sites
  onto a not-yet-existing one. A human decides whether it gets built. (This is an explicit exception to
  the engine's "new files may be created" rule, which the `react` pillar overrides for primitives.)
