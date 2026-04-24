---
name: analytics-tracking
description: How to track analytics events in tangle-ui and naming conventions for action_type values. Use when adding a new tracked event, naming an action_type, or working with the analytics provider.
---

# Analytics Tracking

## Tracking click events (preferred approach)

For click events on interactive elements (`<button>`, `<a>`, `<summary>`, or elements with `role="button"` / `role="link"`), use the `tracking()` helper to attach data attributes. A document-level click listener (`useClickTracking`) automatically fires the analytics event — no manual `track()` call needed.

```tsx
import { tracking } from "@/utils/tracking";

<Button onClick={handleSave} {...tracking("pipeline_editor.save_pipeline")}>
  Save
</Button>;
```

The listener appends `.click` to the identifier automatically, so `"pipeline_editor.save_pipeline"` fires as `"pipeline_editor.save_pipeline.click"`.

### With metadata

Pass a second argument for event-specific properties. The metadata is serialized as a `data-tracking-metadata` JSON attribute on the DOM element.

```tsx
<Button
  onClick={() => handleLayout(algo)}
  {...tracking("pipeline_canvas.tool_bar.auto_layout_select", {
    selected_layout: algo,
    page_type: "pipeline_editor",
  })}
>
  {algo}
</Button>
```

### Prop drilling for click tracking

When a child component renders the interactive element but the parent owns the tracking context, prefer prop drilling or forwarding rest props so `data-tracking-id` reaches the DOM element. This is intentional — it keeps tracking declarative and avoids manual `track()` calls scattered across the codebase.

```tsx
// Parent passes tracking attributes
<ActionButton
  tooltip="Export Pipeline"
  icon="FileDown"
  onClick={handleExport}
  {...tracking("pipeline_editor.pipeline_actions.export_pipeline")}
/>;

// ActionButton forwards rest props to the underlying <TooltipButton> → <Button> → DOM
export const ActionButton = ({
  tooltip,
  onClick,
  icon,
  ...rest
}: ActionButtonProps) => (
  <TooltipButton onClick={onClick} tooltip={tooltip} {...rest}>
    <Icon name={icon} />
  </TooltipButton>
);
```

For components that wrap interactive elements (e.g. Radix `asChild` patterns), spread `tracking()` on the wrapper — Radix merges props onto the child:

```tsx
<DialogTrigger
  asChild
  {...tracking("pipeline_editor.task_node.component_info")}
>
  <InfoIconButton />
</DialogTrigger>
```

### Dynamic metadata at render time

When metadata depends on component state that is known at render time, compute it inline. The data attribute updates on each render:

```tsx
<Button
  onClick={() => toggleFavorite()}
  {...(analyticsActionType
    ? tracking(analyticsActionType, { new_value: !active })
    : {})}
>
```

## When to use manual `track()` instead

Use `useAnalytics` and call `track()` directly only when the document-level click listener cannot handle the scenario:

| Scenario                     | Why manual                                                                                     | Example                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Outcome events**           | Fire after an async operation succeeds, not on click                                           | `track("pipeline_editor.pipeline_actions.save_pipeline_as_completed")` |
| **Impression events**        | Fire when something becomes visible (dialog, panel), not from a click                          | `track("pipeline_editor.name_pipeline_dialog_impression")`             |
| **Debounced events**         | Fire after a delay (e.g. text field editing)                                                   | `debouncedTrack()` using `debounce` from `@/utils/debounce`            |
| **Toggle state**             | Metadata includes the new value from an `onChange` callback argument, not known at render time | `track("settings.toggle_changed", { new_value: checked })`             |
| **Non-interactive elements** | The click target is not a `<button>`, `<a>`, `<summary>`, or `role="button"`/`role="link"`     | React Flow's internal `Controls` callbacks (`onZoomIn`, etc.)          |

```tsx
import { useAnalytics } from "@/providers/AnalyticsProvider";

const { track } = useAnalytics();

// Outcome — fires after success, not on click
const handleSave = async (name: string) => {
  await savePipeline(name);
  track("pipeline_editor.pipeline_actions.save_pipeline_as_completed");
};

// Impression — fires when dialog opens
useEffect(() => {
  if (open) {
    track("component_editor.save.already_exists_impression");
  }
}, [open]);
```

## Event detail shape

The dispatched `CustomEvent` carries the following `detail` fields:

| Field         | Type                     | Description                                                      |
| ------------- | ------------------------ | ---------------------------------------------------------------- |
| `actionType`  | `string`                 | The action type string (with `.click` appended for click events) |
| `metadata`    | `Record<string,unknown>` | Optional metadata object                                         |
| `sessionId`   | `string`                 | Anonymous tab session ID                                         |
| `route`       | `string`                 | `window.location.pathname` at time of call                       |
| `appVersion`  | `string \| undefined`    | `VITE_GIT_COMMIT` build variable                                 |
| `environment` | `string \| undefined`    | `VITE_TANGLE_ENV` build variable                                 |

## `action_type` naming convention

Use dot-separated, `snake_case` segments:

```
<feature_area>.<entity>[.<sub_entity>].<action_verb>
```

For `tracking()` data attributes, omit the action verb — the listener appends `.click`:

```
<feature_area>.<entity>[.<sub_entity>]
```

For manual `track()` calls, include the full action verb:

```
<feature_area>.<entity>[.<sub_entity>].<action_verb>
```

### Action verb reference

| Verb         | When to use                                                                           |
| ------------ | ------------------------------------------------------------------------------------- |
| `click`      | User explicitly clicked or tapped a button/link (auto-appended by click listener)     |
| `impression` | Something became visible for the first time in a session (dialog opened, panel shown) |
| `completed`  | An async operation finished successfully                                              |
| `toggle`     | User toggled a switch or checkbox                                                     |

### Rules

- All segments are `snake_case` — no camelCase, no hyphens.
- The **last segment must always be an action verb** for manual `track()` calls.
- For `tracking()` helper calls, the last segment is the entity — `.click` is appended automatically.
- Keep hierarchy shallow — prefer `pipeline.component` over `pipeline.canvas.node.component`.
- Do not embed counts, IDs, or dynamic values in the `action_type` string. Put them in `metadata` instead.

### Examples

```
# tracking() helper (click listener appends .click)
tracking("header.settings")                                    → header.settings.click
tracking("pipeline_editor.task_node.z_index", { action: "move_forward" })
                                                               → pipeline_editor.task_node.z_index.click

# Manual track() calls
track("pipeline_editor.pipeline_actions.save_pipeline_as_completed")    ✓  outcome
track("pipeline_editor.name_pipeline_dialog_impression")                ✓  impression
track("settings.toggle_changed", { flag_name: "dashboard" })           ✓  toggle
track("session.tab.start", { flags: { ... } })                         ✓  lifecycle

# Bad
track("header.settings_click")                    ✗  use tracking() helper instead
track("pipeline.run.submit.clicked")              ✗  "clicked" is redundant
```

## Metadata

Pass an object as the second argument for event-specific properties. Keys should be `snake_case`. Values must never contain PII (no emails, names, user IDs, or free-form user input).

```tsx
tracking("pipeline_canvas.tool_bar.auto_layout_select", {
  selected_layout: "sugiyama",
  page_type: "pipeline_editor",
});

track("settings.secrets.secret_mutated", { action: "created" });
```
