import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface ContextHeaderProps {
  icon: string;
  name: string;
}

export const ContextHeader = ({ icon, name }: ContextHeaderProps) => {
  return (
    <InlineStack gap="2">
      <Text size="lg" weight="semibold" className="wrap-anywhere">
        {icon} {name}
      </Text>
    </InlineStack>
  );
};
