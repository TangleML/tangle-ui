import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen = ({
  message = "Loading content",
}: LoadingScreenProps) => {
  return (
    <BlockStack fill>
      <Spinner size={32} />
      <Paragraph tone="subdued" size="sm">
        {message}
      </Paragraph>
    </BlockStack>
  );
};
