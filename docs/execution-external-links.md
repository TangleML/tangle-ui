# Execution External Links

A backend launcher can attach links to an execution, such as the job's page in the system that ran it. Tangle-UI shows each link as a row in the task's **Execution Details** panel, so launchers can point users at their own consoles without any frontend changes.

The feature renders nothing unless the backend sends links.

## How it works

Tangle-UI reads `debug_info.external_links` from the container execution state (`GET /api/executions/{id}/container_state`). Each valid entry becomes a row below the built-in execution details. The row's label is the entry's `label`, and its value is a link that opens in a new tab.

## Shape

```json
{
  "debug_info": {
    "external_links": [
      {
        "label": "Job dashboard",
        "text": "job-123",
        "url": "https://jobs.example.com/jobs/job-123"
      }
    ]
  }
}
```

| Field   | Required | Meaning                                      |
| ------- | -------- | -------------------------------------------- |
| `label` | yes      | Row label. Must be a non-empty string        |
| `url`   | yes      | Link target. Must be an absolute http(s) URL |
| `text`  | no       | Link text; defaults to `url`                 |

Invalid entries are dropped silently: a missing or empty label, or a URL that is relative or uses another scheme. A value that is not an array is ignored. If an entry's label matches a row that is already shown, the entry is skipped, so give each link a distinct label.

## Producing links

`debug_info` is the launcher's persisted launched-container data, so a launcher adds the key in its `to_dict()` output. Build URLs from values the launcher persists rather than from live configuration. That way a handle that is reloaded from the database serializes to the same links.
