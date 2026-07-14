# Remote Troubleshoot Execution Action

The Remote Troubleshoot Execution Action is an optional feature that surfaces a button in the task properties panel when a pipeline execution is in a problematic state. Clicking it opens a modal where the user can add context, then submits a structured payload to a configurable endpoint — allowing the deployment operator to integrate with an external troubleshooting or on-call system.

The feature is intentionally OSS-friendly: it renders nothing when unconfigured, and the payload schema is generic enough to adapt to any HTTP-based integration.

## How it works

1. When a task node is selected in the run view, the button appears if:
   - `window.__TANGLE_REMOTE_TROUBLESHOOT_ACTION__` is set (see [Configuration](#configuration))
   - The hostname is not `localhost` / `127.0.0.1` / `*.local`
   - The execution status is immediately eligible (`FAILED`, `CANCELLED`, `SYSTEM_ERROR`), or has been `PENDING` / `QUEUED` for more than 5 minutes
2. After submission, a localStorage record is written keyed by `(runId, executionId)`. Subsequent views of the same execution show "session opened at [time]" instead of the button, preventing duplicate requests.

## Configuration

Set `window.__TANGLE_REMOTE_TROUBLESHOOT_ACTION__` to a `RemoteTroubleshootActionConfig` object before the React app mounts. Because the config is static deploy-time data, inline it directly in your `index.html` with a synchronous `<script>`. This sets the global at HTML parse time, so it is ready before the app mounts without a render-blocking network round-trip:

```html
<script>
  window.__TANGLE_REMOTE_TROUBLESHOOT_ACTION__ = {
    endpointUrl: "https://your-backend.example.com/api/troubleshoot",
    buttonText: "Get help with this execution",
    modalTitle: "Get help with this execution",
    modalDescription:
      "Describe the problem or add any context, then submit to notify your support channel.",
    successTitle: "Request submitted",
    successMessage:
      "Your request has been submitted. Someone will follow up shortly.",
    source: "my-deployment",
  };
</script>
```

Leaving the global unset (the default) disables the feature entirely — the button renders nothing.

### Config shape

```typescript
interface RemoteTroubleshootActionConfig {
  /** URL the payload will be POSTed to. */
  endpointUrl: string;

  /** Label shown on the button and used as the default modal title. */
  buttonText: string;

  /** Optional modal title (defaults to buttonText). */
  modalTitle?: string;

  /** Optional modal description shown above the comments textarea. */
  modalDescription?: string;

  /** Optional heading shown in the success state (defaults to "Request submitted"). */
  successTitle?: string;

  /** Optional body shown in the success state, and persisted in the task panel after submission. */
  successMessage?: string;

  /**
   * Optional source tag included in the payload (defaults to "tangle-ui").
   * Use this to distinguish requests from different deployments.
   */
  source?: string;
}
```

### Minimal example

Only `endpointUrl` and `buttonText` are required:

```html
<script>
  window.__TANGLE_REMOTE_TROUBLESHOOT_ACTION__ = {
    endpointUrl:
      "https://your-backend.example.com/api/remote_troubleshoot/execution",
    buttonText: "Get help with this execution",
  };
</script>
```

## Payload

The button POSTs the following JSON body to `endpointUrl`:

```json
{
  "execution_id": "abc123",
  "user_email": "user@example.com",
  "pipeline_run_id": "run-456",
  "pipeline_run_url": "https://your-deployment.example.com/runs/run-456",
  "execution_url": "https://your-deployment.example.com/runs/run-456?nodeId=task_MyTask",
  "additional_comments": "Optional user-provided context.",
  "source": "tangle-ui"
}
```

| Field                 | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `execution_id`        | ID of the specific task execution                                 |
| `user_email`          | Authenticated user's email (empty string if unavailable)          |
| `pipeline_run_id`     | ID of the parent pipeline run                                     |
| `pipeline_run_url`    | URL of the run view page                                          |
| `execution_url`       | Deep-link to the specific task node via `?nodeId=task_<taskName>` |
| `additional_comments` | Free-text context entered by the user in the modal                |
| `source`              | Deployment identifier from config (`source` field)                |

The endpoint is expected to return any `2xx` status on success. Any non-`2xx` response causes the modal to return to the input state so the user can retry.

## Visibility logic

| Status         | Visible after |
| -------------- | ------------- |
| `FAILED`       | Immediately   |
| `CANCELLED`    | Immediately   |
| `SYSTEM_ERROR` | Immediately   |
| `PENDING`      | 5 minutes     |
| `QUEUED`       | 5 minutes     |
| All others     | Never         |

The 5-minute timer measures how long the execution has actually been in its current status. The start time comes from the server: the button fetches the execution's `/details` response and reads the `first_observed_at` of the last `status_history` entry (the current status). This is consistent across reloads and between viewers.

If the server has no status history for the execution yet, the `PENDING` / `QUEUED` button stays hidden — the timer requires the server timestamp rather than falling back to a browser-session clock. Immediately-eligible statuses (`FAILED`, `CANCELLED`, `SYSTEM_ERROR`) are unaffected. Elapsed time is re-checked every 10 seconds.

The `/details` request is re-issued whenever the task's status changes, so a task that transitions while the panel is open (for example `QUEUED` → `PENDING`) picks up the new status's start time and shows the button on its own — the panel does not need to be closed and reopened. Because the timer measures time in the _current_ status, each transition starts a fresh 5-minute clock.
