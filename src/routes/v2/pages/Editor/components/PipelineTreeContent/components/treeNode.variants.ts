import { cva } from "class-variance-authority";

export type TreeNodeLabelTone = "error" | "warning" | "none";

export const treeNodeRowVariants = cva(
  "group flex min-w-0 items-center gap-1 py-1.5 rounded-md cursor-pointer",
  {
    variants: {
      hasErrors: { true: "", false: "" },
      fullWidth: { true: "w-full", false: "" },
    },
    defaultVariants: {
      hasErrors: false,
      fullWidth: false,
    },
  },
);

export const treeNodeIconVariants = cva(
  "shrink-0 mt-0.5 rounded-sm transition-colors",
  {
    variants: {
      hasErrors: {
        true: "text-destructive group-hover:text-destructive/90",
        false: "text-slate-600 group-hover:text-slate-950",
      },
      selected: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        hasErrors: false,
        selected: true,
        className:
          "text-primary ring-2 ring-primary/35 ring-offset-1 ring-offset-background group-hover:text-primary",
      },
      {
        hasErrors: true,
        selected: true,
        className:
          "ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
      },
    ],
    defaultVariants: {
      hasErrors: false,
      selected: false,
    },
  },
);

/** Primary label on tree rows (root, subgraph, leaf).
 * Subgraph rows use `line: "ellipsis"` (single-line). Root/leaf use `wrap` (default). Parent stacks use `align="stretch"` so labels get a bounded width. */
export const treeNodeLabelToneVariants = cva("transition-colors truncate", {
  variants: {
    tone: {
      error: "text-destructive group-hover:text-destructive/90",
      warning:
        "text-amber-800 group-hover:text-amber-950 dark:text-amber-200 dark:group-hover:text-amber-100",
      none: "text-slate-700 group-hover:text-slate-950",
    },
    line: {
      wrap: "min-w-0 flex-1 wrap-break-word",
      ellipsis: "min-w-0 flex-1 truncate",
    },
  },
  defaultVariants: {
    tone: "none",
    line: "wrap",
  },
});

/** Leaf task status icon (Circle / CircleAlert) — includes bg-white ring. */
export const treeNodeLeafIconToneVariants = cva(
  "shrink-0 mt-0.5 rounded-full transition-colors bg-white",
  {
    variants: {
      tone: {
        error: "text-destructive group-hover:text-destructive/90",
        warning: "text-amber-500 group-hover:text-amber-600",
        none: "text-slate-600 group-hover:text-slate-950",
      },
      selected: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        tone: "none",
        selected: true,
        className:
          "text-primary ring-2 ring-primary/35 ring-offset-1 ring-offset-white group-hover:text-primary",
      },
      {
        tone: "warning",
        selected: true,
        className: "ring-2 ring-primary/40 ring-offset-1 ring-offset-white",
      },
      {
        tone: "error",
        selected: true,
        className: "ring-2 ring-primary/40 ring-offset-1 ring-offset-white",
      },
    ],
    defaultVariants: {
      tone: "none",
      selected: false,
    },
  },
);

/** Expand/chevron icon inside ghost button (size sm, no mt offset). */
export const treeNodeChevronIconVariants = cva("", {
  variants: {
    hasErrors: {
      true: "text-destructive",
      false: "text-slate-600 group-hover:text-slate-950",
    },
  },
  defaultVariants: {
    hasErrors: false,
  },
});
