---
name: ui-primitives
description: UI primitive components for this project (Box, Surface/Card/Section, BlockStack, InlineStack, Text/Heading/Paragraph, Button/IconButton, Icon, Pill, ListRow, ScrollRegion, Truncating, HoverReveal, ...). Use when writing JSX, creating components, or working with layout and typography.
---

# UI Primitives

Tangle UI is organized in four layers. Pick the highest layer that fits — reaching for a lower one is a smell.

```
Layer 4: domain compositions   TaskNodeCard, IONodeCard, PipelineDigestBar, ...
                                       ▲
Layer 3: semantic primitives   Surface · Section · Card · ScrollRegion · Truncating
                               · ListRow · ZebraList · Toolbar · HoverReveal
                               · EmptyState · StickyHeader · IconButton · Pill · FieldRow · Divider
                                       ▲
Layer 2: tiny base primitives  BlockStack · InlineStack · Text · Heading · Paragraph
                               · Button · Icon · Input · Label
                                       ▲
Layer 1: low-level escape hatch  Box
```

**`className` is forbidden on every primitive in layers 1-3.** The
`tangle-ui/no-classname-on-primitives` ESLint rule warns today and will be
promoted to `error` once the migration is complete.

## Layer 1 — Box

`<Box>` (from `@/components/ui/box`) is the **only** escape hatch for "I need a
styled container". Every prop is a token-bound enum (no Tailwind strings):

```tsx
<Box
  background="subdued"
  padding="base"
  borderRadius="base"
  border="sm"
  shadow="xs"
  inlineSize="full"
  overflow="hidden"
>
  {children}
</Box>
```

Box has **no flex helpers** — use BlockStack/InlineStack inside it for layout.
Importing Box anywhere under `src/routes/v2/**` triggers an ESLint soft-warning;
prefer a Layer-3 primitive whenever one fits. Layer-3 primitive _implementations_
may use Box freely.

## Layer 2 — Base primitives

### Layout

- `BlockStack` (vertical) and `InlineStack` (horizontal) from `@/components/ui/layout`.
- Props: `as`, `gap` (`'0' | '0.5' | '1' | '1.5' | '2' | '3' | '4' | '5' | '6' | '8'`),
  `align`, `blockAlign` / `inlineAlign`, `wrap`, `fill`.
- **No** width/height/min/max/padding/border/overflow/position/flex/shrink/grow/group props.
  Each of those intents is owned by a Layer-3 primitive.

### Typography

All from `@/components/ui/typography`:

- `Heading` — semantic heading (`<h1>`-`<h6>`) with `level`, `size`, `weight`, `tone`, `truncate`, `align`, `wrap`.
- `Paragraph` — `<p>` with the same semantic prop set as `Text`.
- `Text` — inline `<span>` / `<dt>` / `<dd>` etc. Props: `as`, `size`, `weight`, `tone`,
  `font`, `align`, `wrap`, `italic`, `leading`, `transform`, `decoration`, `truncate`.

`tone` accepts: `inherit | subdued | strong | weak | critical | warning | success | info | inverted | accent | magic`.
Raw `text-gray-*` / `text-slate-*` / `text-*-500` colour classes are forbidden.

For multi-line truncation use `truncate={2}` (line-clamp 2).

### Button / Icon

- `Button` adds semantic props: `tone`, `fullWidth`, `align`, `truncate`, plus
  `variant="menubar" | "menubar-light" | "toolbar"` for chrome buttons.
- `Icon` defaults `shrink-0` and exposes `tone`, `rotate`, `spin`, `pulse`.

## Layer 3 — Semantic primitives

All in `@/components/ui/patterns/*`. Each replaces a specific className cluster.

### Surface · Card · Section — nested elevation

`<Surface>` is **finite and nesting-aware**. There are exactly three levels
(Container → Inset → Nested-inset), auto-detected from `SurfaceLevelContext`:

```tsx
<Surface>
  {" "}
  {/* level 1: card on the app background */}
  <BlockStack gap="3">
    <Heading level={3}>Inputs</Heading>
    <Surface>
      {" "}
      {/* level 2: inset section */}
      <Surface>
        {" "}
        {/* level 3: nested-inset strip */}
        ...key/value...
      </Surface>
    </Surface>
  </BlockStack>
</Surface>
```

- Padding & border radius are derived from `level` — never user-set.
- Hard cap at level 3 (throws in dev mode).
- `tone` enum (`default | critical | warning | info | success | magic`) tints
  the background per level.
- `hoverable` boolean + `onClick` for clickable surfaces.
- `level={1|2|3}` is allowed as an explicit override for portal'd content
  (popovers, dialogs).
- `Card` is `<Surface level={1}>` with header/content/footer slots and a
  `density` prop (`'compact' | 'cozy' | 'comfortable'`).
- `Section` is `<Surface>` with a built-in title + actions + optional `divider`
  (Polaris rule: dividers only for data-like content).

### Other intents

| Primitive                                    | Replaces                                                    | Notes                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `<ScrollRegion axis="y">`                    | `flex-1 min-h-0 overflow-y-auto`                            | Use inside flex columns.                                                                      |
| `<Truncating>`                               | `min-w-0 flex-1` wrappers around shrinkable cells           | Apply `truncate` on the inner `<Text>`.                                                       |
| `<ListRow hoverable onClick>`                | `<InlineStack className="group hover:bg-* px-* py-*">` rows | Establishes a `group` so `HoverReveal` works. Supports `density`, `gap`, `selected`, `zebra`. |
| `<HoverReveal>`                              | `opacity-0 group-hover:opacity-100 transition-opacity`      | Place inside a `ListRow` or any `group` parent.                                               |
| `<Toolbar density chrome sticky align>`      | dense horizontal action bars                                | Encapsulates `InlineStack gap-1 shrink-0 + chrome`.                                           |
| `<ZebraList>`                                | `even:bg-* odd:bg-*`                                        | Auto-passes `zebra` to row children.                                                          |
| `<EmptyState icon title description action>` | centered empty placeholder                                  |                                                                                               |
| `<StickyHeader>`                             | `sticky top-0 z-* bg-*` inside ScrollRegion                 |                                                                                               |
| `<Divider inset orientation>`                | toolbar separators                                          |                                                                                               |
| `<IconButton icon size variant tone>`        | `<Button h-5 w-5 p-0>` + `<Icon>` combos                    | Sizes: `xs` (h-5), `sm` (h-6), `md` (h-7), `lg` (h-9).                                        |
| `<Pill tone size>`                           | small `text-xs rounded-md px-2 py-1 bg-black/5` chips       | TaskNode handle labels, etc.                                                                  |
| `<FieldRow label help error required>`       | label + control + help/error                                | Auto-wires `htmlFor`.                                                                         |

## When raw HTML or `className` is acceptable

- Raw HTML elements (`<div>`, `<dl>`, `<table>`, etc.) — not a primitive.
- The internal implementation of new primitives (e.g. `cva` inside `Surface`).
- Performance-critical leaf nodes (xyflow `<Handle>` styling) where shadcn primitives aren't a fit.
- Layer-4 domain components are permitted to use `style={{...}}` for _dynamic_
  CSS values (e.g. per-node palette colours) — never for static styling.

Everywhere else, the `tangle-ui/no-classname-on-primitives` ESLint rule will
reject it.

## Codemod

A pure-Node codemod is available for mechanical conversions:

```bash
node scripts/codemods/ban-classname-on-primitives.mjs --dry     # preview
node scripts/codemods/ban-classname-on-primitives.mjs           # apply
```

It rewrites:

- `<Icon className="shrink-0">` → drop (default)
- `<Icon className="text-muted-foreground">` → `tone="subdued"` (and the rest of the colour map)
- `<Text className="truncate">` → `truncate`
- `<Text className="text-center">` → `align="center"`
- `<Text className="italic">` → `italic`
- `<Text className="font-mono">` → `font="mono"`

Complex cluster signatures (`<div className="flex-1 min-h-0 overflow-y-auto">`,
`<InlineStack className="group hover:bg-...">`, etc.) require hand migration to
the matching layer-3 primitive.
