import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";

interface TangentUnreachableProps {
  baseUrl: string | null;
  localAddress?: string | null;
  onRetry?: () => void;
}

function describe(baseUrl: string | null, localAddress: string | null) {
  if (baseUrl) {
    return {
      title: "Tangent isn't reachable",
      detail: `Nothing answered at ${baseUrl}, so this project cannot be opened. Check that Tangent is running and that the workspace points at the right address.`,
    };
  }

  if (localAddress) {
    return {
      title: "Tangent is misconfigured",
      detail: `This project's workspace points Tangent at ${localAddress}, an address on the machine running this browser rather than a deployed Tangent. Point the workspace at the Tangent for this environment to open it here.`,
    };
  }

  return {
    title: "Tangent isn't configured",
    detail:
      "This project's workspace does not say where Tangent lives, so this project cannot be opened. Set a Tangent address on the workspace to open it here.",
  };
}

export function TangentUnreachable({
  baseUrl,
  localAddress = null,
  onRetry = () => window.location.reload(),
}: TangentUnreachableProps) {
  const { title, detail } = describe(baseUrl, localAddress);

  return (
    <BlockStack fill align="center" gap="1" className="p-10">
      <InfoBox variant="error" title={title} className="max-w-md">
        <BlockStack gap="3">
          <Paragraph size="sm">{detail}</Paragraph>
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
