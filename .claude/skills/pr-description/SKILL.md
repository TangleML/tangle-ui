---
name: pr-description
description: Draft or rewrite pull request titles and descriptions in plain language using the repository template. Use when preparing a new PR description or updating an existing one.
---

# PR Descriptions

Use the [repository PR template](../../../.github/PULL_REQUEST_TEMPLATE.md) for
section order and prompts. Keep the description understandable to someone who does
not write code and has not seen the conversation.

## Establish the facts

- Read the changes against the actual base branch and enough surrounding code to
  understand the behavior before and after. Do not rely on commit messages alone.
- For an existing PR, read its current description. Preserve useful screenshots,
  test evidence, issue links, and dependencies.
- For a stack, describe only this PR's changes against its actual parent and name
  any dependency. Do not claim behavior delivered only by another PR.

## Write the description

- Give the title and opening explanation a clear purpose in everyday language.
  Explain who benefits, what happens today, and what will happen after the change.
- Keep each section short. A small change may need only a sentence per section.
  Avoid file inventories, jargon, repeated points, and the history of the work.
- Include technical details when they help reviewers understand behavior, a
  tradeoff, or an important limitation. Explain unfamiliar terms.
- Do not invent user-facing problems for internal work or add unsupported claims.
  Use a closing issue reference only when this PR actually resolves the issue.

## Make testing concrete

- Start with numbered UI steps using real screen and control names and visible
  expected results. Include relevant existing behavior that should still work.
  Do not replace UI steps with commands merely because the UI was not tested.
- Assume the normal frontend and backend are already running. Mention only extra
  services or unusual setup, and call out when verification needs no backend.
- When there is no meaningful UI route, explain why and give the smallest useful
  commands or other steps, including what success looks like.
- Write testing instructions directly, without a preamble saying they are
  suggestions or were not run for the description. Add a short factual note for
  relevant checks actually performed or specific verification gaps. Never claim a
  check ran or passed without evidence; automated checks do not establish that
  the UI was tested.

Keep drafts in chat unless the user authorizes creating or updating the PR. This
skill does not itself authorize publishing or changing other PR metadata.
