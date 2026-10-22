# Pipeline documents

Pipelines are saved to the configured backend. There is one editable document
owner: `PipelineStorageService`. Each open identity resolves to the same model,
`PipelineFile`, save state, and undo manager. Server query caches contain server
snapshots; they do not own live editor models.

Mounted editors and retained workarea tabs keep documents alive. This includes
tabs in inactive sessions. When the last owner leaves, changed documents flush.
Clean documents release their model, undo middleware, and save watchers. Failed
or pending saves keep the same document available for reopening and retry.
An untouched draft is abandoned on close and created only by an explicit Save
or a content edit.

`PipelineFile` owns remote identity, permissions, and ordered transport. Reads
and writes use typed specs. Import and export are the YAML boundaries. A draft
keeps its server file path through retries and acquires its server ID without
replacing the file or document. Both identities resolve to the same owner before
promotion observers run. Session history stores only saved draft aliases and
owner identity, never pipeline content.

Every write rechecks the current writer. Reopening waits for admitted writes,
and deletion blocks later writes while draining those already admitted. An
uncertain deletion remains blocked until the server can confirm its result.
Deleted documents with unsaved edits stay available for Save As recovery;
clean documents show the unavailable state.

`DocumentSaveState` watches model edits, debounces autosave, tracks pending
snapshots, and owns unload protection. JSON fingerprints compare typed snapshots;
there is no YAML round trip or artificial delay in saving. Mounted save and undo
stores point at document state rather than duplicating it. Renaming is an ordinary
model edit followed by the same save operation. Save As preserves source task
and run metadata while creating a distinct remote document.
