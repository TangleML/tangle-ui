# Pillar: tests — coverage & test health

Adds missing tests, authors e2e specs, and repairs stale/skipped tests for recently-changed,
under-covered code. Runs **last** so it sees the tree as the other pillars left it. This is the only
pillar that writes assertions rather than behavior-preserving edits, so its safeguards are stricter: a
test that passes while asserting the wrong thing is worse than no test.

## Pillar spec

- **PILLAR_ID:** `tests`
- **CATEGORY_IDS:** `tests` (threshold + flags from that block in `.github/gardening-config.json`;
  `requiresBehaviorReview: true`)
- **CONVENTION_SKILLS:** `vitest-testing` (unit/component/hook patterns, co-location, `renderWithProviders`,
  `vi.mock`) and `e2e-testing` (Playwright helpers, `data-testid`, semantic selectors, auto-waiting).
  Cite `vitest-testing#…` or `e2e-testing#…` on every finding.

## SIGNALS (worklist pretags for E3)

- **Coverage × churn** — run `pnpm run test:coverage`; intersect uncovered / low-coverage files with
  `churn.txt`. Recently-changed **and** under-tested files rank highest.
- **Disabled tests** — grep `*.test.ts(x)` and `tests/e2e/**` for `.only` / `.skip` / `it.todo` / `xit`.
- **Stale tests** — tests importing symbols that no longer exist, or currently failing on `master`.
- Drop `excludeGlobs`, claimed files, suppressed fingerprints.

## SPECIAL_HANDLING

Scope (aggressive, but each tier gated as below):

- **Additive unit tests** for exported pure functions in `src/utils|lib|hooks` with no existing test
  file — behavior is unambiguous from the implementation/types. Follow `vitest-testing` co-location
  (`foo.ts` → `foo.test.ts`).
- **Component / hook smoke tests** for uncovered components — render via the `renderWithProviders` /
  `renderHook` + wrapper patterns; assert it mounts and a key `data-testid` is present. Do not assert
  implementation details.
- **e2e specs** in `tests/e2e` using `tests/e2e/helpers.ts`, `data-testid` / role selectors, and
  auto-waiting (never `waitForTimeout`), per `e2e-testing`.
- **Repair** existing tests: un-`.skip`/`.only`, fix assertions against renamed/removed APIs.

Safeguards (mandatory — `requiresBehaviorReview`):

- **Unit/component tests are validated by `validate:test`** and must pass on the current code before
  they ship. A test that only passes because it asserts nothing meaningful is a KEEP-out — assert real
  output, not just "did not throw" (beyond the explicit smoke tier).
- **e2e specs go in their own commits.** Attempt `pnpm run test:e2e:ci`; if the environment cannot run
  it (no browser/dev server), do **not** claim it passed — the PR body must carry the mandatory
  checkbox `- [ ] Ran e2e locally; specs pass and assert real behavior`.
- **Behavior-review checkbox** on every PR: `- [ ] Each new/updated assertion reflects intended
behavior, not merely that the test passes`. The gate proves tests are green; only a human proves they
  assert the right thing.
- **Separate commits** for new-test additions vs. repairs to existing tests, so a reviewer can accept
  one and drop the other.
- Never weaken or delete a meaningful assertion to make a red test pass — flag genuinely broken
  behavior to the backlog for a human instead of editing the test to match it.
