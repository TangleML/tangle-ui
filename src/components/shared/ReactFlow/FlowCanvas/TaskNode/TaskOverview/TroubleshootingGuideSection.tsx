import type { TroubleshootingGuide } from "@/api/types.gen";
import { InfoBox } from "@/components/shared/InfoBox";
import { UntrustedMarkdown } from "@/components/shared/Markdown/Markdown";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { toAbsoluteHttpUrl } from "@/utils/URL";

interface TroubleshootingGuideSectionProps {
  guide: TroubleshootingGuide;
  className?: string;
}

export const TroubleshootingGuideSection = ({
  guide,
  className,
}: TroubleshootingGuideSectionProps) => {
  const actions = (guide.actions ?? []).flatMap((action) => {
    const url = toAbsoluteHttpUrl(action.url);
    return url ? [{ label: action.label, url }] : [];
  });

  return (
    <InfoBox
      title={guide.title}
      variant={guide.severity}
      width="full"
      className={className}
    >
      <BlockStack gap="3">
        <UntrustedMarkdown body={guide.body_markdown} />
        {actions.length > 0 && (
          <InlineStack gap="2">
            {actions.map((action) => (
              <Button key={action.url} asChild variant="outline" size="sm">
                <a href={action.url} target="_blank" rel="noopener noreferrer">
                  {action.label}
                  <Icon name="ExternalLink" size="sm" />
                </a>
              </Button>
            ))}
          </InlineStack>
        )}
      </BlockStack>
    </InfoBox>
  );
};
