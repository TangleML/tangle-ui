import { cva } from "class-variance-authority";

/**
 * Factory for the `selected > hovered > subgraph > default` card border
 * cascade used by TaskNodeCollapsed.
 *
 * Each consumer provides its own base classes (sizing, rounding, etc.)
 * while the compound variant logic (border color + ring) stays DRY.
 */
export function createTaskNodeCardVariants(baseClasses: string) {
  return cva(baseClasses, {
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
  });
}
