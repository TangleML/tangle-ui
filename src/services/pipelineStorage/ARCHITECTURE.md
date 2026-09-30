# Pipeline Storage Architecture

`PipelineStorageService` creates and resolves documents. Every document is one
`PipelineFile` with an immutable application ID and a replaceable storage driver.
A successful browser-local upload changes the existing file's driver and server
locator in place. The editor keeps its document, model, and undo history.

## Ownership

| Module                        | Responsibility                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PipelineStorageService`      | Account/backend session, creation, resolution, folder access, remote summary pages, document identity cache    |
| `PipelineFile`                | Content operations, recovery staging, save status, publishing, retry, rename, deletion, driver changes         |
| `PipelineFolder`              | Folder tree, local registry assignment, canonical file construction within a service                           |
| `PipelineStorageDriver`       | Storage I/O and optional returned metadata                                                                     |
| `RemotePipelineStorageDriver` | Backend authentication, summary requests, full-definition reads, remote writes/deletes and metadata conversion |
| `remotePipelineRecovery`      | Durable drafts and summaries, atomic revision merges, migration records and deletion tombstones                |
| `pipelineLock`                | Serializes publication, rename, move, and deletion for each document across tabs where Web Locks are available |
| `migratePipelineReferences`   | Updates browser favorites/history to the confirmed locator while preserving application identity               |

There is no remote file subclass or file-to-file forwarding. Folders pass files
through the service's identity cache, so listing and opening the same local file
within one service returns the same object. Independent sessions reconcile through
the durable journal before operations.

## Identity and locators

- `id` identifies the application document. It never changes during publishing,
  retry, rename, or a local folder move. Recovery records persist `documentId`.
- `referenceId` is the current navigation locator: a local name, pending recovery
  reference, or backend-scoped server reference.
- `remoteId` and `remoteBackendUrl` identify the confirmed backend pipeline.
- `storageKey` belongs to the active driver. Remote renames change the saved
  component name while keeping the server storage path and ID.

The service accepts application IDs, local names, bare server UUIDs, and older
backend-scoped references. A registered or legacy local name takes precedence over
interpreting a UUID-shaped name as a server ID. Old migration records without a
`documentId` retain their local ID or existing reference as their identity.

## Local drivers and folders

`PipelineStorageDriver` supports `list`, `read`, `write`, `rename`, `delete`, and
`hasKey`. Reads may return text or text plus metadata; writes and renames may return
updated metadata. The file applies those results without replacing its ID.

Browser-local folders use `FolderIndexDbStorageDriver`, which stores content in the
legacy component list and uses the `tangle_pipelines.pipeline_registry` table to
associate files with folders. Registry assignment performs lookup and insertion in
one transaction. The `folders` table stores names, parents, and driver configuration.
Deleting a folder detaches its documents to the root in the same transaction.

Filesystem and Google Drive drivers remain connected-folder storage. They do not
participate in automatic remote publishing or the remote recovery journal. Driver
move capabilities and browser filesystem permissions remain authoritative.

## Drafts, upload, and deletion

Remote storage is configured for the service, with account and backend information
provided by `PipelineStorageProvider`. Changing the account, token, or backend
creates a new service session. Durable records are scoped by account and backend;
query cache keys additionally use the service session identity.

`persistRecovery` stores raw text in `tangle_remote_pipelines.copies` before editor
debounce or parsing. It increments the revision in a transaction. Invalid YAML
therefore remains recoverable. Opening a document never uploads it or retries an
unsaved draft.

`write` stages the latest text and flushes it. Browser-local files configured for
remote storage publish automatically on that first write; explicit Save to server
calls the same file's `retry`. Uploads retain their stable storage path, including
when an upload succeeded but its response was lost. New failed uploads remain
pending; unsuccessful local migrations remain local.

The upload response is merged against the latest durable revision. A newer edit
keeps its content, revision, timestamp, and dirty state while gaining the confirmed
server ID. Reference migration follows that durable confirmation, so interruption
cannot turn retry into another creation. Confirmed local backups remain hidden,
including with remote storage disabled.

Upload and deletion share a lock. Deletion uses the confirmed identity or the
pending stable path and writes a tombstone only after server confirmation. Stale
handles and queued writes check the tombstone before staging or uploading. An
unconfirmed delete remains retryable. Browser storage is recovery storage, not
cross-device collaboration; the backend's last successful save wins.

## Listing and opening

Remote pages request summaries only, returning the server cursor and total count.
Visited owned summaries are cached durably without fetching definitions. Matching
dirty drafts overlay their own entries; another owner's identical path never
receives the current account's draft. Pending creations are listed separately from
confirmed remote entries.

The UI owns query pagination and the policy for showing cached fallback results.
`listCachedPipelines` supplies this account/backend's confirmed cached entries;
`remoteListError` records request failures. Resolution returns a cached or unloaded handle without reading a definition.
The editor calls `file.read()` when loading its model; clean remote reads fetch the
backend, and dirty recovery reads use the durable draft. This gives first opens one
definition request and lets canonical URL changes reuse the active document. A
summary-backed clone loads its source metadata when necessary.
Opening clean cached remote content still validates against the backend. Dirty
recovery can reopen offline without an upload.

Remote ownership and backend write permissions determine `canEdit`; the backend
also checks mutations. Read-only pipelines can be opened and used as clone sources.
Cloning retains backend task settings while assigning a fresh document and path.

## Consumer boundary

Components use `usePipelineStorage`, the returned service, and `PipelineFile` or
`PipelineFolder`. Driver, journal, database, and registry modules are internal.
Consumers use `storageKind`, `canEdit`, `saveError`, `lastWriteError`, `isSaving`,
`lastSavedAt`, and the identity/locator getters instead of checking concrete file
classes. Editor scheduling owns debounce deadlines and serialization; the file owns
transport, durable state, and save status.
