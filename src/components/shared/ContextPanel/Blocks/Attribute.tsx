import { Link as RouterLink } from "@tanstack/react-router";

import { InlineStack } from "@/components/ui/layout";
import { Link, linkVariants } from "@/components/ui/link";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { CopyText } from "../../CopyText/CopyText";

interface AttributeLink {
  href: string;
  text: string;
  title?: string;
  internal?: boolean;
}

export interface AttributeProps {
  label?: string;
  value?: string | AttributeLink;
  critical?: boolean;
  copyable?: boolean;
  className?: string;
}

export const Attribute = ({
  label,
  value,
  critical,
  copyable,
  className,
}: AttributeProps) => {
  if (!value) {
    return null;
  }

  const labelContent =
    copyable && label ? (
      <CopyText size="xs" className="truncate" compact>
        {label}
      </CopyText>
    ) : (
      <Paragraph
        size="xs"
        tone={critical ? "critical" : "inherit"}
        className="truncate"
        title={label}
      >
        {label}
      </Paragraph>
    );

  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      wrap="nowrap"
      className={className}
    >
      {label && labelContent}

      <div className="min-w-16 flex-1 overflow-hidden">
        {isLink(value) ? (
          value.internal ? (
            <RouterLink
              to={value.href}
              title={value.title}
              className={linkVariants({ size: "xs" })}
            >
              {value.text}
            </RouterLink>
          ) : (
            <Link
              href={value.href}
              title={value.title}
              size="xs"
              variant="classic"
              external
              target="_blank"
              rel="noopener noreferrer"
            >
              {value.text}
            </Link>
          )
        ) : copyable ? (
          <CopyText
            size="xs"
            className={cn(
              "truncate",
              critical ? "text-destructive" : "text-muted-foreground",
            )}
            compact
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

const isLink = (val: string | AttributeLink): val is AttributeLink => {
  return typeof val === "object" && val !== null && "href" in val;
};
