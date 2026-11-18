---
name: distributed-stacks
description: Describe a shared feature spanning PRs in multiple repositories using a portable Distributed Stack section. Use when creating or updating PR descriptions with cross-repository companion work, coordinating review/testing, or documenting PR dependencies.
---

# Distributed Stacks

A distributed stack groups PRs across repositories for a shared feature. It can
contain ordinary PRs or existing vertical stacks. Membership does not imply a
merge order, permission to modify another PR, or simultaneous deployment.

## When to use

When preparing a PR, check whether the same feature has known companion PRs in
other repositories. Add this section only for direct, coordinated feature work,
not references for context, alternatives, follow-up work, or a shared author.
For same-repository ancestry alone, preserve the actual base/head chain rather
than declaring a cross-repository group unnecessarily.

## Establish the facts and visibility

- Read the current PR description before editing it. Preserve useful content,
  screenshots, test evidence, issue links, existing members and dependencies.
- Use only verified existing PR URLs supplied by the user or resolved through
  GitHub. Never invent numbers, URLs, relationships, or testing claims.
- Check the visibility of the current repository and every referenced repository.
  For example: `gh api repos/OWNER/REPO --jq .visibility`.
- This repository is public. Never publish private repository names, PR URLs,
  confidential feature names, proprietary relationships, or internal service
  links in its PR descriptions. Treat inaccessible/unknown visibility as private
  for disclosure purposes. Keep private relationships in an appropriately
  access-controlled internal coordination tool, not in public Markdown.
- All examples and published text must remain vendor-neutral. No internal-tool
  URLs or organization-specific infrastructure assumptions are required.

## Exact portable format

Use actual GitHub URLs, with these exact level-two/level-three headings and
bullet lists. Replace placeholders; omit the entire section when not applicable.

```markdown
## Distributed Stack

Feature: Short descriptive name for the shared feature

### Coordinate with

- https://github.com/OWNER/REPO/pull/123
- https://github.com/OTHER-OWNER/OTHER-REPO/pull/456

### Depends on

- https://github.com/OWNER/BACKEND-REPO/pull/789
```

- `Feature:` is the shared group's name. Reuse an established name when known;
  choose a concise public-safe name otherwise. Names are context, not unique IDs.
- `Coordinate with` lists companion PRs to review/test as a feature. The current
  PR is included automatically and need not list itself.
- `Depends on` lists PRs **this PR requires first**. Omit this subsection unless
  the dependency is established. Do not make reciprocal dependency edges for
  PRs that merely belong together; use membership instead.
- A PR listed only under `Depends on` is also a proposed member. Listing it under
  both subsections is permitted but unnecessary.
- Each PR describes dependencies from its own perspective. Do not put a whole
  feature dependency graph into every PR or assume its backend depends on clients.
- Keep links as real prose bullets, not inside code fences, quotes, HTML comments
  or an unrelated `Related PRs` section: those are not declarations.
- A declaration can include the public subset of a mixed-visibility feature;
  do not claim the published list is exhaustive when private companions exist.

## Updating descriptions

When explicitly authorized to create/edit a PR, integrate this section with the
repository template, immediately after `Related Issue and Pull requests`. Update
an existing Distributed Stack section rather than duplicating it. Move verified
companion links from a generic related section when appropriate, but retain
unrelated issue/context references there. Inspect the final body for disclosure
and accidental deletion before publishing, then fetch it back to verify.

Without publishing authorization, provide the drafted section in chat. This
skill does not itself authorize GitHub writes, merges, checkouts or deployments.

## What consumers can infer

The section is a proposal for shared membership and directed dependencies, not
proof of agreement from linked PR authors. Tools may require confirmation before
saving a group. Updating one declaration need not overwrite confirmed membership
or manual exclusions. Do not promise reverse-link discovery, atomic cross-repo
merging, or automatic reconfiguration of running applications.
