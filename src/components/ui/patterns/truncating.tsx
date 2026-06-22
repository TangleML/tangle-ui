import { forwardRef, type PropsWithChildren, type Ref } from "react";

import { cn } from "@/lib/utils";

/**
 * Truncating — Layer 3 semantic primitive.
 *
 * Wraps a flex child that should shrink. Encodes the recurring `min-w-0 flex-1`
 * boilerplate (~28+20 hits across v2). Apply `truncate` on the inner `<Text>`
 * for the actual ellipsis behavior:
 *
 *   <InlineStack gap="2" wrap="nowrap" blockAlign="center">
 *     <Icon name="..." />
 *     <Truncating>
 *       <Text truncate>Long label that should truncate</Text>
 *     </Truncating>
 *     <Button>Action</Button>
 *   </InlineStack>
 */

interface TruncatingProps {
  /** How wide the truncating cell may grow. Default: fill remaining space. */
  grow?: "fill" | "fit";
  as?: "div" | "span";
}

export const Truncating = forwardRef<
  HTMLElement,
  PropsWithChildren<TruncatingProps>
>(function Truncating({ children, grow = "fill", as: Element = "div" }, ref) {
  return (
    <Element
      ref={ref as Ref<any>}
      className={cn(
        "min-w-0",
        grow === "fill" && "flex-1",
        grow === "fit" && "w-fit",
      )}
    >
      {children}
    </Element>
  );
});

Truncating.displayName = "Truncating";
