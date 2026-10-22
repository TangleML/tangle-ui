# Canvas workspaces

The application has one editor and one run view. Their public routes are
`/editor`, `/editor/new/pipeline`, `/editor/pipeline/$pipelineId`, and
`/runs/$id[/$subgraphExecutionId]`. The `v2` directory is the historical location
of the surviving implementation; there is no version switch or legacy editor.

## Layout

- `pages/Editor` owns editable pipeline behavior, remote loading, autosave, undo,
  clipboard, and editor tools. Routed and embedded editors use
  `EditorCanvasProvider`, `useEditorWorkspace`, and `EditorViewport` for their
  common providers, lifecycle, tools, and canvas. Their hosts supply navigation,
  project context, layout, and agent integration.
- `pages/RunView` owns execution inspection. The routed and embedded views share
  query data, run actions, navigation, and the `RunViewViewport` composition.
- `pages/CompareView` compares runs using the same execution query layer.
- `pages/Tangent` composes existing editor and run views into project workareas.
- `shared` contains the canvas registry, selection/navigation stores, shortcuts,
  windows, and presentation reused by these views.
- `src/models/componentSpec` owns the editable graph and serialization.
- `src/services/pipelineStorage` owns remote documents and in-memory drafts.

Reuse the existing model and save/undo lifecycle when adding a consumer. Put code
in shared infrastructure only for an actual shared use. Keep backend data in
React Query and avoid copying it into UI stores.

## Canvas capabilities

Each canvas supplies a node registry. Editor nodes expose mutation actions;
read-only pipeline and run nodes expose inspection and navigation. Registry
capabilities control context menus, keyboard commands, and canvas operations.
The surrounding shell, details, windows, and navigation remain available in
read-only mode.

Shared utilities must not import a legacy node registry as a side effect of
reading constants or types. This keeps canvas rendering independent from any
other editor implementation.

See [state ownership](./STORE_ARCHITECTURE.md) and
[remote documents](../../services/pipelineStorage/ARCHITECTURE.md) for lifetimes
and failure handling.
