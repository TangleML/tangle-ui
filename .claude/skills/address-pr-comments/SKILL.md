---
name: address-pr-comments
description: Find the PR for the current branch, read review comments, and address them — either by fixing the code or pushing back with a reply. Use when the user wants to handle PR feedback.
disable-model-invocation: true
allowed-tools: Bash(gh *), Bash(git *), Bash(gt *), Read, Edit, Write, Grep, Glob, Agent
---

# Address PR Comments

Check the current branch for an open PR, read all unresolved review comments, and let the user pick which ones to address.

## Step 1: Find the PR

```bash
gh pr view --json number,title,url,state --jq '{number, title, url, state}'
```

If no PR exists for the current branch, tell the user and stop.

Also determine the current GitHub user:

```bash
gh api user --jq '.login'
```

## Step 2: Fetch review comments

Get all review comments (not general PR comments):

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --paginate --jq '.[] | {id, path, line, body, user: .user.login, created_at, in_reply_to_id, diff_hunk}'
```

## Step 3: Filter to actionable comments

Build a thread map by grouping comments using `in_reply_to_id`. For each top-level comment thread:

**Skip the thread if ANY of these are true:**

- The thread is already resolved
- The top-level comment was made by the current user
- The top-level comment was made by a bot (dependabot, github-actions, etc.)
- The comment is a pure approval with no actionable feedback
- **The current user (or PR author) has already replied** in the thread — this means it was already addressed in a previous run or manually. Check if any reply in the thread was authored by the current GitHub user.

This ensures running the command again won't double-reply to already-addressed comments.

## Step 4: Analyze comments and present for selection

Before presenting comments to the user, **read the relevant code and think critically about each comment**. Determine whether the suggestion is correct, already addressed, or a bad idea. Form a proposed action for each.

Use the AskUserQuestion tool to show a **multi-select list** of all remaining unresolved, unaddressed comments. Each option should show:

- The reviewer's username
- The file path and line number
- A truncated preview of the comment (first ~80 characters)
- **Your proposed action** — what you plan to do (e.g., "Will fix: change X to Y", "Will push back: current approach is better because...", "Will answer: explain how X works")

Example options:

- `[reviewer] file.ts:42 — "Fix this typo..." → Will fix: rename varName to variableName`
- `[reviewer] other.ts:10 — "This should use..." → Will push back: current pattern is more performant here`
- `[reviewer] types.ts:5 — "Why not use...?" → Will answer: explain the tradeoff`

The user picks which comments they want to address. Only proceed with the selected ones.

If there are no actionable comments, tell the user everything has been addressed and stop.

## Step 5: Address each selected comment

**Do not blindly agree with every comment.** Critically evaluate each suggestion against the codebase, existing patterns, and correctness. If a suggestion would make the code worse, introduce inconsistency, or is factually wrong — push back respectfully. The reviewer is a collaborator, not an authority to obey unconditionally.

For each selected comment, read the relevant file and surrounding context, then decide:

### If the suggestion is correct and actionable:

1. Make the code change
2. Reply to the comment confirming the fix:

```markdown
Fixed — <brief description of what was changed>.
```

### If the suggestion is already addressed:

Reply explaining that it's already handled:

```markdown
This is already handled — <explanation with file path/line reference>.
```

### If the suggestion is incorrect or not applicable:

Reply respectfully pushing back:

```markdown
I think the current approach is better here because <reasoning>. <Optional: offer an alternative compromise>.
```

### If the comment is a question (not a change request):

Reply with the answer:

```markdown
<Answer the question with relevant context/file references>.
```

## Step 6: Post replies

For each comment, post the reply:

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_id}/replies -f body="<reply>"
```

## Step 7: Stage and commit fixes

If any code changes were made:

1. Stage only the files that were modified to address comments
2. Create a commit with a message like: `address pr feedback`
3. Do NOT push — tell the user the changes are committed and ready to push

## Step 8: Show summary

After all comments are addressed, show a summary table with columns:

| #   | File | Comment | Action |
| --- | ---- | ------- | ------ |

Where **Action** clearly states what was done: "Fixed — ...", "Pushed back — ...", "Answered — ...", or "Already handled — ...".

## Important

- Always read the full file context before deciding how to address a comment
- **Think critically** — do not default to agreeing. Push back when the suggestion is wrong, harmful, or inconsistent with the codebase
- Never dismiss feedback rudely — be respectful even when pushing back
- If a comment requires a large refactor or is out of scope, say so and suggest a follow-up issue
- Group related comments that touch the same code — address them together
- If unsure about a comment's intent, ask the user before responding
- Show the user what you plan to reply before posting, so they can adjust
