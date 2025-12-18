import { InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { CopyText } from "../../CopyText/CopyText";

export interface AttributeProps {
  label?: string;
  value?: string | { href: string; text: string };
  critical?: boolean;
  copyable?: boolean;
}

export const Attribute = ({
  label,
  value,
  critical,
  copyable,
}: AttributeProps) => {
  if (!value) {
    return null;
  }

  return (
    <InlineStack gap="2" blockAlign="center" wrap="nowrap">
      {label && (
        <Paragraph
          size="xs"
          tone={critical ? "critical" : "inherit"}
          className="truncate"
          title={label}
        >
          {label}:
        </Paragraph>
      )}

      <div className="min-w-16 flex-1 overflow-hidden">
        {isLink(value) ? (
          <Link
            href={value.href}
            size="xs"
            variant="classic"
            external
            target="_blank"
            rel="noopener noreferrer"
          >
            {value.text}
          </Link>
        ) : copyable ? (
          <CopyText
            className={cn(
              "text-xs truncate",
              critical ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {value}
          </CopyText>
        ) : (
          <Paragraph
            size="xs"
            tone={critical ? "critical" : "subdued"}
            className="truncate"
            title={value}
          >
            {value}
          </Paragraph>
        )}
      </div>
    </InlineStack>
  );
};

const isLink = (
  val: string | { href: string; text: string },
): val is { href: string; text: string } => {
  return typeof val === "object" && val !== null && "href" in val;
};
