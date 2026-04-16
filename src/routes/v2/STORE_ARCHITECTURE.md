# Store Architecture: DI, Contexts, and Action Hooks

## Overview

UI state in the v2 routes is managed by six plain MobX stores organized into two
tiers, each provided through React context with constructor-based dependency
injection.

```
SharedUIStore (v2 route level)          EditorSessionStore (Editor page level)
├── EditorStore                         ├── UndoStore
├── KeyboardStore                       ├── AutoSaveStore  ← DI: UndoStore
└── NavigationStore  ← DI: EditorStore  └── ClipboardStore ← DI: UndoStore
```

Components access stores via hooks (`useSharedStores`, `useEditorSession`),
never through module-level singletons.

---

## Two-Tier Store Hierarchy

### SharedUIStore

Provided by `SharedStoreProvider`, mounted at the route shell of **both**
Editor and RunView.

| Store             | Responsibility                                 |
| ----------------- | ---------------------------------------------- |
| `EditorStore`     | Selection, hover, focus, multi-selection state |
| `KeyboardStore`   | Pressed keys, shortcut registry                |
| `NavigationStore` | Subgraph navigation, breadcrumbs, root spec    |

`NavigationStore` receives `EditorStore` via constructor so it can clear
selection during navigation without importing a sibling module.

```typescript
const { editor, keyboard, navigation } = useSharedStores();
```

### EditorSessionStore

Provided by `EditorSessionProvider`, mounted inside the Editor route only.
RunView does not mount this provider.

| Store            | Responsibility                             |
| ---------------- | ------------------------------------------ |
| `UndoStore`      | Undo/redo middleware wrapper, `withGroup`  |
| `AutoSaveStore`  | Debounced save, undo history persistence   |
| `ClipboardStore` | Copy/paste/duplicate with system clipboard |

Both `AutoSaveStore` and `ClipboardStore` receive `UndoStore` via constructor.

```typescript
const { undo, autoSave, clipboard } = useEditorSession();
```

### Provider Mounting

```
EditorV2()
└── SharedStoreProvider          ← creates SharedUIStore once
    └── EditorSessionProvider    ← creates EditorSessionStore once
        └── EditorV2Content      ← hooks are available here and below

RunViewV2()
└── SharedStoreProvider          ← creates its own SharedUIStore
    └── RunViewContent           ← only useSharedStores() available
```

Store instances are created inside `useState(() => new XxxStore())`, so they
are stable for the entire provider lifetime and never recreated on re-render.

---

## Dependency Injection

Cross-store dependencies are resolved at construction time, not at import time.

```typescript
// SharedStoreContext.tsx
class SharedUIStore {
  constructor() {
    this.editor = new EditorStore();
    this.keyboard = new KeyboardStore();
    this.navigation = new NavigationStore(this.editor); // DI
  }
}

// EditorSessionContext.tsx
class EditorSessionStore {
  constructor() {
    this.undo = new UndoStore();
    this.autoSave = new AutoSaveStore(this.undo); // DI
    this.clipboard = new ClipboardStore(this.undo); // DI
  }
}
```

This means:

- Store files have **zero imports** from sibling store files.
- The wiring graph is explicit and visible in two places.
- Tests can construct a store with a mock dependency.

---

## Hybrid Action Pattern

Mutations are organized into domain-specific **action files**
(`task.actions.ts`, `io.actions.ts`, `focus.actions.ts`, etc.). Each action
function is a **pure function** that receives its store dependency as the first
argument, followed by domain arguments.

A companion **hook file** reads the store from context and returns bound
functions so that components never see the store parameter.

The pattern applies to both undo-backed spec mutations (Editor-only) and
shared UI-state compositions (available in Editor and RunView).

### Layer 1 -- Pure Action Functions

```typescript
// task.actions.ts
export function addTask(
  undo: UndoGroupable,
  spec: ComponentSpec,
  componentRef: ComponentReference,
  position: XYPosition,
): Task {
  return undo.withGroup("Add task", () => {
    // ... spec mutations
  });
}
```

- First param is always the store dependency (`undo`, `clipboard`, etc.).
- Remaining params are domain values (`spec`, position, names, ...).
- No React hooks, no context access -- framework-agnostic.
- Directly callable from unit tests with a mock store.

### Layer 2 -- Companion Hook (currying bridge)

```typescript
// useTaskActions.ts  (sibling file)
export function useTaskActions() {
  const { undo, clipboard } = useEditorSession();

  return {
    addTask: addTask.bind(null, undo),
    deleteTask: deleteTask.bind(null, undo),
    // clipboard-backed actions
    copySelectedNodes: copySelectedNodes.bind(null, clipboard),
    pasteNodes: pasteNodes.bind(null, clipboard),
    // ...
  };
}
```

- Reads stores from context once.
- Returns an object of pre-bound functions.
- Store references from context are stable (created in `useState`), so the
  React Compiler can memoize the returned object automatically.

### Shared-Store Actions

Not all actions need `UndoGroupable`. Multi-step UI-state operations that
compose calls across `EditorStore` and `NavigationStore` follow the same
two-layer pattern, taking the stores as first parameters instead of undo:

```typescript
// shared/store/focus.actions.ts
export function navigateToEntity(
  editor: EditorStore,
  navigation: NavigationStore,
  path: string[],
  entityId: string,
  entityType: NodeEntityType,
): void {
  navigation.navigateToPath(path);
  editor.setPendingFocusNode(entityId);
  editor.selectNode(entityId, entityType);
}

// shared/store/useFocusActions.ts
export function useFocusActions() {
  const { editor, navigation } = useSharedStores();
  return {
    navigateToEntity: navigateToEntity.bind(null, editor, navigation),
    focusValidationIssue: focusValidationIssue.bind(null, editor),
  };
}
```

Since these only depend on `SharedUIStore`, they are available in both
Editor and RunView.

### Component Usage

```typescript
const { addTask, deleteTask } = useTaskActions();

// call-site is identical to the old singleton API
addTask(spec, componentRef, position);
```

Components import the hook, not the raw action file. The store dependency
is invisible at the call-site.

### Hook-Level Side Effects

When a domain action needs accompanying UI cleanup (e.g. clearing selection
after deletion), the hook wrapper handles it instead of adding the side
effect to the pure action function. This keeps the action testable while
ensuring the cleanup always happens:

```typescript
// useTaskActions.ts
deleteSelectedNodes: (spec, selectedNodes) => {
  deleteSelectedNodes(undo, spec, selectedNodes);
  editor.clearSelection();        // UI cleanup
  editor.clearMultiSelection();
},
```

The same approach is used in `useValidationResolutionActions`, where every
resolution action automatically clears `editor.selectedValidationIssue`
after performing its spec mutation.

### File Layout

Each action domain has two sibling files:

```
store/actions/                       # Editor-only (undo-backed)
  task.actions.ts                    # pure functions (testable)
  useTaskActions.ts                  # hook bridge (React-aware)
  connection.actions.ts
  io.actions.ts
  useIOActions.ts
  pipeline.actions.ts
  usePipelineActions.ts

shared/store/                        # Shared (Editor + RunView)
  focus.actions.ts                   # pure functions (EditorStore + NavigationStore)
  useFocusActions.ts                 # hook bridge (useSharedStores)
```

Colocated actions follow the same pattern within their component folder:

```
components/ArgumentRow/
  arguments.actions.ts
  useArgumentActions.ts
  ArgumentRow.tsx

components/PipelineTreeContent/components/
  validationResolution.actions.ts
  useValidationResolutionActions.ts  # wraps with editor.setSelectedValidationIssue(null)
```

### The `UndoGroupable` Interface

Action functions type their undo dependency as `UndoGroupable`, a minimal
interface defined in `shared/nodes/types.ts`:

```typescript
export interface UndoGroupable {
  withGroup<T>(label: string, fn: () => T): T;
}
```

`UndoStore` satisfies this interface. Using the minimal type means:

- `shared/` code never imports from `pages/` (architecture rule).
- Action functions declare only the capability they need.
- Any object with a `withGroup` method can be substituted in tests.

---

## Pros

**Testability.** Stores can be constructed with mock dependencies. Action
functions can be tested by passing a fake `UndoGroupable` -- no React context
or provider setup required.

**Explicit dependency graph.** All cross-store wiring is visible in the two
root store constructors. There are no hidden import-time couplings.

**Lifecycle management.** Store instances are scoped to the provider tree.
When the Editor unmounts, its `EditorSessionStore` (and the undo manager,
auto-save reactions, clipboard state) is garbage-collected. A fresh instance is
created on the next mount.

**Architecture compliance.** The `shared/ -> pages/` import ban is enforced
cleanly. Shared code depends on `UndoGroupable` (a shared interface), never on
the concrete `UndoStore` class from `pages/Editor/`.

**No API change for components.** The hybrid hook pattern means component
call-sites are unchanged. Only imports and a destructuring line differ from the
old singleton approach.

**React Compiler friendly.** Store references from context are stable objects
(created once in `useState`). `.bind(null, stableRef)` produces values the
compiler can memoize without manual `useMemo`.

## Cons and Trade-offs

**More files.** Every action domain now has two files (pure + hook) instead of
one. The total file count increased by ~10 hook files.

**Indirection.** A developer reading a component must follow two hops to
understand the full call path: hook -> pure function -> store method. The old
singleton import was a single hop.

**Providers must wrap all consumers.** Any component that calls `useSharedStores()`
or `useEditorSession()` must be a descendant of the corresponding provider. If a
component is rendered outside the provider tree (e.g. in a global layout), it
will throw at runtime. This was encountered with `EditorMenuBar` which was
previously rendered from the global `AppMenu` and had to be moved inside the
Editor route.

**`.bind()` creates new function objects.** Each `useXxxActions()` call creates
new bound functions. The React Compiler memoizes these when inputs are stable,
but if a store reference ever changed, all bound functions would be recreated.
In practice this doesn't happen because stores are created in `useState`.

**Manifest interface widened.** The `NodeTypeManifest` shared interface had to
accept `UndoGroupable` as a parameter on methods like `updatePosition`,
`deleteNode`, and `drop.handler`. This adds a parameter to the contract that
RunView manifests must also accept (as a no-op).

---

## When to Use Each Pattern

| Scenario                                | Approach                                                      |
| --------------------------------------- | ------------------------------------------------------------- |
| Component reads observable state        | `useSharedStores()` or `useEditorSession()` directly          |
| Component calls a spec mutation         | `useXxxActions()` hook (e.g. `useTaskActions`)                |
| Component navigates + focuses an entity | `useFocusActions()` hook                                      |
| Hook calls a domain action              | `useXxxActions()` hook or pass undo via context               |
| Component inlines a one-off undo group  | `const { undo } = useEditorSession()` + `undo.withGroup(...)` |
| 1:1 UI setter (select, hover, clear)    | Direct store access is acceptable (see below)                 |
| Non-React code (manifest callback)      | Receives store as parameter from calling hook                 |
| Unit test                               | Construct store directly, pass to pure action function        |

### When Direct Store Access Is Acceptable

Not every store method call requires an action helper. The action pattern was
designed for **undoable spec mutations** and **multi-step compositions**.
The following are acceptable as direct store calls:

- **1:1 setters** -- `editor.selectNode()` in a node's click handler,
  `editor.setHoveredEntity()` in `onMouseEnter`/`onMouseLeave`.
- **Selection infrastructure** -- `editor.clearSelection()`,
  `editor.setMultiSelection()` in hooks that coordinate with React Flow.
- **Lifecycle init/dispose** -- `navigation.initNavigation()`,
  `editor.resetState()`, `undo.init()` in lifecycle hooks.
- **Keyboard shortcuts** -- `keyboard.registerShortcut()`, `undo.undo()`,
  `undo.redo()` in keyboard hooks.
- **Single-use operations** -- `autoSave.save()` from a "Save" menu item.

The rule of thumb: **extract an action when the same multi-step sequence
appears in 2+ places**, or when the operation involves both a spec mutation
and UI cleanup.

---

## Adding a New Store

1. Create the class in the appropriate location:
   - Shared across pages -> `shared/store/`
   - Editor-only -> `pages/Editor/store/`
2. Add it to the corresponding root store class (`SharedUIStore` or
   `EditorSessionStore`), passing any dependencies via constructor.
3. The context hook (`useSharedStores` / `useEditorSession`) automatically
   exposes it -- no additional wiring needed.

## Adding a New Action Domain

1. Create `<domain>.actions.ts` with pure functions (store as first param).
2. Create `use<Domain>Actions.ts` sibling that reads context and returns
   bound functions.
3. Components import the hook, never the raw action file.
4. If the action needs UI cleanup after the core operation (clearing
   selection, resetting state), add that in the hook wrapper, not in the
   pure action function.
5. For shared-store actions (no undo dependency), place both files in
   `shared/store/`. For Editor-only actions, place them in
   `pages/Editor/store/actions/` or colocated with the component.
