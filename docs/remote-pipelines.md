# Remote Pipelines

Set `VITE_REMOTE_PIPELINES_ENABLED=true` at build time to enable remote pipeline storage for everyone on a deployment. It is off by default and has no user-facing toggle. Configure the existing backend connection and authentication; the backend must support `/api/users/me/pipelines` and `/api/pipelines/{id}`.

## Behavior

- New, imported, and cloned pipelines are uploaded to the signed-in user's pipeline collection. Remote mode uses the V2 editor.
- Existing browser-local pipelines upload automatically on the next edit and autosave, or immediately with **Save to server**. Merely opening an unchanged pipeline does not upload it. Publishing switches the open editor to remote autosave without reloading its model or undo history. Connected filesystem and Google Drive files are not migrated.
- Confirmed migrations hide the local entry, keep its recovery copy, and redirect local favorites and recent-history references. Favorites and history are not synchronized across computers.
- The Pipelines page separates **Remote pipelines** and **Local pipelines** into tabs. It defaults to Remote when remote pipelines exist, or Local when only local pipelines exist. Selecting a tab keeps it selected through refreshes and uploads. With remote storage disabled, the existing local list has no storage tabs.
- Both tabs show ten pipelines per page. Remote browsing requests one page of summaries at a time and caches visited pages; it does not download pipeline definitions. Only the current user's remote collection is listed. Local pipelines retain their tags, metadata search, and component search.
- Remote search matches names. Searching, filtering by date, or changing the default newest-first sort loads the complete summary catalog and applies those filters across it. The backend currently has no title-search or alternate-sort parameters. Full definitions are loaded when opening pipelines; remote list rows omit tags and the local Last run column.
- The Local tab includes browser-local pipelines and failed first uploads marked **Pending upload**. Confirmed uploads move to the Remote tab; recovery drafts for existing remote pipelines stay attached to their remote entries. Browser-local pipelines retain their subtle **Local** badge.
- Remote editor URLs use `/editor-v2/<pipeline-id>` against the configured backend. Local URLs keep the pipeline name. Old backend-scoped URLs still open and are shortened in place.
- Other authorized viewers can open a remote URL read-only and clone it into their own collection. Backend ownership and write permissions remain authoritative.
- Edits autosave, but opening a pipeline does not save it. The last successful save wins across sessions; there is no conflict dialog, locking between computers, or live collaboration.
- Failed uploads retain the draft in IndexedDB and show **Not saved to server** with **Retry**. Initial failures remain **Pending upload**. Opening a recoverable draft never automatically retries an upload.

## Limits

- Recovery and pending drafts live in this browser, scoped to its account and backend. Clearing site data removes them. Hidden backups are not exposed through a restore UI yet.
- Reopening a remote pipeline needs a working backend unless this browser has an unsaved recovery draft. When the server list is unavailable, the Remote tab retains loaded rows or displays this browser's cached remote entries with an error and a notice that the list may be incomplete. Pending first uploads remain available in Local.
- Saving validates the pipeline's schema, not whether it can run successfully. Invalid definitions stay recoverable locally until corrected.
- Root definitions must include an inline component specification to open in the editor. URL-only root definitions are not supported yet.
- Renaming changes the displayed component name, not the stable server storage path. Remote pipelines currently appear at the top level, not in local folders.
- Disabling the deployment flag does not delete remote data or local recovery data. Confirmed migration backups remain hidden in the pipeline list; re-enable the flag to work with their remote entries.

## Follow-ups

- Add tags and component-name summaries to the list API. Derive them on save and store them in the existing version `extra_data`; backfill older versions and populate missing metadata when unchanged or historical versions are reused.
- Add a batched latest/recent-run summary for the visible pipeline IDs, including run ID, time, and status. Refresh run summaries independently of pipeline summaries and associate runs by stable pipeline ID, including editor and backend-created runs.
- Add backend filtering for metadata, names, and dates, plus alternate sorting, so large collections do not require downloading the complete summary catalog.
- Defer automatic definition or run-status requests for each row: request volume grows with the number of pipelines and can cause HTTP 429 responses. Acceptance: displaying pipeline metadata and run summaries requires no per-row definition or status requests.

## Verification

Run `pnpm run test:e2e:remote` to test the browser workflow with mocked backend responses. This suite also runs in CI. The dedicated configuration starts a remote-enabled app on port 3001; keep that port free or use an existing server started with the same configuration. Chromium must be installed (`pnpm exec playwright install chromium`). The tests cover migration and local reference preservation, remote creation and autosave, pending upload retry, read-only viewing and cloning, and opening without saving. They do not write to a real backend.
