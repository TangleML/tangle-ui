import { forwardRef, type PropsWithChildren, type ReactNode } from "react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

import { Surface, type SurfaceLevel, type SurfaceTone } from "./surface";

/**
 * Section — Layer 3 semantic primitive.
 *
 * A Surface with a built-in header (title + optional actions + optional divider).
 * Replaces the recurring `Surface + InlineStack + Heading + actions` template.
 *
 * Polaris rule: no horizontal dividers inside a Surface unless it's a data/index table.
 * `divider` is therefore opt-in.
 */

interface SectionProps {
  /** Section title (rendered as a heading). */
  title?: ReactNode;
  /** Optional trailing actions in the header (buttons, icon buttons). */
  actions?: ReactNode;
  /** Show a divider line between header and body. Use only for data-like content. */
  divider?: boolean;
  /** Override the auto-derived surface level. */
  level?: SurfaceLevel;
  /** Semantic background tone. */
  tone?: SurfaceTone;
  /** Heading level for the title. @default 3 */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

export const Section = forwardRef<HTMLElement, PropsWithChildren<SectionProps>>(
  function Section(
    {
      title,
      actions,
      divider = false,
      level,
      tone = "default",
      headingLevel = 3,
      children,
    },
    ref,
  ) {
    return (
      <Surface ref={ref} as="section" level={level} tone={tone}>
        <BlockStack gap="3">
          {(title || actions) && (
            <BlockStack gap="2">
              <InlineStack
                wrap="nowrap"
                blockAlign="center"
                align="space-between"
                gap="2"
              >
                {title && <Heading level={headingLevel}>{title}</Heading>}
                {actions}
              </InlineStack>
              {divider && (
                <div className="h-px w-full bg-border" aria-hidden="true" />
              )}
            </BlockStack>
          )}
          {children}
        </BlockStack>
      </Surface>
    );
  },
);

Section.displayName = "Section";
