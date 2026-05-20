import {
  forwardRef,
  type PropsWithChildren,
  type ReactNode,
  type Ref,
  useId,
} from "react";

import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

/**
 * FieldRow — Layer 3 semantic primitive.
 *
 * Label + control + optional help text + optional error. Encodes the recurring
 * `BlockStack gap-1` + Label + Input form-row pattern (~12 hits across v2).
 *
 *   <FieldRow label="Pipeline name" help="Used in URLs">
 *     <Input value={name} onChange={...} />
 *   </FieldRow>
 *
 * Handles `htmlFor` wiring automatically: the first focusable control receives
 * the generated id, or you can pass `controlId` explicitly.
 */

interface FieldRowProps {
  /** Visible label. */
  label: ReactNode;
  /** Helper text (subdued, shown below the control). */
  help?: ReactNode;
  /** Error message (overrides `help` styling when present). */
  error?: ReactNode;
  /** Required asterisk + aria-required. */
  required?: boolean;
  /** Provide an explicit id for the control; otherwise an id is generated. */
  controlId?: string;
  /** Lay out label inline with control instead of stacked. */
  inline?: boolean;
}

export const FieldRow = forwardRef<
  HTMLDivElement,
  PropsWithChildren<FieldRowProps>
>(function FieldRow(
  { label, help, error, required, controlId, inline = false, children },
  ref,
) {
  const generatedId = useId();
  const id = controlId ?? generatedId;
  const helpId = help || error ? `${id}-help` : undefined;
  const Container = inline ? InlineStack : BlockStack;
  return (
    <BlockStack ref={ref as Ref<HTMLDivElement>} gap="1">
      <Container
        gap={inline ? "2" : "1"}
        {...(inline ? { blockAlign: "center" } : {})}
      >
        <Label htmlFor={id}>
          {label}
          {required && (
            <Text tone="critical" aria-hidden="true">
              {" *"}
            </Text>
          )}
        </Label>
        {children}
      </Container>
      {error ? (
        <Text id={helpId} size="xs" tone="critical">
          {error}
        </Text>
      ) : help ? (
        <Text id={helpId} size="xs" tone="subdued">
          {help}
        </Text>
      ) : null}
    </BlockStack>
  );
});

FieldRow.displayName = "FieldRow";
