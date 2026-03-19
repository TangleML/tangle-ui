---
name: ui-primitives
description: UI primitive components for this project (BlockStack, InlineStack, Text, Heading, Paragraph, Button, Icon). Use when writing JSX, creating components, or working with layout and typography.
---

# UI Primitives

Always prefer UI primitives over raw HTML elements.

## Layout

Use `BlockStack` and `InlineStack` from `@/components/ui/layout` instead of `<div className="flex ...">`:

- `BlockStack` = vertical flex (`flex-col`)
- `InlineStack` = horizontal flex (`flex-row`)
- Both support `gap`, `align`, `blockAlign` props
- Use `as` prop for semantic elements: `<BlockStack as="ul">`, `<InlineStack as="li">`

## Typography

All typography components are exported from `@/components/ui/typography`.

**Use `Heading` for headings** instead of raw `<h1-h6>` or `Text as="h*"`:

- `<Heading level={2}>Title</Heading>` — renders `<h2>` with `role="heading"` and `aria-level`
- Automatically sets `size="md"` + `weight="semibold"` for level 1, `size="sm"` for others
- Supports `tone`, `size`, `weight`, `font` overrides

**Use `Paragraph` for paragraph text** instead of raw `<p>` or `Text as="p"`:

- `<Paragraph size="sm" tone="subdued">` instead of `<p className="text-sm text-muted">`

**Use `Text` for inline text** (`<span>`, `<dt>`, `<dd>`, etc.):

- `<Text as="dt" weight="semibold">` instead of `<dt className="font-semibold">`
- Supports: `as`, `size`, `weight`, `tone`, `font` props

## Buttons

Use `Button` from `@/components/ui/button`

## Icons

Use `Icon` from `@/components/ui/icon`

## Styling

- Use shadcn/ui components from `@/components/ui/` for all UI primitives
- Use TailwindCSS v4 for styling (not CSS modules or styled-components)
- **Only use inline styling** (`style={...}`) for dynamic/variable CSS values (e.g., `style={{height: h}}`). Never use inline styles for static values — use Tailwind classes instead
- Use `cn()` utility for conditional classes (from `@/lib/utils`)
- Prefer composition over prop drilling for complex components

## Suggest Abstractions for Repeated Patterns

When you see similar Tailwind class combinations used multiple times, suggest creating reusable components or utility classes:

- Multiple buttons with similar styling -> Create a Button variant or new component
- Repeated container/card patterns -> Abstract into reusable Card component
- Common spacing/layout patterns -> Suggest utility classes or component abstractions
- Similar form field styling -> Create form field components

## When Raw HTML is Acceptable

- Semantic elements not supported by primitives (e.g., `<dl>`, `<ul>`, `<ol>`, `<table>`)
- Complex layouts where primitives don't fit
- Performance-critical sections where abstraction overhead matters
