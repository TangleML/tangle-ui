# Tangle-UI

## Comments

Code must be self-explanatory. Default to **no comment**.

- A comment is justified only when it states a non-obvious **why** the code and its names cannot: a
  workaround, a race condition, an external-system quirk, a subtle ordering constraint.
- Never narrate **what** the code does. No step-by-step narration (`// fetch the data`), no
  section-divider banners (`// ─── Helpers ───`), no restating a name.
- Never comment `interface` fields, `type` members, component `Props`, or config-object fields —
  leading or trailing, `//` or `/** */`. A field that needs a comment to explain what it is has a
  **naming problem**: rename it. (Only exception: the prop contract of a shared design-system
  primitive in `src/components/ui/`.)
- Prefer renaming, extracting a well-named function, or a named constant over adding a comment.
- JSDoc only for genuinely complex functions and shared public APIs — never as a substitute for a
  good name.
- A stale comment is worse than none: update comments with the code, and delete ones you invalidate.

Removing a comment that violates the above is always in scope for a change you are already making.

## Everything else

Project conventions live in `.claude/skills/` — start with `project-conventions`, plus
`typescript-standards`, `react-patterns`, `ui-primitives`, `tangle-domain`, `tanstack-query`,
`tanstack-router`, `vitest-testing`, `e2e-testing`, `accessibility`, and `open-source`.

When preparing or updating pull request descriptions, use `pr-description`. For
features spanning companion PRs in multiple repositories, also use
`distributed-stacks` to document public-safe membership and dependencies.
