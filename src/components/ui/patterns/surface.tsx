import { cva, type VariantProps } from "class-variance-authority";
import {
  type AriaAttributes,
  createContext,
  type CSSProperties,
  forwardRef,
  type MouseEventHandler,
  type PropsWithChildren,
  type Ref,
  useContext,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Surface — Layer 3 semantic primitive.
 *
 * Finite, nesting-aware container with predefined visual treatment.
 * Inspired by Shopify Polaris (spatial organization) and Material Design (surfaces).
 *
 * - `level` is auto-detected from `SurfaceLevelContext`. Explicit override allowed for portal'd content.
 * - Padding, radius, background are derived from `level` and `tone` — never user-set.
 * - Hard cap at level 3. Attempting to nest deeper throws a dev-mode error.
 */

export type SurfaceLevel = 1 | 2 | 3;

const SurfaceLevelContext = createContext<0 | SurfaceLevel>(0);

/**
 * Provider that explicitly sets the next surface depth for portal'd content
 * (popovers, dialogs, dropdowns) whose React tree disagrees with their visual nesting.
 */
export function SurfaceLevelProvider({
  level,
  children,
}: PropsWithChildren<{ level: 0 | SurfaceLevel }>) {
  return (
    <SurfaceLevelContext.Provider value={level}>
      {children}
    </SurfaceLevelContext.Provider>
  );
}

/**
 * Read the current surface depth (0 if no enclosing Surface).
 * Useful when deciding header/divider treatment inside a layer-4 composition.
 */
export function useSurfaceLevel(): 0 | SurfaceLevel {
  return useContext(SurfaceLevelContext);
}

const surfaceVariants = cva("transition-colors", {
  variants: {
    level: {
      1: "bg-card text-card-foreground border border-border rounded-lg shadow-sm p-4",
      2: "bg-muted/40 rounded-md p-3",
      3: "bg-muted/60 rounded-sm p-2",
    },
    tone: {
      default: "",
      critical: "",
      warning: "",
      info: "",
      success: "",
      magic: "",
    },
    hoverable: {
      true: "cursor-pointer",
      false: "",
    },
  },
  compoundVariants: [
    // Level 1 tones — saturated subtle background + tinted border
    {
      level: 1,
      tone: "critical",
      className: "bg-destructive/5 border-destructive/40",
    },
    { level: 1, tone: "warning", className: "bg-warning/10 border-warning/40" },
    { level: 1, tone: "info", className: "bg-info/5 border-info/40" },
    { level: 1, tone: "success", className: "bg-success/5 border-success/40" },
    {
      level: 1,
      tone: "magic",
      className: "bg-accent border-accent-foreground/20",
    },
    // Level 2 tones
    { level: 2, tone: "critical", className: "bg-destructive/10" },
    { level: 2, tone: "warning", className: "bg-warning/15" },
    { level: 2, tone: "info", className: "bg-info/10" },
    { level: 2, tone: "success", className: "bg-success/10" },
    { level: 2, tone: "magic", className: "bg-accent/70" },
    // Level 3 tones
    { level: 3, tone: "critical", className: "bg-destructive/15" },
    { level: 3, tone: "warning", className: "bg-warning/20" },
    { level: 3, tone: "info", className: "bg-info/15" },
    { level: 3, tone: "success", className: "bg-success/15" },
    { level: 3, tone: "magic", className: "bg-accent" },
    // Hover treatment per level
    { level: 1, hoverable: true, className: "hover:bg-muted/30" },
    { level: 2, hoverable: true, className: "hover:bg-muted/60" },
    { level: 3, hoverable: true, className: "hover:bg-muted/80" },
  ],
  defaultVariants: {
    tone: "default",
    hoverable: false,
  },
});

type SurfaceVariantProps = VariantProps<typeof surfaceVariants>;

export type SurfaceTone = NonNullable<SurfaceVariantProps["tone"]>;

interface SurfaceProps extends AriaAttributes {
  /**
   * Explicit nesting level override. Use only for portal'd content (popovers, dialogs).
   * Otherwise the level is auto-derived from SurfaceLevelContext.
   */
  level?: SurfaceLevel;
  /** Semantic background tone. @default 'default' */
  tone?: SurfaceTone;
  /** Render as a clickable surface (hover bg, cursor). */
  hoverable?: boolean;
  /** Click handler — sets role="button" + tabIndex when present. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** HTML element to render as. @default 'div' */
  as?: "div" | "section" | "article" | "aside";
  /** ARIA role override. */
  role?: string;
  /**
   * Inline style — reserved for *dynamic* CSS values that can't be expressed via
   * tokens (e.g. layer-4 cards that compute palette colours at runtime).
   * Static styling is forbidden here; use tone/level instead.
   */
  style?: CSSProperties;
}

function resolveLevel(
  explicit: SurfaceLevel | undefined,
  contextLevel: 0 | SurfaceLevel,
): SurfaceLevel {
  if (explicit != null) return explicit;
  const next = (contextLevel + 1) as SurfaceLevel | 4;
  if (next > 3) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        "[Surface] Maximum nesting depth (3) exceeded. " +
          "See https://polaris-react.shopify.com/design/layout/spacial-organization. " +
          "Either flatten the structure or use a layer-4 domain component.",
      );
    }
    return 3;
  }
  return next as SurfaceLevel;
}

export const Surface = forwardRef<HTMLElement, PropsWithChildren<SurfaceProps>>(
  function Surface(
    {
      children,
      level: levelProp,
      tone = "default",
      hoverable = false,
      onClick,
      as: Element = "div",
      role,
      style,
      ...rest
    },
    ref,
  ) {
    const contextLevel = useContext(SurfaceLevelContext);
    const level = resolveLevel(levelProp, contextLevel);
    const isInteractive = hoverable || onClick != null;
    return (
      <SurfaceLevelContext.Provider value={level}>
        <Element
          ref={ref as Ref<any>}
          role={role ?? (onClick ? "button" : undefined)}
          tabIndex={onClick ? 0 : undefined}
          onClick={onClick}
          style={style}
          className={cn(
            surfaceVariants({ level, tone, hoverable: isInteractive }),
          )}
          {...rest}
        >
          {children}
        </Element>
      </SurfaceLevelContext.Provider>
    );
  },
);

Surface.displayName = "Surface";

/**
 * Internal helper used by Layer-3 wrapper primitives (Card, Section, ListRow, etc.)
 * to manually set the SurfaceLevelContext when a primitive *acts* as a surface
 * but doesn't render `<Surface>` directly.
 */
export { SurfaceLevelContext as _SurfaceLevelContext };
