---
name: list-skills
description: List all available custom slash commands and skills. Use when the user asks what commands are available or wants to see all skills.
disable-model-invocation: true
allowed-tools: Bash(find *), Read, Glob, Grep
---

# List Skills

List all custom skills defined in this project.

## Process

1. Find all skill files:

```bash
find .claude/skills -name 'SKILL.md' -type f
```

2. For each skill, extract:
   - **Name** from the `name:` frontmatter field
   - **Description** from the `description:` frontmatter field
   - **Type**: If `disable-model-invocation: true` is set, the skill is a **slash command** (user-invocable via `/name`). Otherwise it's an **auto-triggered** skill that fires automatically based on context.

3. Present the results in two groups:

### Slash Commands

These are invoked manually by typing `/<name>`:

| Command | Description |
| ------- | ----------- |

### Auto-Triggered Skills

These activate automatically when relevant to the task:

| Skill | Description |
| ----- | ----------- |

Sort alphabetically within each group.
