import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export const TogglePreview = ({
  showPreview,
  setShowPreview,
}: {
  showPreview: boolean;
  setShowPreview: (showPreview: boolean) => void;
}) => {
  return (
    <InlineStack gap="1">
      <Text>Preview:</Text>
      <Button
        variant="link"
        className={cn(
          showPreview
            ? "text-bold"
            : "hover:no-underline text-blue-400 disabled:opacity-100",
        )}
        onClick={() => setShowPreview(true)}
        disabled={showPreview}
      >
        Card
      </Button>
      <Text>|</Text>
      <Button
        variant="link"
        className={cn(
          showPreview
            ? "hover:no-underline text-blue-400 disabled:opacity-100"
            : "text-bold",
        )}
        onClick={() => setShowPreview(false)}
        disabled={!showPreview}
      >
        YAML
      </Button>
    </InlineStack>
  );
};
