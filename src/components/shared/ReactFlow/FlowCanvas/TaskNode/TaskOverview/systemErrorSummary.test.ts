import { describe, expect, test } from "vitest";

import { getSystemErrorSummary } from "./systemErrorSummary";

const LAUNCH_FAILURE = `Traceback (most recent call last):
  File "/app/launchers/davies.py", line 340, in launch_container_task
    job = self.jobs_as_user(created_by).submit(spec, follow=False)
          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/app/.venv/lib/python3.12/site-packages/mlsdk/jobs/_davies_http.py", line 285, in _request
    raise JobAuthError(message)
mlsdk.jobs.errors.JobAuthError: Unauthorized

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/app/backend/cloud_pipelines_backend/orchestrator_sql.py", line 791, in internal_process_one_queued_execution
    self._launcher.launch_container_task(
  File "/app/launchers/davies.py", line 361, in _raise_if_account_missing
    raise launcher_interfaces.LauncherError(
backend.cloud_pipelines_backend.launchers.interfaces.LauncherError: someone@shopify.com has no active account.
`;

describe("getSystemErrorSummary", () => {
  test("returns the final exception of a chain, without its module path", () => {
    expect(getSystemErrorSummary(LAUNCH_FAILURE)).toBe(
      "LauncherError: someone@shopify.com has no active account.",
    );
  });

  test("ignores an earlier cause whose own message is multi-line and unindented", () => {
    const htmlBodyCause = `Traceback (most recent call last):
  File "/app/launchers/davies.py", line 340, in launch_container_task
    job = self.jobs_as_user(created_by).submit(spec, follow=False)
mlsdk.jobs.errors.JobSubmitError: <!DOCTYPE HTML>
<html lang="en">
<body>
<p>Error code: 501</p>
</body>
</html>

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/app/launchers/davies.py", line 361, in _raise_if_account_missing
    raise launcher_interfaces.LauncherError(
backend.cloud_pipelines_backend.launchers.interfaces.LauncherError: No account.
`;

    expect(getSystemErrorSummary(htmlBodyCause)).toBe(
      "LauncherError: No account.",
    );
  });

  test("keeps a multi-line final message whole", () => {
    const traceback = `Traceback (most recent call last):
  File "/app/run.py", line 1, in go
    raise ValueError(...)
ValueError: first line
second line
`;

    expect(getSystemErrorSummary(traceback)).toBe(
      "ValueError: first line\nsecond line",
    );
  });

  test("keeps the exception name when the message alone would say nothing", () => {
    const traceback = `Traceback (most recent call last):
  File "/app/run.py", line 1, in go
    spec["cluster"]
KeyError: 'cluster'
`;

    expect(getSystemErrorSummary(traceback)).toBe("KeyError: 'cluster'");
  });

  test("handles an exception raised with no message", () => {
    const traceback = `Traceback (most recent call last):
  File "/app/run.py", line 1, in go
    wait()
KeyboardInterrupt
`;

    expect(getSystemErrorSummary(traceback)).toBe("KeyboardInterrupt");
  });

  test("passes through a plain message that is not a traceback", () => {
    const message =
      "Container execution is marked as FAILED due to missing outputs: ['out'].";

    expect(getSystemErrorSummary(message)).toBe(message);
  });

  test("caps a very long message", () => {
    const traceback = `Traceback (most recent call last):
  File "/app/run.py", line 1, in go
    raise RuntimeError(body)
RuntimeError: ${"x".repeat(2000)}
`;

    const summary = getSystemErrorSummary(traceback);

    expect(summary).toHaveLength(501);
    expect(summary?.endsWith("…")).toBe(true);
  });

  test("returns null when there is nothing to show", () => {
    expect(getSystemErrorSummary(undefined)).toBeNull();
    expect(getSystemErrorSummary(null)).toBeNull();
    expect(getSystemErrorSummary("   \n  ")).toBeNull();
  });

  test("returns null for a traceback that ends at its last frame", () => {
    const truncated = `Traceback (most recent call last):
  File "/app/run.py", line 1, in go
    raise RuntimeError("boom")
`;

    expect(getSystemErrorSummary(truncated)).toBeNull();
  });
});
