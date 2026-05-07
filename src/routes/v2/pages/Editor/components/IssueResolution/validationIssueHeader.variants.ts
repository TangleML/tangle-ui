import { cva } from "class-variance-authority";

export type ValidationIssueHeaderSeverity = "error" | "warning";

export const validationIssueHeaderAccentVariants = cva("", {
  variants: {
    severity: {
      error: "text-red-600",
      warning: "text-amber-600",
    },
  },
  defaultVariants: {
    severity: "warning",
  },
});

export const validationIssueHeaderMessageBoxVariants = cva("rounded-md p-2", {
  variants: {
    severity: {
      error: "bg-red-50",
      warning: "bg-amber-50",
    },
  },
  defaultVariants: {
    severity: "warning",
  },
});
