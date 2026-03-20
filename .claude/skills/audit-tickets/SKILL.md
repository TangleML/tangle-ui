---
name: audit-tickets
description: Audit open GitHub issues against the codebase to find tickets that have already been implemented. Use when the user wants to triage, audit, or clean up GitHub issues.
disable-model-invocation: true
allowed-tools: Bash(gh *), Read, Grep, Glob, Agent
---

# Audit GitHub Tickets

Scan open GitHub issues and check whether each one has already been addressed in the codebase. Post a comment on tickets that appear complete.

## Arguments

The user may provide:

- A repo name (e.g., `TangleML/tangle-ui`, `TangleML/tangle`). If not specified, audit **both** `TangleML/tangle-ui` and `TangleML/tangle`.
- A limit (e.g., `--limit 20`). Default: all open issues.
- Specific issue numbers to audit (e.g., `#1641 #575`).

## Process

### Step 1: Fetch open issues

```bash
gh issue list -R <repo> --state open --limit 100 --json number,title,labels,body,author,assignees,comments
```

### Step 2: Filter candidates

Skip issues that are:

- **Epics** (title contains "epic" or "[Epic]")
- **Design/brainstorm** issues (title starts with "design:" or "Brainstorm:")
- **Issues created in the current session** (issues you just created in this conversation)
- **Recently audited** — issues that already have a comment containing `🤖 This is an AI-generated audit` posted within the last 14 days. Check comments when fetching issues and skip any that match.

Audit **everything else**, including feature requests and vague tickets. The goal is to close as many tickets as possible.

### Step 3: Verify each candidate against the codebase

For each candidate issue, use the Explore agent to search the codebase:

- Search for the specific files, components, functions, or patterns described in the issue
- Read the relevant code to confirm the feature/fix exists
- Determine one of these statuses:
  - **Done** — The described feature/fix is fully implemented
  - **Partial** — Some aspects are done, others remain
  - **Open** — Not implemented, clear what needs to be done
  - **Vague** — Cannot determine if implemented because the issue lacks clear acceptance criteria or sufficient detail

Be thorough but efficient. Use targeted searches (Grep/Glob) for quick checks, and Explore agents for deeper investigation when needed. Run multiple checks in parallel where possible.

### Step 4: Report findings

Present a summary table to the user:

| Issue | Title | Status | Evidence |
| ----- | ----- | ------ | -------- |

Group by status: Done first, then Partial, then Vague, then Open.

### Step 5: Post comments (with user approval)

Ask the user which issues they'd like to comment on. Then for each approved issue:

1. Look up the author and any assignees/commenters on the issue
2. Post a comment using the appropriate template based on status:

**For Done issues:**

```markdown
> 🤖 This is an AI-generated audit of this ticket.

@<author> [and @<assignees/commenters>] — What is the status of this issue? It appears to already be complete.

<Evidence from the codebase with specific file paths>

Can this be closed?
```

**For Vague issues (cannot determine implementation status):**

```markdown
> 🤖 This is an AI-generated audit of this ticket.

@<author> [and @<assignees/commenters>] — This ticket doesn't have enough detail to determine whether it's been addressed. Could you add more context — specific acceptance criteria, expected behavior, or details on what "done" looks like? Otherwise, can this be closed?
```

**For Partial issues:**

```markdown
> 🤖 This is an AI-generated audit of this ticket.

@<author> [and @<assignees/commenters>] — This issue appears to be partially addressed. Here's what we found:

**Implemented:**
<what's done, with file paths>

**Still missing:**
<what remains>

Can the scope be updated, or should this be closed and a new issue opened for the remaining work?
```

## Codebase locations

- **Frontend (tangle-ui):** `/Users/mattbeaulne/src/github.com/Shopify/pipeline-studio-app`
- **Backend (tangle):** `/Users/mattbeaulne/src/github.com/Shopify/oasis-backend`

## Important

- Never close issues directly — always comment and ask
- Always prefix comments with the AI audit disclaimer
- Ping the issue author and any assignees/commenters
- Include specific file paths as evidence
- For "Partial" issues, clearly state what's done and what's remaining
- Do not audit issues that were just created in the current conversation
