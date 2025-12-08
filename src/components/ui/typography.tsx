import { cva, type VariantProps } from "class-variance-authority";
import type { AriaAttributes, AriaRole, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type TextElement =
  | "dt"
  | "dd"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "u"
  | "span"
  | "strong"
  | "legend";

const textVariants = cva("", {
  variants: {
    font: {
      default: "",
      mono: "!font-mono",
    },
    tone: {
      inherit: "text-foreground",
      subdued: "text-muted-foreground",
      critical: "text-destructive",
      inverted: "text-inverted",
      info: "text-foreground underline decoration-dotted",
      warning: "text-warning",
    },
    size: {
      xs: "text-xs",
      sm: "text-sm",
      md: "text-md",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
    },
    weight: {
      regular: "font-regular",
      semibold: "font-semibold",
      bold: "font-bold",
      light: "font-light",
    },
  },
});

interface TextProps
  extends PropsWithChildren<AriaAttributes>, VariantProps<typeof textVariants> {
  /**
   * The role of the text element.
   * @default 'text'
   */
  role?: AriaRole;

  /** HTML Element type
   * @default 'span'
   */
  as?: TextElement;

  /** Custom class name
   * @default ''
   */
  className?: string;
}

/**
 * Text component. Wraps any text element and provides a set of default styles.
 * @param param0
 * @returns
 */
export function Text({
  as: Element = "span",
  tone = "inherit",
  size = "md",
  weight = "regular",
  font = "default",
  children,
  className,
  ...rest
}: TextProps) {
  return (
    <Element
      className={cn(textVariants({ tone, size, weight, font }), className)}
      {...rest}
    >
      {children}
    </Element>
  );
}

Text.displayName = "Text";

/**
 * Paragraph component. Wraps the Text component and sets the element to 'p'.
 * @param param0
 * @returns
 */
export function Paragraph({ children, ...rest }: TextProps) {
  return (
    <Text as="p" {...rest}>
      {children}
    </Text>
  );
}

Paragraph.displayName = "Paragraph";

/**
 * Heading component. Wraps the Text component and sets the element to 'h1', 'h2', 'h3', 'h4', 'h5', or 'h6'.
 * @param param0
 * @returns
 */
export const Heading = ({
  children,
  level = 1,
}: PropsWithChildren<{ level: 1 | 2 | 3 | 4 | 5 | 6 }>) => {
  return (
    <Text
      as={`h${level}`}
      size={level === 1 ? "md" : "sm"}
      weight={level < 3 ? "semibold" : "regular"}
      role="heading"
      aria-level={level}
    >
      {children}
    </Text>
  );
};

Heading.displayName = "Heading";
