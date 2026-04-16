---
name: analytics-tracking
description: How to track analytics events in tangle-ui and naming conventions for action_type values. Use when adding a new tracked event, naming an action_type, or working with the analytics provider.
---

# Analytics Tracking

## How to track an event

Import `track` directly from `@/utils/analytics` and call it with an `action_type` string and optional metadata:

```ts
import { track } from "@/utils/analytics";

track("pipeline_run.task.artifact_preview.impression", {
  artifact_type: "csv",
});
```

The `track` function dispatches a `tangle.analytics.track` browser `CustomEvent`. In OSS deployments this is a no-op unless a consumer listens for the event. In Shopify-internal deployments a separate analytics bundle loaded via `index.html` listens for this event and forwards it to Monorail.

### Event detail shape

The dispatched `CustomEvent` carries the following `detail` fields:

| Field         | Type                     | Description                                           |
| ------------- | ------------------------ | ----------------------------------------------------- |
| `actionType`  | `string`                 | The action type string passed to `track`              |
| `metadata`    | `Record<string,unknown>` | Optional metadata object                              |
| `sessionId`   | `string`                 | Anonymous tab session ID (see session tracking below) |
| `route`       | `string`                 | `window.location.pathname` at time of call            |
| `appVersion`  | `string \| undefined`    | `VITE_GIT_COMMIT` build variable                      |
| `environment` | `string \| undefined`    | `VITE_TANGLE_ENV` build variable                      |

## Session tracking

The session ID is generated once per browser tab and stored in `sessionStorage`. It resets when the tab is closed.

The format is `<userHash>:<uuid>` once the authenticated user is identified, otherwise a plain UUID. If `identifyUser` is called after the first `track` (i.e. the session was created before the user resolved), the existing plain-UUID session is upgraded in-place to `<userHash>:<uuid>` so subsequent events carry the prefix.

### Identifying the user

Call `identifyUser` once after the current user is known. The auth layer (`src/hooks/useUserDetails.ts`) does this automatically via a `useEffect` — **you do not need to call it yourself**:

```ts
import { identifyUser } from "@/utils/analytics";

await identifyUser(userId); // hashes userId with SHA-256, stores 8-char prefix
```

## `action_type` naming convention

Use dot-separated, `snake_case` segments following this hierarchy:

```
<feature_area>.<entity>[.<sub_entity>].<action_verb>
```

| Segment        | Description                                           | Examples                                                              |
| -------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| `feature_area` | Top-level product area or workflow                    | `pipeline_run`, `pipeline`, `component`, `session`                    |
| `entity`       | The primary object the user acted on                  | `task`, `node`, `artifact_preview`, `tab`                             |
| `sub_entity`   | Narrows the entity (use only when necessary)          | `artifacts`, `inputs`, `outputs`                                      |
| `action_verb`  | **The concrete action that occurred** — always a verb | `click`, `impression`, `hover`, `shortcut_pressed`, `submit`, `start` |

### Action verb reference

| Verb               | When to use                                                                           |
| ------------------ | ------------------------------------------------------------------------------------- |
| `click`            | User explicitly clicked or tapped a button/link                                       |
| `impression`       | Something became visible for the first time in a session (dialog opened, panel shown) |
| `hover`            | User hovered over an element long enough to trigger a tooltip or preview              |
| `shortcut_pressed` | User triggered an action via keyboard shortcut                                        |
| `submit`           | User submitted a form or confirmed an action                                          |
| `start`            | A lifecycle event began (session started, process initiated)                          |

### Rules

- All segments are `snake_case` — no camelCase, no hyphens.
- The **last segment must always be an action verb** (what the user did or what happened).
- Keep hierarchy shallow — prefer `pipeline.component.click` over `pipeline.canvas.node.component.click`.
- Do not embed counts, IDs, or dynamic values in the `action_type` string. Put them in `metadata` instead.

### Examples

```
pipeline_run.task.artifact_preview.impression  ✓  artifact preview dialog became visible
pipeline.component.click                       ✓  user clicked to add a component
pipeline.run.submit                            ✓  user submitted a pipeline run
pipeline_run.task.logs.impression              ✓  user expanded task logs panel
session.tab.start                              ✓  new tab session started

pipeline_run.task.artifacts.csv_preview        ✗  artifact type belongs in metadata
pipelineRun.task.artifactsPreview              ✗  camelCase not allowed
pipeline.run.submit.clicked                    ✗  too many segments; "clicked" is redundant with "submit"
pipeline_run.task.artifacts.preview            ✗  "preview" is a noun, not an action verb — use "impression"
```

## Metadata

Pass an object as the second argument for event-specific properties. Keys should be `snake_case`. Values must never contain PII (no emails, names, user IDs, or free-form user input).

```ts
track("pipeline_run.task.artifact_preview.impression", {
  artifact_type: "csv",
});
track("pipeline.component.click", { component_name: "XGBoostTrainer" });
track("session.tab.start", {
  flags: { dashboard: true, "input-aggregator": false },
});
```
