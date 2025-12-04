import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Heading, Paragraph } from "@/components/ui/typography";

export interface ListBlockItemProps {
  name?: string;
  value?: string | { href: string; text: string };
  critical?: boolean;
}

interface ListBlockProps {
  title?: string;
  items: ListBlockItemProps[];
  marker?: "bullet" | "number" | "none";
  className?: string;
}

export const ListBlock = ({
  title,
  items,
  marker = "bullet",
  className,
}: ListBlockProps) => {
  const listElement = marker === "number" ? "ol" : "ul";

  const getListStyle = () => {
    switch (marker) {
      case "bullet":
        return "pl-5 list-disc";
      case "number":
        return "pl-5 list-decimal";
      case "none":
        return "list-none";
      default:
        return "pl-5 list-disc";
    }
  };

  return (
    <BlockStack className={className}>
      {title && <Heading level={3}>{title}</Heading>}
      <BlockStack as={listElement} gap="1" className={getListStyle()}>
        {items.map((item, index) => {
          if (!item.value) {
            return null;
          }

          return (
            <li key={index} className="w-full">
              <ListBlockItem
                name={item.name}
                value={item.value}
                critical={item.critical}
              />
            </li>
          );
        })}
      </BlockStack>
    </BlockStack>
  );
};

const ListBlockItem = ({ name, value, critical }: ListBlockItemProps) => {
  if (!value) {
    return null;
  }

  return (
    <InlineStack gap="2" blockAlign="center" wrap="nowrap">
      {name && (
        <Paragraph size="xs" tone={critical ? "critical" : "inherit"}>
          {name}:
        </Paragraph>
      )}
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
      ) : (
        <Paragraph
          size="xs"
          tone={critical ? "critical" : "subdued"}
          className="truncate"
        >
          {value}
        </Paragraph>
      )}
    </InlineStack>
  );
};

const isLink = (
  val: string | { href: string; text: string },
): val is { href: string; text: string } => {
  return typeof val === "object" && val !== null && "href" in val;
};
