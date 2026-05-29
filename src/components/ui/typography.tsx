import { cva, type VariantProps } from "class-variance-authority";
import type {
  AriaAttributes,
  AriaRole,
  HTMLAttributes,
  PropsWithChildren,
} from "react";

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
      strong: "text-foreground",
      weak: "text-muted-foreground/70",
      critical: "text-destructive",
      inverted: "text-background",
      // 'info' preserves the existing dotted-underline behavior used as inline help.
      info: "text-foreground underline decoration-dotted",
      warning: "text-warning",
      success: "text-success",
      accent: "text-accent-foreground",
      magic: "text-accent-foreground",
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
      medium: "font-medium",
    },
    align: {
      start: "text-start",
      center: "text-center",
      end: "text-end",
      justify: "text-justify",
    },
    wrap: {
      normal: "whitespace-normal",
      "break-anywhere": "wrap-anywhere",
      "break-word": "wrap-break-word",
      pre: "whitespace-pre",
      "pre-wrap": "whitespace-pre-wrap",
      nowrap: "whitespace-nowrap",
    },
    italic: {
      true: "italic",
      false: "",
    },
    leading: {
      tight: "leading-tight",
      normal: "leading-normal",
      relaxed: "leading-relaxed",
    },
    transform: {
      none: "",
      uppercase: "uppercase",
      lowercase: "lowercase",
      capitalize: "capitalize",
    },
    decoration: {
      none: "no-underline",
      underline: "underline",
    },
  },
});

type TextVariantProps = VariantProps<typeof textVariants>;

interface TextProps
  extends PropsWithChildren<AriaAttributes>, TextVariantProps {
  /**
   * The role of the text element.
   * @default 'text'
   */
  role?: AriaRole;

  /** HTML Element type
   * @default 'span'
   */
  as?: TextElement;

  /**
   * Truncate to one line (true) or N lines (number).
   * Use inside `<Truncating>` for proper flex behavior, or on a width-constrained parent.
   */
  truncate?: boolean | number;

  /** Native browser tooltip text */
  title?: string;

  /** Optional id for a11y / label-for wiring. */
  id?: string;

  /**
   * Escape-hatch className. Kept for backward compatibility during migration.
   * Will be removed once the codemod has run and the no-classname-on-primitives
   * ESLint rule is promoted to error.
   * @deprecated Use semantic props (`tone`, `truncate`, `wrap`, `align`, `italic`, `leading`) instead.
   */
  className?: string;
}

function truncateClass(truncate: boolean | number | undefined): string {
  if (truncate === true) return "truncate";
  if (typeof truncate === "number" && truncate > 0) {
    if (truncate === 1) return "truncate";
    // line-clamp-N for finite values; tailwind ships 1..6 by default.
    return `line-clamp-${truncate} break-words`;
  }
  return "";
}

/**
 * Text component. Wraps any text element and provides a set of default styles.
 */
export function Text({
  as: Element = "span",
  tone = "inherit",
  size = "md",
  weight = "regular",
  font = "default",
  align,
  wrap,
  italic,
  leading,
  transform,
  decoration,
  truncate,
  className,
  children,
  ...rest
}: TextProps) {
  return (
    <Element
      className={cn(
        textVariants({
          tone,
          size,
          weight,
          font,
          align,
          wrap,
          italic,
          leading,
          transform,
          decoration,
        }),
        truncateClass(truncate),
        className,
      )}
      {...(rest as HTMLAttributes<HTMLElement>)}
    >
      {children}
    </Element>
  );
}

Text.displayName = "Text";

/**
 * Paragraph component. Wraps the Text component and sets the element to 'p'.
 */
export function Paragraph({ children, ...rest }: Omit<TextProps, "as">) {
  return (
    <Text as="p" {...rest}>
      {children}
    </Text>
  );
}

Paragraph.displayName = "Paragraph";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface HeadingProps extends PropsWithChildren {
  level: HeadingLevel;
  /** Override default size for the level. */
  size?: TextVariantProps["size"];
  /** Override default weight for the level. */
  weight?: TextVariantProps["weight"];
  /** Semantic tone (e.g. 'critical' for error titles). */
  tone?: TextVariantProps["tone"];
  /** Mono font. */
  font?: TextVariantProps["font"];
  /** Truncate (single line) or line-clamp (N lines). */
  truncate?: boolean | number;
  /** Text alignment. */
  align?: TextVariantProps["align"];
  /** Wrap behavior. */
  wrap?: TextVariantProps["wrap"];
  /**
   * Escape-hatch className. Kept for backward compatibility during migration.
   * @deprecated Use semantic props instead.
   */
  className?: string;
}

const HEADING_SIZE: Record<
  HeadingLevel,
  NonNullable<TextVariantProps["size"]>
> = {
  1: "md",
  2: "sm",
  3: "sm",
  4: "sm",
  5: "sm",
  6: "sm",
};

const HEADING_WEIGHT: Record<
  HeadingLevel,
  NonNullable<TextVariantProps["weight"]>
> = {
  1: "semibold",
  2: "semibold",
  3: "regular",
  4: "regular",
  5: "regular",
  6: "regular",
};

/**
 * Heading component. Renders h1-h6 with role and aria-level set.
 * Accepts the same semantic overrides as Text.
 */
export const Heading = ({
  children,
  level = 1,
  size,
  weight,
  tone,
  font,
  truncate,
  align,
  wrap,
  className,
}: HeadingProps) => {
  return (
    <Text
      as={`h${level}`}
      size={size ?? HEADING_SIZE[level]}
      weight={weight ?? HEADING_WEIGHT[level]}
      tone={tone}
      font={font}
      truncate={truncate}
      align={align}
      wrap={wrap}
      className={className}
      role="heading"
      aria-level={level}
    >
      {children}
    </Text>
  );
};

Heading.displayName = "Heading";
