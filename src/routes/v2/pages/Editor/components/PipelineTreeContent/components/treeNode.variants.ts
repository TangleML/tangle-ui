import { cva } from "class-variance-authority";

export const treeNodeRowVariants = cva(
  "flex items-start gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
  {
    variants: {
      isCurrentGraph: { true: "", false: "" },
      isInCurrentPath: { true: "", false: "" },
      hasErrors: { true: "", false: "" },
      fullWidth: { true: "w-full", false: "" },
    },
    compoundVariants: [
      {
        isCurrentGraph: false,
        isInCurrentPath: false,
        hasErrors: false,
        className: "hover:bg-slate-100",
      },
      {
        isCurrentGraph: false,
        isInCurrentPath: false,
        hasErrors: true,
        className: "bg-red-50/50",
      },
      {
        isCurrentGraph: false,
        isInCurrentPath: true,
        className: "bg-blue-50 text-blue-800",
      },
      {
        isCurrentGraph: true,
        className: "bg-blue-100 text-blue-900",
      },
    ],
    defaultVariants: {
      isCurrentGraph: false,
      isInCurrentPath: false,
      hasErrors: false,
      fullWidth: false,
    },
  },
);

export const treeNodeIconVariants = cva("shrink-0 mt-0.5", {
  variants: {
    isCurrentGraph: { true: "", false: "" },
    isInCurrentPath: { true: "", false: "" },
    hasErrors: { true: "", false: "" },
  },
  compoundVariants: [
    {
      isCurrentGraph: false,
      isInCurrentPath: false,
      hasErrors: false,
      className: "text-slate-500",
    },
    {
      isCurrentGraph: false,
      isInCurrentPath: false,
      hasErrors: true,
      className: "text-red-500",
    },
    {
      isCurrentGraph: false,
      isInCurrentPath: true,
      className: "text-blue-500",
    },
    {
      isCurrentGraph: true,
      className: "text-blue-600",
    },
  ],
  defaultVariants: {
    isCurrentGraph: false,
    isInCurrentPath: false,
    hasErrors: false,
  },
});
