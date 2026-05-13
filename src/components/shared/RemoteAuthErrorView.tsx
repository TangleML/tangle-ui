import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import authPageConfig from "@/config/authPageConfig.json";

interface AuthPageConfig {
  title: string;
  body: string;
  reloadLabel: string;
  helpLink?: {
    text: string;
    url: string;
  };
}

const config = authPageConfig as AuthPageConfig;

interface RemoteAuthErrorViewProps {
  onReload?: () => void;
}

export const RemoteAuthErrorView = ({
  onReload = () => window.location.reload(),
}: RemoteAuthErrorViewProps) => {
  const { title, body, reloadLabel, helpLink } = config;

  return (
    <BlockStack fill>
      <InfoBox title={title} variant="error">
        <BlockStack gap="3">
          <Paragraph>{body}</Paragraph>
          {helpLink && (
            <Paragraph tone="subdued" size="xs">
              <a
                href={helpLink.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {helpLink.text}
              </a>
            </Paragraph>
          )}
          <Button onClick={onReload} className="w-fit">
            {reloadLabel}
          </Button>
        </BlockStack>
      </InfoBox>
    </BlockStack>
  );
};
