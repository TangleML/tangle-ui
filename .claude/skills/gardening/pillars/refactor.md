# Pillar: refactor — leaner code

Simplifies verbose or overly complex code — removes unsafe casts and dead defensive branches, flattens
nesting with early returns, and integrates better with existing abstractions.

## Pillar spec

- **PILLAR_ID:** `refactor`
- **CATEGORY_IDS:** `refactor` (threshold + flags from that block in `.github/gardening-config.json`)
- **CONVENTION_SKILLS:** `typescript-standards` (no unsafe `as`, type guards, `interface` vs `type`) and
  `project-conventions` (early returns, no inline styles for static values, existing abstractions).
  Cite the relevant one per finding.

## SIGNALS (worklist pretags for E3)

- **fta complexity** — files in `fta.json` scoring above `thresholds.refactorFtaScore` are the primary
  worklist (complexity/maintainability hotspots).
- **knip** — use `knip.json` to spot dead branches reachable only from unused code. Plain
  unused-export/file/dep **removal is owned by the `hygiene` pillar**, not this one — flag such removals
  for `hygiene` rather than doing them here (one-file-one-owner keeps the PRs from colliding).
- **Grep smells** — unsafe casts (`as` excluding `as const`), deeply nested ternaries / long
  `&&`/`||` chains in JSX, redundant null-coalescing and dead defensive branches, inline `style={{…}}`
  with static values.
- Weight by churn (`churn.txt`). Drop `excludeGlobs`, claimed files, suppressed fingerprints.

## SPECIAL_HANDLING

- **Highest-subjectivity pillar — lean on the confidence gate.** Only propose simplifications you are
  confident are behavior-preserving and that a reviewer will read as obviously better. Genuine
  restructures that change control flow or public signatures are out of scope for auto-apply → report
  them to the backlog for a human, don't edit them.
- **Integrate, don't just shrink.** When a verbose block reimplements something an existing hook,
  provider, or util already offers (e.g. `useRequiredContext`, an existing service), rewrite it to use
  the existing abstraction rather than merely compressing the local code. Grep before proposing.
- `knip` "unused" is only behavior-preserving if knip is right about dynamic/string references — treat
  deletions as medium confidence and keep them in their own commits so a reviewer can drop just those.
- Never change `componentSpec` structure (`touchesProtected: true`); never introduce CSS-in-JS or
  relative imports for `@/components/ui`.
- This pillar does not set `requiresVisualReview`, but a refactor touching JSX rendering should set
  `riskBlastRadius` honestly so the reviewer knows to spot-check the UI.
