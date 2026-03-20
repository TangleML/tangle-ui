# CVA Compound Variants for Priority-Based Styling

When a component has multiple boolean props that control styling with a priority cascade (e.g. `selected > hovered > subgraph > default`), use `cva` with **boolean variants + `compoundVariants`** instead of nested ternaries.

## Pattern

```typescript
import { cva } from "class-variance-authority";

const myVariants = cva("base classes shared by all states", {
  variants: {
    selected: { true: "", false: "" },
    hovered: { true: "", false: "" },
    subgraph: { true: "", false: "" },
  },
  compoundVariants: [
    // Lowest priority — all flags off
    {
      selected: false,
      hovered: false,
      subgraph: false,
      className: "default-classes",
    },
    // Next priority — only subgraph
    {
      selected: false,
      hovered: false,
      subgraph: true,
      className: "subgraph-classes",
    },
    // Higher priority — hovered (any subgraph value)
    {
      selected: false,
      hovered: true,
      className: "hovered-classes",
    },
    // Highest priority — selected (any hovered/subgraph value)
    {
      selected: true,
      className: "selected-classes",
    },
  ],
  defaultVariants: {
    selected: false,
    hovered: false,
    subgraph: false,
  },
});
```

### Usage

Props pass directly to variant keys — no ternaries:

```tsx
<Card
  className={myVariants({ selected, hovered: isHovered, subgraph: isSubgraph })}
/>
```

## How priority works

Each compound variant specifies the **minimum constraints** required to match. Higher-priority compounds omit lower-priority keys, making them match regardless of those values.

| Compound | Constraints                                        | Matches when          |
| -------- | -------------------------------------------------- | --------------------- |
| default  | `selected: false, hovered: false, subgraph: false` | nothing active        |
| subgraph | `selected: false, hovered: false, subgraph: true`  | only subgraph         |
| hovered  | `selected: false, hovered: true`                   | hovered, not selected |
| selected | `selected: true`                                   | always when selected  |

Exactly one compound fires per state combination, so no `cn()` / `twMerge` wrapper is needed to resolve conflicts.

## Real example

See `TaskNodeCollapsed.tsx`:

```typescript
const collapsedCardVariants = cva(
  "flex flex-col justify-center rounded-xl border-2 p-0 drop-shadow-sm cursor-pointer transition-[border-color,box-shadow]",
  {
    variants: {
      selected: { true: "", false: "" },
      hovered: { true: "", false: "" },
      subgraph: { true: "", false: "" },
    },
    compoundVariants: [
      {
        selected: false,
        hovered: false,
        subgraph: false,
        className: "border-gray-200 hover:border-gray-300",
      },
      {
        selected: false,
        hovered: false,
        subgraph: true,
        className: "border-purple-300 hover:border-purple-400",
      },
      {
        selected: false,
        hovered: true,
        className: "ring-2 ring-amber-300 border-amber-400",
      },
      {
        selected: true,
        className: "border-blue-500 ring-2 ring-blue-200",
      },
    ],
    defaultVariants: {
      selected: false,
      hovered: false,
      subgraph: false,
    },
  },
);
```

## When to use this

- Multiple boolean props control **mutually exclusive** visual states
- There is a clear priority order among the props
- The nested ternary alternative is 3+ levels deep

Prefer simple `cva` variants (without compounds) when states come from a single prop or enum.
