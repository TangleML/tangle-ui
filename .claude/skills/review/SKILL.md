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
gh pr view <number> --json number,title,url,headRefOid --jq '{number, title, url, head_sha: .headRefOid}'
gh pr diff <number>
```

**If no argument was provided**, try the current branch:

```bash
gh pr view --json number,title,url,headRefOid --jq '{number, title, url, head_sha: .headRefOid}'
gh pr diff
```

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

## What to Check

Review changed code for violations, prioritizing:

### High Priority

- Unsafe type casting (`as`) - suggest type guards instead
- Potential runtime errors (undefined access, null checks)
- Missing error handling
- Security concerns
- Incorrect use of React hooks (missing deps, unnecessary async)
- React Compiler violations (mutating during render, reading refs during render)

### Medium Priority

- Not using UI primitives (`BlockStack`, `InlineStack`, `Text`, `Icon`)
- Import order violations
- Duplicated logic that should be extracted

### Low Priority

- Redundant code (unnecessary null coalescing, etc.)
- Minor style inconsistencies
- Unused props or parameters

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
- **Acknowledge good patterns**: Note when code follows best practices
- **Don't nitpick**: Focus on meaningful improvements
- **Offer to fix**: After review, ask "Want me to fix these?"

## What NOT to Do

- Don't review unchanged code (unless it causes issues with new code)
- Don't suggest rewrites of working code just for style preferences
- Don't flag issues that are already present in the codebase (pre-existing)
- Don't recommend adding complexity without clear benefit
- Don't suggest patterns that conflict with existing codebase conventions
