---
name: gardening
description: Weekly codebase groundskeeping. Sweeps the codebase for one or more hygiene pillars — hygiene (Prettier/import-sort/knip dead code), comments (low-value/commented-out), dry (dedup/reuse), refactor (leaner code), react (UI primitives + React Compiler), tests (coverage + e2e + stale-test repair) — applies only gate-verified fixes, and opens a DRAFT PR per pillar plus a backlog issue. Use for the weekly gardening run or when invoked as /gardening [pillars].
disable-model-invocation: true
allowed-tools: Bash(gh *), Bash(git *), Bash(pnpm run *), Bash(pnpm exec *), Bash(node *), Bash(date *), Bash(ls *), Bash(find *), Bash(mkdir *), Bash(rm *), Read, Edit, MultiEdit, Write, Grep, Glob, Agent
argument-hint: "[hygiene|comments|dry|refactor|react|tests|all ...] [--dry-run] [--max-files N] [--promote-compiler]"
---

# Codebase Gardening

Weekly groundskeeping for the Tangle-UI codebase. Sweep the tree for hygiene issues, apply only fixes
a validation gate can prove safe, self-review each PR with the `review` skill, and open **draft** PRs for
human review. The goal is a codebase that stays free of AI slop without depending on per-PR hand polish.

Work is organized into **pillars**, each a bounded scan run one at a time so a single run is unlikely
to exhaust the token budget or time out:

| Pillar     | What it does                                                            | Convention skill(s)                           |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `hygiene`  | Fix Prettier/import-sort violations; remove knip dead code (runs first) | `project-conventions`, `typescript-standards` |
| `comments` | Remove/refine low-value & commented-out comments; keep the _why_        | `project-conventions`                         |
| `dry`      | Consolidate duplicated logic; adopt an existing helper before extract   | `project-conventions`, `typescript-standards` |
| `refactor` | Simplify verbose code; integrate with existing abstractions             | `typescript-standards`, `project-conventions` |
| `react`    | Raw HTML → UI primitives + `tone`; flag React Compiler adoption gaps    | `ui-primitives`, `react-patterns`             |
| `tests`    | Add missing tests, author e2e specs, repair stale tests (runs last)     | `vitest-testing`, `e2e-testing`               |

## Arguments

Positional pillar names select what runs; flags modify the run.

- **Pillars** — any subset of `hygiene`, `comments`, `dry`, `refactor`, `react`, `tests`,
  space-separated (e.g. `/gardening comments dry`). `all` (or **no pillar given**) runs all six in
  priority order. Unknown names → list the valid pillars and stop.
- `--dry-run` — analyze and print each selected pillar's worklist + findings table; create no branches,
  edits, commits, or PRs.
- `--max-files N` — override `caps.maxFilesPerPR` for this run.
- `--promote-compiler` — allow the `react` pillar to enable ready dirs in `react-compiler.config.js`
  (otherwise React Compiler findings are flag-only). Ignored by other pillars.

## How to run

1. **Parse arguments** into `SELECTED_PILLARS` (default: all six, in config priority order —
   `hygiene`, `comments`, `dry`, `refactor`, `react`, `tests` per `.github/gardening-config.json`) and
   the flag set.
2. **Read the shared engine once:** `.claude/skills/gardening/engine.md`. It defines steps E0–E10, the
   state model, fingerprints, and schemas.
3. **Run the engine's shared preamble once** (E0 config, E1 fork protection, E2 ISO-week +
   suppression/in-flight/file-claim scan). If E1 fails the repo check, stop for the whole run.
4. **For each pillar in `SELECTED_PILLARS`, in order:**
   - Read `.claude/skills/gardening/pillars/<pillar>.md` for that pillar's spec block (`PILLAR_ID`,
     `CATEGORY_IDS`, `CONVENTION_SKILLS`, `SIGNALS`, `SPECIAL_HANDLING`). If the doc is missing, print
     `SKIPPED <pillar>: missing pillar doc` and move to the next pillar — never improvise the spec.
   - Run engine steps **E3–E9** for that pillar (worklist → MAP → REDUCE → gate → apply/validate/revert
     → draft PR → self-review → backlog). Each pillar produces its own branch
     `automated-gardening/<pillar>/<week>` and its own draft PR.
   - **Carry the claimed-files set forward:** after a pillar opens a PR, add the files it touched to the
     claimed-files set so a later pillar in the same run cannot edit them (prevents mid-run collisions,
     complementing E2's scan of already-open PRs).
   - Respect `caps.maxPRsPerRun` across the whole invocation, not per pillar.
5. **Run E10 cleanup once** at the end (remove `/tmp/gardening-<week>`, return to the starting branch).

Under `--dry-run`, step 4 stops after E6 for each pillar (print the table, create nothing) and step 5
still cleans up the temp dir.

## Notes

- Loading is lazy by design: only the engine plus the selected pillar docs are read, so a single-pillar
  run stays small.
- The convention skills are the source of truth for every rule — this skill and its pillar docs cite
  them, never restate them.
- Everything this skill opens is a **draft** PR; nothing auto-merges.
