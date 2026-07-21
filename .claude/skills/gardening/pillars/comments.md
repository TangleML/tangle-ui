# Pillar: comments — comment hygiene

Removes commented-out code and low-value narrating comments (comments that restate what the code
plainly does) while preserving comments that explain a non-obvious why.

## Pillar spec

- **PILLAR_ID:** `comments`
- **CATEGORY_IDS:** `comments` (threshold + flags from that block in `.github/gardening-config.json`)
- **CONVENTION_SKILLS:** `project-conventions` (the Comments & Documentation policy — explain _why_,
  not _what_; keep JSDoc for public APIs; keep non-obvious reasoning). Load it and cite
  `project-conventions#comments` on every finding.

## SIGNALS (worklist pretags for E3)

Grep `.ts`/`.tsx` under `src` (drop `excludeGlobs`, claimed files, suppressed fingerprints):

- **Commented-out code** — `^\s*//\s*(const|let|var|return|import|export|if|for|function|await|console|<[A-Za-z]|\{|\}|=>)`.
  Exclude directive comments (`// eslint`, `// @ts-`, `// prettier`) and intent markers (`// TODO`,
  `// FIXME`, `// NOTE`) from removal candidates.
- **Narrating comments** — comment lines immediately above a line whose code obviously restates them
  (`// loop over items` above a `.map`, `// set state`, redundant doc comments on self-explanatory
  symbols). This is a judgment signal; the MAP agents confirm it in context.
- Prioritize by churn (`churn.txt`) so the busiest files are cleaned first. This pillar needs no
  `knip`/`fta`/`depcruise`.

## SPECIAL_HANDLING

- **Be conservative — restraint is the point.** KEEP any comment that explains a non-obvious why:
  workarounds, trade-offs, gotchas, accessibility rationale, external constraints, named-person design
  notes, issue links, and `TODO`/`FIXME` that track real pending work. When in doubt, keep it and log a
  KEEP decision rather than a finding.
- `action: refine` (not `remove`) for a keep-worthy comment that is merely poorly worded or has a typo.
- Comments describing `componentSpec` structure are `touchesProtected: true` — never remove.
- Removing a comment or commented-out code is behavior-preserving, so the `validate:test` gate is a
  strong safety net here; this pillar does not set `requiresVisualReview`.
