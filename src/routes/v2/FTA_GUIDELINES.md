# FTA Guidelines — Keeping Files in the "OK" Category

FTA (File Type Analysis) scores measure file complexity. Lower is better.

| Assessment        | Score Range |
| ----------------- | ----------- |
| OK                | < 50        |
| Could be better   | 50–60       |
| Needs improvement | >= 60       |

Run `npm run fta -- src/routes/v2` to check all files, or `npm run fta -- <filepath> --json` for detailed per-file metrics.

## What Drives the Score

FTA combines three metrics:

- **Cyclomatic complexity (cyclo)** — number of independent code paths (if/else, switch cases, ternary chains, loops, logical operators). Target: **< 20 per file**.
- **Halstead difficulty** — ratio of unique operators/operands to total usage. Many distinct identifiers, imports, and operations inflate this. Target: **< 40**.
- **Line count** — raw file size. Target: **< 150 lines** for components, **< 200 lines** for stores/utils.

## Rules

### 1. One component per file

Do not define multiple exported components in a single file. Helper components used only by the parent are acceptable if they are under ~30 lines; otherwise extract them.

### 2. Cap switch statements at 5–6 cases

Large switch/case blocks (e.g., issue code routing) should dispatch to components or functions imported from separate files. The switch file becomes a thin router.

### 3. Extract utility functions out of component files

Pure functions (type guards, formatters, data transformers, grouping logic) belong in a `<feature>.utils.ts` sibling file, not inline in the component.

### 4. Extract deeply nested JSX into sub-components

If a JSX block is > 30 lines and has its own conditional logic or event handlers, it should be its own component file. Common candidates:
- Accordion/tab sections
- Submenu content (dropdowns, popovers)
- List item renderers
- Display variants (editing vs. read-only views)

### 5. Keep action files domain-scoped

Follow the `<domain>.actions.ts` naming convention. When a single actions file grows beyond ~15 exported functions, split by domain (task, io, connection, pipeline). Use a re-export barrel to preserve existing import paths.

### 6. Stores should delegate, not accumulate

When a MobX store class exceeds ~20 methods, extract related method groups into standalone function modules (e.g., `store.docking.ts`, `store.attachments.ts`). The class methods become thin `@action` wrappers that delegate to the extracted functions.

### 7. Limit conditional rendering depth

Avoid ternary chains longer than 2 levels in JSX. Instead, extract the branching into a dedicated display component that accepts props describing the state, or use early returns.

```tsx
// Avoid
{editing ? <Editor /> : isDynamic ? <DynamicView /> : displayValue ? <ValueText /> : null}

// Prefer
<ValueDisplay editing={editing} isDynamic={isDynamic} displayValue={displayValue} />
```

### 8. Limit imports

A high number of unique imports inflates Halstead vocabulary. If a file imports from > 10 different modules, it likely does too much. Split responsibilities so each file has a focused import set.

### 9. Naming conventions for extracted files

| Type                   | Pattern                        | Example                        |
| ---------------------- | ------------------------------ | ------------------------------ |
| Utility functions      | `<feature>.utils.ts`           | `argumentRow.utils.ts`         |
| Domain actions         | `<domain>.actions.ts`          | `task.actions.ts`              |
| Store logic modules    | `<store>.<domain>.ts`          | `windowStore.docking.ts`       |
| Sub-components         | `PascalCase.tsx`               | `OutputsSection.tsx`           |
| Sub-component folders  | `<feature>/components/`        | `resolutions/`                 |

## Quick Checklist Before Committing a New File

- [ ] File is under 150 lines (components) or 200 lines (logic)
- [ ] No more than one exported component per file
- [ ] No switch with > 6 cases
- [ ] No ternary chains deeper than 2 levels in JSX
- [ ] Pure functions are in a `.utils.ts` sibling, not inline
- [ ] Imports come from < 10 distinct modules
- [ ] Run `npm run fta -- <filepath> --json` and confirm score < 50
