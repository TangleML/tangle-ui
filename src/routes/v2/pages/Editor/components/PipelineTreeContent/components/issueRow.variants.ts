import { cva } from "class-variance-authority";

export type IssueRowSeverity = "error" | "warning";

export const issueRowVariants = cva(
  "flex items-baseline gap-1 py-0.5 px-2 rounded text-xs cursor-pointer transition-colors",
  {
    variants: {
      selected: { true: "", false: "" },
      severity: { error: "", warning: "" },
    },
    compoundVariants: [
      {
        selected: false,
        severity: "error",
        className: "bg-red-50 text-red-800 hover:bg-red-100",
      },
      {
        selected: false,
        severity: "warning",
        className: "bg-amber-50 text-amber-800 hover:bg-amber-100",
      },
      {
        selected: true,
        severity: "error",
        className:
          "ring-1 ring-blue-400 bg-red-50 text-red-800 hover:bg-red-100",
      },
      {
        selected: true,
        severity: "warning",
        className:
          "ring-1 ring-blue-400 bg-amber-50 text-amber-800 hover:bg-amber-100",
      },
    ],
    defaultVariants: {
      selected: false,
      severity: "warning",
    },
  },
);

export const issueRowTypeLabelVariants = cva(
  "shrink-0 uppercase tracking-wide",
  {
    variants: {
      severity: {
        error: "text-red-600",
        warning: "text-amber-600",
      },
    },
    defaultVariants: {
      severity: "warning",
    },
  },
);

export const issueRowMessageVariants = cva("", {
  variants: {
    severity: {
      error: "text-red-700",
      warning: "text-amber-700",
    },
  },
  defaultVariants: {
    severity: "warning",
  },
});
