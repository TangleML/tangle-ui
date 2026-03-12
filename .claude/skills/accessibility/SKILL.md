---
name: accessibility
description: Accessibility patterns and requirements for this project. Use when creating interactive components, forms, dialogs, or any user-facing UI.
---

# Accessibility Patterns

This project builds on **shadcn/ui** primitives which provide strong built-in a11y. Follow these patterns to maintain that standard.

## ARIA Labels

All interactive elements without visible text must have an `aria-label`:

```typescript
// Icon buttons
<Button variant="ghost" aria-label="Home">
  <Icon name="Home" />
</Button>

// Folder toggles
<div role="button" aria-expanded={isOpen} aria-label={`Folder: ${folder.name}`}>
```

## Form Accessibility

Link inputs to labels and error messages:

```typescript
<Input
  id={id}
  aria-invalid={!!error}
  aria-describedby={`${id}-hint`}
/>
{!!error && <Text tone="critical">{error.join("\n")}</Text>}
<div id={`${id}-hint`}>{hint}</div>
```

Use the shadcn/ui `Label` component for proper form associations.

## Keyboard Navigation

### Required keyboard support for custom interactive elements:

- **Enter/Space**: Activate buttons and toggles
- **Escape**: Close dialogs, cancel editing, deselect
- **Tab**: Move focus between interactive elements

```typescript
// The Input component has built-in onEnter and onEscape props
<Input onEnter={save} onEscape={cancel} />

// For non-Input elements, handle manually
onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    save();
  } else if (e.key === "Escape") {
    e.preventDefault();
    cancel();
  }
}
```

### Non-button clickable elements need `role="button"` and `tabIndex={0}`:

```typescript
<div role="button" tabIndex={0} title="Click to edit">
  {content}
</div>
```

### Dialogs must prevent keyboard shortcuts from leaking to the canvas:

The dialog component already handles this — use `preventKeyboardPropagation` prop when needed. This stops Ctrl+A, Ctrl+C, Ctrl+V, Tab, Enter, and Escape from reaching React Flow.

## Screen Reader Support

Use `sr-only` class for visually hidden but screen-reader-accessible text:

```typescript
// Close buttons with only an icon
<DialogClose>
  <Cross2Icon />
  <span className="sr-only">Close</span>
</DialogClose>

// Command palette title
<DialogHeader className="sr-only">
  <DialogTitle>{title}</DialogTitle>
  <DialogDescription>{description}</DialogDescription>
</DialogHeader>
```

## Semantic HTML

Use proper semantic elements and ARIA roles:

```typescript
// Navigation
<nav aria-label="breadcrumb">

// Current page in breadcrumb
<span role="link" aria-disabled="true" aria-current="page">{children}</span>

// Decorative separators
<li role="presentation" aria-hidden="true">

// Alerts
<div role="alert">
```

## Focus Styling

All focusable elements must use the project's focus-visible ring pattern:

```
focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring
```

Do not remove `outline-none` without replacing it with a visible focus indicator.

## UI Primitives A11y

The project's primitives already accept `AriaAttributes`:

- `BlockStack` and `InlineStack` accept all ARIA props
- `Text` accepts `role` and ARIA props
- `Button` has built-in focus-visible and disabled states
- `Input` supports `aria-invalid`, `onEnter`, `onEscape`
- All shadcn/ui components (Dialog, Select, Checkbox, Switch, Tabs) handle focus trapping and keyboard navigation automatically

## React Flow Considerations

The pipeline editor has specific a11y needs:

- **Handles**: Support click selection and Escape to deselect
- **Task nodes**: Labels are interactive with visual feedback
- **Folders in sidebar**: Use `role="button"` with `aria-expanded`
- **Canvas keyboard shortcuts**: Must not interfere with dialog/modal focus

When adding new interactive elements to the flow canvas, ensure they:

1. Are keyboard accessible
2. Have appropriate ARIA labels
3. Don't capture keyboard events that should reach parent containers
