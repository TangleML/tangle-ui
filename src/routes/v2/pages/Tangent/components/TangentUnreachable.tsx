import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";

interface TangentUnreachableProps {
  baseUrl: string | null;
  localAddress?: string | null;
  onRetry?: () => void;
}

function describe(baseUrl: string | null, localAddress: string | null) {
  if (baseUrl) {
    return {
      title: "Tangent isn't reachable",
      detail:
        "Nothing answered at this address, so this project cannot be opened. Check that Tangent is running and that the workspace points at the right address.",
      address: baseUrl,
    };
  }

  if (localAddress) {
    return {
      title: "Tangent is misconfigured",
      detail:
        "This project's workspace points Tangent at an address on the machine running this browser rather than a deployed Tangent. Point the workspace at the Tangent for this environment to open it here.",
      address: localAddress,
    };
  }

  return {
    title: "Tangent isn't configured",
    detail:
      "This project's workspace does not say where Tangent lives, so this project cannot be opened. Set a Tangent address on the workspace to open it here.",
    address: null,
  };
}

export function TangentUnreachable({
  baseUrl,
  localAddress = null,
  onRetry = () => window.location.reload(),
}: TangentUnreachableProps) {
  const { title, detail, address } = describe(baseUrl, localAddress);

  return (
    <BlockStack fill align="center" gap="1" className="p-10">
      <div className="w-full max-w-xl">
        <InfoBox variant="error" title={title} width="full">
          <BlockStack gap="3" className="min-w-0">
            <Paragraph size="sm">{detail}</Paragraph>
            {address && (
              <Text
                size="xs"
                font="mono"
                tone="subdued"
                className="wrap-anywhere"
              >
                {address}
              </Text>
            )}
            <InlineStack gap="2">
              <Button size="sm" onClick={onRetry}>
                Try again
              </Button>
            </InlineStack>
          </BlockStack>
        </InfoBox>
      </div>
    </BlockStack>
  );
}
