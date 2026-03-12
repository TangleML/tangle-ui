---
name: review
description: Code review of current PR/commit changes against project coding standards. Use when the user asks for a code review or mentions reviewing changes.
disable-model-invocation: true
allowed-tools: Bash(git *), Bash(gt *), Read, Grep, Glob
---

# Code Review

Review the current commit (HEAD) against project coding standards. This team uses **Graphite** for stacked PRs — each commit is a PR in a stack.

## Review Process

1. **Default scope**: Review the last commit (`git show HEAD`). Each commit = one Graphite PR.
2. **Only review changed code**. Do not flag pre-existing issues unless they directly cause problems with the new changes.
3. **Source of truth**: Use `git show HEAD --stat` to see changed files, then `git show HEAD` for the diff. Do NOT use `git diff main...HEAD` as this shows all commits in the stack, not just the current one.
4. **Read files**: Always read the full files being reviewed to understand context, not just the diff.

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
