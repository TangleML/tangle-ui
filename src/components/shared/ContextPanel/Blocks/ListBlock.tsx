import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

import { KeyValuePair, type KeyValuePairProps } from "./KeyValuePair";

interface ListBlockProps {
  title?: string;
  items: KeyValuePairProps[];
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
            <li key={index}>
              <KeyValuePair {...item} />
            </li>
          );
        })}
      </BlockStack>
    </BlockStack>
  );
};
