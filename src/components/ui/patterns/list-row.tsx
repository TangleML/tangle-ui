import { cva, type VariantProps } from "class-variance-authority";
import {
  forwardRef,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type PropsWithChildren,
  type Ref,
} from "react";

import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

/**
 * ListRow — Layer 3 semantic primitive.
 *
 * Horizontal row inside a list. Composes InlineStack + the `group` class so that
 * children can use `HoverReveal` and group-hover-aware styling.
 *
 * Replaces the recurring `<InlineStack className="group hover:bg-* px-* py-*">` pattern
 * (~18 hits across v2).
 */

const listRowVariants = cva("group w-full rounded-sm transition-colors", {
  variants: {
    density: {
      compact: "px-1 py-0.5",
      cozy: "px-2 py-1",
      comfortable: "px-3 py-2",
    },
    hoverable: {
      true: "hover:bg-muted/60 cursor-pointer",
      false: "",
    },
    selected: {
      true: "bg-muted",
      false: "",
    },
    zebra: {
      true: "even:bg-muted/30",
      false: "",
    },
  },
  defaultVariants: {
    density: "cozy",
    hoverable: false,
    selected: false,
    zebra: false,
  },
});

type ListRowVariantProps = VariantProps<typeof listRowVariants>;

interface ListRowProps extends ListRowVariantProps {
  as?: "li" | "div";
  onClick?: MouseEventHandler<HTMLElement>;
  /** Inter-item gap. @default '2' */
  gap?: "0" | "0.5" | "1" | "1.5" | "2" | "3" | "4" | "5" | "6" | "8";
}

export const ListRow = forwardRef<HTMLElement, PropsWithChildren<ListRowProps>>(
  function ListRow(
    {
      children,
      as: Element = "div",
      density = "cozy",
      hoverable = false,
      selected = false,
      zebra = false,
      onClick,
      gap = "2",
    },
    ref,
  ) {
    const isInteractive = hoverable || onClick != null;
    const handleKeyDown: KeyboardEventHandler<HTMLElement> | undefined = onClick
      ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick(event as unknown as Parameters<typeof onClick>[0]);
          }
        }
      : undefined;
    return (
      <Element
        ref={ref as Ref<any>}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        className={cn(
          listRowVariants({
            density,
            hoverable: isInteractive,
            selected,
            zebra,
          }),
        )}
      >
        <InlineStack gap={gap} wrap="nowrap" blockAlign="center">
          {children}
        </InlineStack>
      </Element>
    );
  },
);

ListRow.displayName = "ListRow";
