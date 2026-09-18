# Remote Pipelines

Set `VITE_REMOTE_PIPELINES_ENABLED=true` at build time to enable remote pipeline storage for everyone on a deployment. It is off by default and has no user-facing toggle. Configure the existing backend connection and authentication; the backend must support `/api/users/me/pipelines` and `/api/pipelines/{id}`.

## Behavior

- New, imported, and cloned pipelines are uploaded to the signed-in user's pipeline collection. Remote mode uses the V2 editor.
- Existing browser-local pipelines upload automatically on the next edit and autosave, or immediately with **Save to server**. Merely opening an unchanged pipeline does not upload it. Publishing switches the open editor to remote autosave without reloading its model or undo history. Connected filesystem and Google Drive files are not migrated.
- Confirmed migrations hide the local entry, keep its recovery copy, and redirect local favorites and recent-history references. Favorites and history are not synchronized across computers.
- The list marks browser-local pipelines with a subtle **Local** badge; saved remote pipelines are unbadged. Failed initial uploads remain **Pending upload**. Only the current user's remote collection is listed.
- Remote editor URLs use `/editor-v2/<pipeline-id>` against the configured backend. Local URLs keep the pipeline name. Old backend-scoped URLs still open and are shortened in place.
- Other authorized viewers can open a remote URL read-only and clone it into their own collection. Backend ownership and write permissions remain authoritative.
- Edits autosave, but opening a pipeline does not save it. The last successful save wins across sessions; there is no conflict dialog, locking between computers, or live collaboration.
- Failed uploads retain the draft in IndexedDB and show **Not saved to server** with **Retry**. Initial failures remain **Pending upload**. Opening a recoverable draft never automatically retries an upload.

## Limits

- Recovery and pending drafts live in this browser, scoped to its account and backend. Clearing site data removes them. Hidden backups are not exposed through a restore UI yet.
- Reopening a remote pipeline needs a working backend unless this browser has an unsaved recovery draft. The remote list can show cached entries and pending drafts when the server is unavailable, with an error banner.
- Saving validates the pipeline's schema, not whether it can run successfully. Invalid definitions stay recoverable locally until corrected.
- Root definitions must include an inline component specification to open in the editor. URL-only root definitions are not supported yet.
- Renaming changes the displayed component name, not the stable server storage path. Remote pipelines currently appear at the top level, not in local folders.
- Disabling the deployment flag does not delete remote data or local recovery data. Confirmed migration backups remain hidden in the pipeline list; re-enable the flag to work with their remote entries.

## Verification

Run `pnpm run test:e2e:remote` to test the browser workflow with mocked backend responses. This suite also runs in CI. The dedicated configuration starts a remote-enabled app on port 3001; keep that port free or use an existing server started with the same configuration. Chromium must be installed (`pnpm exec playwright install chromium`). The tests cover migration and local reference preservation, remote creation and autosave, pending upload retry, read-only viewing and cloning, and opening without saving. They do not write to a real backend.
