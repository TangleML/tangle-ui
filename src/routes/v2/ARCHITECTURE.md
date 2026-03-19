# v2 Architecture: File Organization Rules

## Two Layers

```
src/routes/v2/
  shared/     # Infrastructure used by multiple pages
  pages/      # Page-specific code (Editor, RunView)
```

### Dependency Direction

```
pages/* --> shared/       (allowed)
shared/ --> pages/*       (FORBIDDEN)
pages/A --> pages/B       (FORBIDDEN)
```

A page may only depend on `shared/` and external packages. Pages must never import from each other. Shared must never import from any page.

## shared/ -- What Belongs Here

Code goes into `shared/` only when **both** conditions are met:

1. Used by 2+ pages (or by shared infrastructure that is)
2. Has a stable API that doesn't change with page-specific features

| Folder                  | Purpose                                             | Current contents                                                                                                                                           |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store/`                | Selection, navigation, keyboard state               | `editorStore`, `navigationStore`, `keyboardStore`                                                                                                          |
| `nodes/`                | Node type registry class, base types, build utils   | `registry.ts`, `types.ts`, `buildUtils.ts`                                                                                                                 |
| `windows/`              | Window system (dock, float, snap, persist)          | 18 files -- entire window subsystem                                                                                                                        |
| `hooks/`                | Canvas + layout hooks used by both pages            | `useSpecToNodesEdges`, `useCanvasEnhancements`, `useSelectionBehavior`, `useFlowCanvasState`, `useViewportScaling`, `useDockAreaAccordion`, `useFocusMode` |
| `flowCanvasDefaults.ts` | Shared canvas constants and ReactFlow default props | `GRID_SIZE`, `ZOOM_THRESHOLD`, `FLOW_CANVAS_DEFAULT_PROPS`, `nodeTypes`, `edgeTypes`                                                                       |
| `components/`           | Small UI components shared across pages             | `ShorcutBadge`, `MenuTriggerButton`, `AppMenuActions`                                                                                                      |
| `providers/`            | React context providers                             | `SpecContext`                                                                                                                                              |
| `shortcuts/`            | Keyboard shortcut key definitions                   | `keys.ts`                                                                                                                                                  |

### When NOT to put something in shared/

- A store that only one page uses (e.g. `undoStore`, `autoSaveStore` -- Editor only)
- A component with page-specific props or behavior
- A hook that depends on page-specific stores or actions
- "Might be shared someday" -- extract on evidence, not speculation

## pages/ -- Per-Page Code

Each page owns everything it needs: components, hooks, stores, nodes, utils, shortcuts. The page folder is self-contained.

```
pages/Editor/
  EditorV2.tsx          # Route entry point
  store/                # Editor-only stores (undo, actions, clipboard, autoSave, etc.)
  nodes/                # Editor node manifests + components (full editing)
  components/           # Editor UI (FlowCanvas, EditorMenuBar, ContextPanel, etc.)
  hooks/                # Editor-only hooks
  shortcuts/            # Editor-only shortcut utils
  utils/                # Editor-only utilities

pages/RunView/
  RunViewV2.tsx          # Route entry point
  nodes/                 # RunView node manifests (read-only, no editing)
  components/            # RunView UI
  hooks/                 # RunView-only hooks
```

## Nodes are Per-Page

Each page registers its own node manifests into the shared `NODE_TYPE_REGISTRY`. This is the key architectural decision that keeps the dependency graph clean.

**Shared** provides the infrastructure:

- `NodeTypeManifest` interface (the contract)
- `NodeTypeRegistry` class + singleton
- `buildUtils` (position helpers, edge builders)

**Each page** provides implementations:

- Its own `nodes/index.ts` that registers manifests
- Its own manifest files with page-appropriate behavior
- Side-effect import (`import "./nodes"`) in the page's FlowCanvas or entry point

### Why not share nodes?

Editor nodes pull in editing stores (`undoStore`, `actions`, `clipboardStore`), editing components (`ArgumentRow`, `ThunderMenu`), and editing actions (`drop`, `deleteNode`, `cloneHandler`). Sharing them would force RunView to depend on all of Editor's internals.

| Capability              | Editor manifest                   | RunView manifest                 |
| ----------------------- | --------------------------------- | -------------------------------- |
| `drop`                  | Full (add tasks, inputs, outputs) | None                             |
| `deleteNode`            | Deletes from spec                 | No-op                            |
| `cloneHandler`          | Full snapshot + clone             | None                             |
| `onDoubleClick`         | Navigate to subgraph              | Navigate to subgraph             |
| `contextPanelComponent` | `TaskDetails` (editable)          | `RunViewTaskDetails` (read-only) |
| `useCanvasEnhancement`  | Ghost node, conduit edge mode     | Static display                   |

## Colocation Rules

Follow the hierarchy from most specific to most general:

1. **Same file** -- helper used once, keep it inline
2. **Sibling file** -- used by 2+ files in the same folder, create a sibling
3. **Parent folder** -- used across child folders within the same feature
4. **shared/** -- used by 2+ pages, verified by dependency analysis

### Component Folder Rule

If a component has **related files** (utils, actions, sub-components), it **must** live in a folder named after the component. All related files reside inside that folder:

- **Utils / actions** -- sibling of the main component file inside the folder
- **Sub-components** -- placed in a nested `components/` directory
- **Standalone files** (single component, no related files) remain as loose files at the parent level

```
components/
  AnnotationsBlock/            # Has actions -> folder
    AnnotationsBlock.tsx
    annotations.actions.ts
  ArgumentRow/                 # Has utils, actions, and sub-components -> folder
    ArgumentRow.tsx
    argumentRow.utils.ts
    arguments.actions.ts
    components/
      ArgumentValueDisplay.tsx
      InputValidationIndicator.tsx
      ThunderMenu/             # Sub-component with its own utils and sub-components -> nested folder
        ThunderMenu.tsx
        thunderMenu.utils.ts
        components/
          QuickConnectSubmenu.tsx
          DynamicDataSubmenu.tsx
  HistoryContent/              # Has utils and sub-components -> folder
    HistoryContent.tsx
    historyContent.utils.ts
    components/
      HistoryEntryItem.tsx
      HistoryToolbar.tsx
      InitialStateMarker.tsx
  AutoGrowTextArea.tsx         # Standalone, no related files -> loose file
  ValidationSummary.tsx        # Standalone -> loose file
```

This rule applies recursively: if a sub-component itself has related files, it gets its own folder within `components/`.

### Red Flags

- A file in `shared/` imported by only one page -- move it to that page
- Deep relative imports (`../../../../`) -- use `@/routes/v2/` absolute imports
- A "shared" component with page-specific props -- it belongs with the page
- Side-effect imports (`import "./nodes"`) in shared hooks -- registration belongs at the page level
- A component with utils/actions/sub-components living as a loose file -- wrap it in a folder

## Import Conventions

- Use `@/routes/v2/shared/...` for imports from shared
- Use `@/routes/v2/pages/Editor/...` for absolute imports within Editor (cross-subfolder)
- Use relative `./` or `../` for imports within the same subfolder
- No barrel files (`index.ts` that re-export) except `nodes/index.ts` for manifest registration

## Adding New Code

### New shared store

Place in `shared/store/`. Must not import from any page.

### New page-specific store

Place in `pages/<Page>/store/`.

### New node type

1. Add manifest in `pages/Editor/nodes/<NodeType>/`
2. Add manifest in `pages/RunView/nodes/<NodeType>/` (read-only variant)
3. Register both in their respective `nodes/index.ts`
4. If the node needs new base types, add them to `shared/nodes/types.ts`

### New shared hook

Place in `shared/hooks/`. Must not import from any page or from `nodes/index.ts`. If it needs registered node types, accept them via the `NODE_TYPE_REGISTRY` singleton (which is populated at runtime by each page).

### New window type

The window system lives entirely in `shared/windows/`. Add new window components there. Window _content_ (what renders inside a window) belongs to the page that defines it.
