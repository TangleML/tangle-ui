---
name: review
description: Code review of current PR/commit changes against project coding standards. Use when the user asks for a code review or mentions reviewing changes.
disable-model-invocation: true
allowed-tools: Bash(git *), Bash(gt *), Bash(gh *), Read, Grep, Glob, Agent
argument-hint: [PR number]
---

# Code Review

Review code changes against project coding standards. This team uses **Graphite** for stacked PRs — each commit is a PR in a stack.

## Step 0: Determine Review Target

Check if the user provided a PR number as an argument.

**If a PR number was provided** (e.g., `/review 1234`):

```bash
gh pr view <number> --json number,title,url,headRefOid,baseRefName --jq '{number, title, url, head_sha: .headRefOid, base: .baseRefName}'
gh pr diff <number>
```

**If no argument was provided**, try the current branch:

```bash
gh pr view --json number,title,url,headRefOid,baseRefName --jq '{number, title, url, head_sha: .headRefOid, base: .baseRefName}'
gh pr diff
```

Note the **base branch**. In a Graphite stack the base is usually the _parent PR's_ branch (not `main`), and `gh pr diff` is already scoped to that base — so the diff it returns contains **only this PR's own changes**. Trust that scope (see "Stack Awareness" below); don't widen it with `git diff main...HEAD`.

**If no PR exists for the current branch**, fall back to local commit review:

- Use `git show HEAD` as the diff source (existing behavior)
- Skip all comment posting steps later — just output the review to chat
- Note: each commit = one Graphite PR, so this reviews a single commit

Store the **PR number** and **head commit SHA** for comment posting later.

## Step 1: Review Process

1. **Only review changed code**. Do not flag pre-existing issues unless they directly cause problems with the new changes.
2. **Source of truth**:
   - **PR mode**: Use `gh pr diff <number>` for the diff
   - **Fallback mode**: Use `git show HEAD --stat` then `git show HEAD` for the diff. Do NOT use `git diff main...HEAD` as this shows all commits in the stack.
3. **Read files**: Always read the full files being reviewed to understand context, not just the diff.
4. **Track locations**: For each finding, record the exact file path and line number from the diff — these are needed for posting inline comments.

## Stack Awareness (Graphite)

PRs in this repo are **stacked** — each PR builds on the one below it, and they're reviewed (and merged) bottom-to-top. A finding only belongs on the PR that _introduced_ it.

- **Scope to this PR's own diff.** `gh pr diff <number>` already returns only the changes this PR adds on top of its base (the parent PR's branch). Review exactly that set — do not pull in code from parent PRs or unrelated files.
- **Don't re-flag what an earlier PR in the stack introduced.** If a line of code or a pattern came from a lower PR, it's out of scope here even if it shows up as surrounding context — it was (or should have been) reviewed on that PR. Re-raising it duplicates comments across the stack and creates noise on the wrong PR.
- **Watch for context vs. additions.** When reading a file for context, distinguish lines this PR _added/changed_ (the `+` lines in the diff) from lines that merely surround them. Only the former are in scope. When in doubt, confirm a line is part of this PR's diff before commenting on it.
- **Exception — new or extracted files.** A file this PR creates (including one extracted/moved from elsewhere) is the author's to get right, so its contents are fair game even if some lines were copied verbatim from older code. Say so in the comment ("this file is new here, so flagging…").
- **Cross-stack observations belong in prose, not inline comments.** If you notice the same issue recurring across PRs (e.g. a helper that keeps getting duplicated), mention it once in the summary and point to the PR where the fix belongs — don't post the same inline comment on every PR.
- **Carrying forward:** if you reviewed a lower PR in this session, remember what you already flagged there and don't repeat it when its code reappears as context higher in the stack.

## What to Check

Changed code should follow this project's documented standards and React best practices. **These skills are the source of truth — consult them rather than guessing, and frame findings in their terms** (link the relevant one in the comment):

- **`ui-primitives`** — `BlockStack`/`InlineStack`/`Text`/`Heading`/`Paragraph`/`Button`/`Icon`, the `tone` prop, when raw HTML is acceptable
- **`react-patterns`** — Rules of Hooks, React Compiler compatibility, provider/custom-hook structure
- **`typescript-standards`** — no unsafe `as`, type guards, `interface` vs `type`, naming
- **`project-conventions`** — file structure, import order, **comments policy**, error handling, no inline styles for static values
- **`tanstack-query`** / **`tanstack-router`** — server-state and routing patterns
- **`accessibility`** — interactive components, forms, dialogs, ARIA

Review changed code for violations, prioritizing:

### High Priority

- Unsafe type casting (`as`) — suggest type guards instead (`typescript-standards`)
- Potential runtime errors (undefined access, null checks)
- Missing error handling; security concerns
- Incorrect use of React hooks — missing/**unstable** deps (e.g. effects depending on an object rebuilt every render), conditional hooks, unnecessary `async` (`react-patterns`)
- React Compiler violations — mutating during render, reading refs during render (`react-patterns`)
- **React Compiler registration** — when a PR adds a new component/hook, or moves/renames a registered one, confirm `react-compiler.config.js` is updated. A new file under an already-enabled directory is covered automatically; a new top-level file is NOT, and a **rename leaves a dead entry pointing at a deleted file** while the new file loses coverage
- Invalid or inaccessible markup — e.g. nested interactive elements (`<a><button>` from `<Link><Button>`; use `<Button asChild>`), missing labels (`accessibility`)

### Medium Priority

- **UI primitives used incorrectly — not just whether they're imported.** A file importing `BlockStack` does NOT mean it uses primitives everywhere it should. Scan every changed JSX block for the raw-HTML equivalents (`ui-primitives`):
  - `<div className="flex flex-col …">` → `BlockStack`; `<div className="flex …">` (row) → `InlineStack`
  - Hardcoded color classes on text (`text-muted-foreground`, `text-rose-600`, …) → the `tone` prop (`subdued`, `critical`, …)
  - Raw `<h1>`–`<h6>` / `Text as="h*"` → `Heading`; raw `<p>` → `Paragraph`; styled `<span>` → `Text` (e.g. `font="mono"`, not `className="font-mono"`)
  - Repeated Tailwind class combinations across elements → suggest extracting a small component
- Import order violations (external → internal `@/` → relative; `project-conventions`)
- Duplicated logic that should be extracted — especially against helpers/components established **earlier in the same stack** (recurring drift is worth a shared util)

### Low Priority

- **Excessive or low-value comments** (`project-conventions` → Comments & Documentation). Comments should explain _why_, not narrate _what_. Flag:
  - Comments restating what the code plainly does (`// loop over items` above a `.map`)
  - Redundant doc comments on self-explanatory functions/variables
  - Commented-out code
  - Keep the good ones: non-obvious reasoning, trade-offs, gotchas, and links
- Inline `style={}` for **static** values → use Tailwind classes (inline style is only for dynamic/computed values; `project-conventions`)
- Deeply nested ternaries / long conditional chains in JSX → extract a helper or use early returns
- Naming that doesn't match conventions (`typescript-standards`)
- Redundant code (unnecessary null coalescing, dead defensive branches); unused props or parameters; minor style inconsistencies

## Review Output Format

Present findings in this format:

```markdown
## Issues Found

### 1. **[Issue Title]** - [File:Line]

[Code snippet showing the problem]
**Why**: [Brief explanation]
**Fix**: [Suggested solution]

---

## What's Good

- [Positive observations about the code]
- Note if file was added to `react-compiler.config.js` (React Compiler enabled)

---

## Summary Table

| Issue | Severity        | Location  |
| ----- | --------------- | --------- |
| ...   | High/Medium/Low | file:line |
```

## Step 2: Select Comments to Post (PR mode only)

**Skip this step entirely if in fallback mode (no PR).**

After presenting the review, use `AskUserQuestion` with **multi-select** to let the user pick which findings to post as inline PR comments.

Each option should show:

- Severity
- File path and line number
- Issue title
- A brief preview of the comment that would be posted

Example options:

- `[High] src/utils/api.ts:42 — "Unsafe type cast" → suggest type guard instead of as`
- `[Medium] src/components/List.tsx:15 — "Missing UI primitive" → use BlockStack instead of div`

The user picks which comments to post. Only proceed with the selected ones.

If the user selects none or there are no findings, skip to the end.

## Step 3: Post Selected Comments (PR mode only)

**Skip this step entirely if in fallback mode (no PR).**

Determine the repo owner/name:

```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'
```

For each selected finding, post an inline review comment. Every comment **must** be prefixed with the AI disclaimer:

```markdown
> 🤖 This is an AI-generated code review comment.

<rest of the comment body>
```

Post using:

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  -f body="<comment>" \
  -f path="<file>" \
  -F line=<line> \
  -f commit_id="<head_sha>"
```

After posting, show a summary:

| #   | File                       | Issue                | Posted |
| --- | -------------------------- | -------------------- | ------ |
| 1   | src/utils/api.ts:42        | Unsafe type cast     | Yes    |
| 2   | src/components/List.tsx:15 | Missing UI primitive | Yes    |

## Review Principles

- **Be specific**: Include file paths and line numbers
- **Be actionable**: Provide concrete fixes, not vague suggestions
- **Be proportional**: Don't over-engineer simple code
- **Acknowledge good patterns**: Note when code follows best practices — including correct primitive/`tone` usage and well-judged comments
- **Don't nitpick**: Focus on meaningful improvements
- **Keep style findings proportional**: Comment/primitive/naming nits are usually Low severity — group them, don't let them dominate the review, and cite the relevant standards skill so the author can see the rule
- **Offer to fix**: After review, ask "Want me to fix these?"

## What NOT to Do

- Don't review unchanged code (unless it causes issues with new code)
- Don't suggest rewrites of working code just for style preferences
- Don't flag issues that are already present in the codebase (pre-existing)
- **Don't re-flag issues introduced by an earlier PR in the stack** — review only what _this_ PR's diff adds (see "Stack Awareness")
- Don't recommend adding complexity without clear benefit
- Don't suggest patterns that conflict with existing codebase conventions — when unsure what the convention is, check the relevant standards skill before flagging
