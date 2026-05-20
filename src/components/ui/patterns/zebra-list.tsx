import {
  Children,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { BlockStack } from "@/components/ui/layout";

/**
 * ZebraList — Layer 3 semantic primitive.
 *
 * Vertical stack of children with alternating row tinting.
 * Replaces the recurring `odd:bg-secondary even:bg-white` pattern (~6 hits).
 *
 * Children should be `ListRow` (or anything that accepts `zebra={true}`).
 * For arbitrary children, the zebra effect is applied via a wrapper data-attribute
 * so the row component can opt in to styling.
 */

interface ZebraListProps {
  children: ReactNode;
  /** Stack gap between rows. @default '0' (tight zebra list) */
  gap?: "0" | "0.5" | "1" | "1.5" | "2" | "3" | "4" | "5" | "6" | "8";
  as?: "div" | "ul" | "ol";
}

export function ZebraList({ children, gap = "0", as = "div" }: ZebraListProps) {
  const decorated = Children.toArray(children).map((child, index) => {
    if (typeof child !== "object" || child == null) return child;
    const element = child as ReactElement<{
      zebra?: boolean;
      "data-zebra"?: string;
    }>;
    return cloneElement(element, {
      key: element.key ?? index,
      zebra: true,
      "data-zebra": index % 2 === 0 ? "odd" : "even",
    });
  });
  return (
    <BlockStack as={as} gap={gap}>
      {decorated}
    </BlockStack>
  );
}

ZebraList.displayName = "ZebraList";
