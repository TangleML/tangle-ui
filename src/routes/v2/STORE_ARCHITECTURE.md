# Editor and run state

The editor has one editable document model. Run data comes from the backend and
is held in React Query. Each mounted canvas has its own selection, navigation,
keyboard, overlays, and windows; none of those stores is a module singleton.

## Ownership

| State                                               | Owner                                       | Lifetime                                                 |
| --------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| Editable pipeline graph                             | `ComponentSpec` (MobX Keystone)             | Open document; retained after a failed save              |
| Save status and pending content                     | `DocumentSaveState`                         | Same document, including pending writes after navigation |
| Undo/redo                                           | Retained document                           | Document lifetime; tours use their mounted session       |
| Clipboard and active document references            | `EditorSessionProvider`                     | Mounted editing session                                  |
| Selection, navigation, shortcuts, overlays, windows | `SharedStoreProvider`                       | Mounted canvas                                           |
| Run metadata, execution details, execution state    | React Query                                 | Backend-scoped query cache                               |
| Selected run subgraph                               | Route parameter or embedded workarea target | Current navigation                                       |
| Tour pipeline                                       | In-memory `ComponentSpec`                   | Tour session                                             |

## Editing and saving

`PipelineStorageService` owns each loaded document, including its model, file,
save state, undo manager, and mounted consumers. `useLoadSpec` reads that document through
Suspense; mutable models are not stored in React Query. The loaded document is
passed into the editor, and canvas children do not load it again.

`useSpecLifecycle` attaches the document to navigation and points session undo
at the document’s retained undo manager.
`DocumentSaveState` observes edits and debounces writes; `AutoSaveStore` exposes
that document's status to the mounted editor. `PipelineFile` handles ordered,
typed remote writes and permissions. Renaming is an ordinary model edit. A draft
gains a remote ID after its first successful write without replacing the model
or losing undo in the mounted session. YAML is used for import/export.

Navigation flushes pending edits. A closed document is released only when its
changes are saved. Failed or uncertain saves retain the document in memory, with
retry and YAML export available. This recovery does not survive a browser reload;
the unload guard protects unsaved changes. There is no browser pipeline store or
persisted undo history.

Tours use the same editor with an in-memory model and no autosave target. The
existing Save & Explore action creates a remote pipeline explicitly.

## Run views

`ExecutionDataProvider` loads run metadata, obtains `root_execution_id`, and
queries that execution. A selected `subgraphExecutionId` determines which nested
execution is displayed. Root and nested views share the same backend-scoped
execution query keys. The provider derives task status and breadcrumbs from query
results; it does not maintain a second execution cache or editor-provider state.

Run graphs use a read-only document projection for canvas rendering. Navigating a
subgraph updates the route or embedded workarea target. Selection and window
state remain local to that canvas.

## Mutations and rendering

Document mutations go through model actions and the existing grouped undo
helpers. UI components that read observable values use `observer`; derived values
use MobX computed values when their identity must remain stable. React Query
continues to own fetched server data. Temporary form and dialog state stays in
React components.

`EditorStore.selectedNodes` and `selectedEdgeIds` are the authoritative selection.
Single-node and multi-node views derive from those values. React Flow selection
events update the same store used by shortcuts, links, and agent tools. The
canvas projects selection onto its nodes and edges; React Flow state otherwise
holds transient geometry until a completed drag commits through model actions.

Navigation stores a chain of task IDs and derives breadcrumb names from the
document. Renaming or undoing a rename does not change which graph is open.
Each window store owns its accordion history, dock targets, and persistence
writer, so one mounted editor cannot change another editor's panels.

The component library derives “Used in Pipeline” from the current canvas model.
It does not require a separate global pipeline provider. Read-only pipeline views
retain the same navigation and inspection shell while exposing read-only node
capabilities.

The dashboard, editor, and agent share one component catalogue loader and cache.
The dashboard eagerly hydrates searchable content, the editor can show immediate
name results while hydrating, and agent searches remain bounded and lexical.
