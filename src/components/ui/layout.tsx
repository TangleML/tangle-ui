import { cva, type VariantProps } from "class-variance-authority";
import {
  type AriaAttributes,
  forwardRef,
  type PropsWithChildren,
  type Ref,
} from "react";

import { cn } from "@/lib/utils";

type StackElement = "div" | "span" | "li" | "ol" | "ul";

const blockStackVariants = cva("flex flex-col w-full", {
  variants: {
    align: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
    },
    inlineAlign: {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      "space-around": "justify-around",
      "space-between": "justify-between",
      "space-evenly": "justify-evenly",
    },
    gap: {
      "0": "gap-0",
      "1": "gap-1",
      "2": "gap-2",
      "3": "gap-3",
      "4": "gap-4",
      "5": "gap-5",
      "6": "gap-6",
      "8": "gap-8",
    },
  },
});

interface BlockStackProps
  extends AriaAttributes,
  VariantProps<typeof blockStackVariants> {
  /** HTML Element type
   * @default 'div'
   */
  as?: StackElement;
  /** Additional CSS classes */
  className?: string;
}

export const BlockStack = forwardRef<
  HTMLElement,
  PropsWithChildren<BlockStackProps>
>((props, ref) => {
  const {
    as: Element = "div",
    className = "",
    align = "start",
    inlineAlign = "start",
    gap = "0",
    children,
    ...rest
  } = props;

  return (
    <Element
      className={cn(
        blockStackVariants({ align, inlineAlign, gap }),
        className.split(" "),
      )}
      {...rest}
      ref={ref as Ref<any>}
    >
      {children}
    </Element>
  );
});

BlockStack.displayName = "BlockStack";

const inlineStackVariants = cva("flex flex-row", {
  variants: {
    align: {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      "space-around": "justify-around",
      "space-between": "justify-between",
      "space-evenly": "justify-evenly",
    },
    blockAlign: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      baseline: "items-baseline",
      stretch: "items-stretch",
    },
    gap: {
      "0": "gap-0",
      "1": "gap-1",
      "2": "gap-2",
      "3": "gap-3",
      "4": "gap-4",
      "5": "gap-5",
      "6": "gap-6",
      "8": "gap-8",
    },
    wrap: {
      wrap: "flex-wrap",
      nowrap: "flex-nowrap",
    },
  },
});

interface InlineStackProps
  extends AriaAttributes,
  VariantProps<typeof inlineStackVariants> {
  /** HTML Element type
   * @default 'div'
   */
  as?: StackElement;
  /** Additional CSS classes */
  className?: string;
}

export const InlineStack = forwardRef<
  HTMLElement,
  PropsWithChildren<InlineStackProps>
>((props, ref) => {
  const {
    as: Element = "div",
    align = "start",
    blockAlign = "start",
    gap = "0",
    wrap = "wrap",
    children,
    className = "",
    ...rest
  } = props;

  return (
    <Element
      className={cn(
        inlineStackVariants({ align, blockAlign, gap, wrap }),
        className,
      )}
      {...rest}
      ref={ref as Ref<any>}
    >
      {children}
    </Element>
  );
});

InlineStack.displayName = "InlineStack";
