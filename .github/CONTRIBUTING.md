# Contributing to Tangle UI

Thank you for your interest in contributing! We appreciate your time and effort. All contributions, from small typo fixes to large features, are valuable.

## Local setup

Always verify your change locally before submitting a PR.

For a full local environment, you will need set up both Tangle UI and Tangle (backend).

See the following resources:

- [README](../README.md) for Tangle UI
- [README](https://github.com/TangleML/tangle) for Tangle (backend)

## Contribution workflow

<details>
<summary>Do you have a question?</summary>

1. Search current and past [Discussions](https://github.com/TangleML/tangle-ui/discussions?discussions_q=).
1. If no existing discussion exists, create one (see [tips](#tips-for-high-quality-issues) of high-quality Discussions below).
</details>

<details>
<summary>Are you reporting an issue?</summary>

1. First search for existing [Issues](https://github.com/TangleML/tangle-ui/issues).
1. If no existing issue exists, create one (see [tips](#tips-for-high-quality-issues) of high-quality Issues below).
</details>

<details>
<summary>Do you have a feature request?</summary>

1. First search for existing [Issues](https://github.com/TangleML/tangle-ui/issues).
   - Every feature should first have an Issue.
1. If no existing issue exists, create one (see [tips](#tips-for-high-quality-issues) of high-quality Issues below).
</details>

<details>
<summary>Do you want to contribute a fix or feature?</summary>

1. First search for existing [Issues](https://github.com/TangleML/tangle-ui/issues) on the topic.
   - If no Issue exists, create one (see [tips](#tips-for-high-quality-issues) of high-quality Issues below).
1. Discuss the feature or fix on the issue to avoid duplicating work and time spent on amendments.
1. Submit your change for review after reviewing the [tips](#tips-for-high-quality-pull-requests) for high-quality Pull Requests below.
</details>

## Tips for high-quality Issues and Discussions

### Use templates

Select an issue template (Bug report, Feature request, etc.). If no template applies, select "Blank issue" and provide as much detail as possible.

### Clear is kind

Clarity saves time, accelerates solutions, and builds community.

<details>
<summary>Click to see examples of "clear vs. unclear" reporting</summary>

#### Vague vs. Specific Titles

- **Unclear 👎:** "Pipeline doesn't work"
- **Clear 👍:** "[Bug] Pipeline execution fails with 'Connection refused' error when using custom container images"

#### Vague vs. Specific Steps

- **Unclear 👎:** "I tried to run my pipeline and it didn't work. Please fix."
- **Clear 👍:** "**Steps to Reproduce:** 1. Create a pipeline with a custom Python component. 2. Configure the component's input argument with a multiline string. 3. Click 'Run Pipeline'. **Expected:** The pipeline submits and runs successfully. **Actual:** The component fails to parse the input and shows a `TypeError` in the execution logs."

#### Vague vs. Specific Feature Requests

- **Unclear 👎:** "You need to add better error messages."
- **Clear 👍:** "**User Story:** As a data scientist, I need to see detailed validation errors when my component configuration is invalid, so I can fix issues before running a pipeline. Currently, the editor silently ignores invalid YAML in component specs."

</details>

## Tips for high-quality Pull Requests

### Start as a draft

Start your Pull Request as a draft. When the automated checks have passed, and you are confident in the changes as well as the description, then remove the draft to enter review.

### Small and focused

A small, focused Pull Request is easier to understand and review, which means it can be approved and merged much more quickly.

- Split independent changes into small, dedicated Pull Requests.
- Minimize the number of changed code lines in a single Pull Request.
- Do not mix refactoring (no changes to behaviour) and changes that modify behaviour.

### Write or update tests

Tests prove that your change works correctly and prevent it from breaking in the future.

- Use `npm run test` to run unit tests (**Vitest**).
- Use `npm run test:e2e:ci` to run end-to-end tests (**Playwright**).

### Match existing code style

Read through the following resources to familiarize with our programming standards:

- [React Best Practices](../docs/react-best-practices.md)
- [Cursor Rules](../.cursorrules)

Use the following commands to lint and format code before submitting for review:

- `npm run format` to format code.
- `npm run lint` to detect linting errors.
- `npm run lint:fix` to fix linting errors.
- `npm run lint:e2e` to detect linting errors in end-to-end tests.

Propose new standards in an issue or small proof-of-concept pull request. Changes that introduce new standards without discussion first won't receive complete review and are unlikely to be merged.

### Commit messages

Commits should follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) specification.

Here is the structure:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Common prefixes include `chore`, `test`, `feat` (as in feature), and `refactor`.
