import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";

interface RemoteAuthErrorViewProps {
  onReload?: () => void;
}

export const RemoteAuthErrorView = ({
  onReload = () => window.location.reload(),
}: RemoteAuthErrorViewProps) => {
  return (
    <BlockStack fill>
      <InfoBox title="Couldn't reach the server" variant="error">
        <BlockStack gap="3">
          <Paragraph>
            Your session may have expired or the connection was interrupted by
            an authentication service. Reload the page to reauthenticate and
            restore the connection.
          </Paragraph>
          <Button onClick={onReload} className="w-fit">
            Reload page
          </Button>
        </BlockStack>
      </InfoBox>
    </BlockStack>
  );
};
