import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";

interface TangentUnreachableProps {
  baseUrl: string | null;
  onRetry?: () => void;
}

export function TangentUnreachable({
  baseUrl,
  onRetry = () => window.location.reload(),
}: TangentUnreachableProps) {
  return (
    <BlockStack fill align="center" gap="1" className="p-10">
      <InfoBox
        variant="error"
        title={baseUrl ? "Tangent isn't reachable" : "Tangent isn't configured"}
        className="max-w-md"
      >
        <BlockStack gap="3">
          <Paragraph size="sm">
            {baseUrl
              ? `Nothing answered at ${baseUrl}, so this project cannot be opened. Check that Tangent is running and that the workspace points at the right address.`
              : "This project's workspace does not say where Tangent lives, so this project cannot be opened. Set a Tangent address on the workspace to open it here."}
          </Paragraph>
          <InlineStack gap="2">
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          </InlineStack>
        </BlockStack>
      </InfoBox>
    </BlockStack>
  );
}
